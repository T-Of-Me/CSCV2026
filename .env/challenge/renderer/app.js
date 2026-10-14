const path = require('node:path');
const {spawn} = require('node:child_process');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.use(express.json({limit: '40kb'}));


function runComposer(job) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'worker.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 2500,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 32_768) child.kill('SIGKILL');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 8192) child.kill('SIGKILL');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || 'composer failed'));
      try {
        return resolve(JSON.parse(stdout));
      } catch {
        return reject(new Error('invalid composer response'));
      }
    });
    child.stdin.end(JSON.stringify(job));
  });
}

app.get('/health', (req, res) => {
  res.json({service: 'composer', healthy: true});
});

app.post('/compose', async (req, res) => {
  const {theme, title} = req.body || {};
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    return res.status(400).json({error: 'invalid theme catalog'});
  }
  if (typeof title !== 'string' || title.length > 128) {
    return res.status(400).json({error: 'invalid board title'});
  }

  try {
    const result = await runComposer({theme, title});
    return res.json(result);
  } catch (error) {
    console.error(error.message);
    return res.status(422).json({error: 'preview composition failed'});
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`composer listening on ${port}`);
});

