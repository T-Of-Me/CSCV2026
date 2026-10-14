const express = require('express');
const {chromium} = require('playwright');

const app = express();
const port = Number(process.env.PORT || 3001);
const origin = process.env.APP_ORIGIN || 'http://edge:8080';
const sharedSecret = process.env.BOT_SHARED_SECRET || 'development-bot-secret';
const adminToken = process.env.ADMIN_TOKEN || 'development-admin-token';


app.use(express.json({limit: '8kb'}));

let browserPromise;
let queue = Promise.resolve();

function browser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
  }
  return browserPromise;
}

async function review(workspace) {
  const instance = await browser();
  const context = await instance.newContext();
  await context.addCookies([{
    name: 'chromatic_admin',
    value: adminToken,
    url: origin,
    httpOnly: true,
    sameSite: 'Strict',
  }]);

  const page = await context.newPage();
  page.on('console', (message) => console.log(`[review] ${message.type()}: ${message.text()}`));
  try {
    await page.goto(`${origin}/w/${workspace}`, {
      waitUntil: 'domcontentloaded',
      timeout: 12_000,
    });
    await page.waitForTimeout(6_000);
  } finally {
    await context.close();
  }
}

app.post('/visit', (req, res) => {
  if (req.get('x-bot-secret') !== sharedSecret) {
    return res.status(403).json({error: 'forbidden'});
  }
  const workspace = req.body.workspace;
  if (typeof workspace !== 'string' || !/^[a-f0-9]{24}$/.test(workspace)) {
    return res.status(400).json({error: 'invalid workspace'});
  }

  queue = queue.then(() => review(workspace)).catch((error) => console.error(error));
  return res.status(202).json({queued: true});
});

app.get('/health', (req, res) => res.json({healthy: true}));

app.listen(port, '0.0.0.0', () => {
  console.log(`review bot listening on ${port}`);
});

