const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const express = require('express');
const multer = require('multer');

const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.PORT || 3000);
const uploadDir = path.join(__dirname, 'data', 'uploads');
const rendererUrl = process.env.RENDERER_URL || 'http://renderer:5000';
const botUrl = process.env.BOT_URL || 'http://bot:3001';
const botSecret = process.env.BOT_SHARED_SECRET || 'development-bot-secret';
const adminToken = process.env.ADMIN_TOKEN || 'development-admin-token';

fs.mkdirSync(uploadDir, {recursive: true});

const upload = multer({
  dest: uploadDir,
  limits: {fileSize: 192 * 1024, files: 1},
});

const imageExtensions = new Map([
  ['image/svg+xml', '.svg'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
]);

const telemetry = new Map();
const reports = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; child-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  );
  next();
});

app.use(express.json({limit: '48kb'}));

function randomId() {
  return crypto.randomBytes(12).toString('hex');
}

function validId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const separator = item.indexOf('=');
    if (separator === -1) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return null;
}

function isAdmin(req) {
  const supplied = cookieValue(req, 'chromatic_admin');
  if (!supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(adminToken);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function sniffMime(filename) {
  const {stdout} = await execFileAsync('/usr/bin/file', [
    '--brief',
    '--mime-type',
    filename,
  ]);
  return stdout.trim().toLowerCase();
}

function hasDocumentPreamble(filename) {
  const prefix = fs.readFileSync(filename).subarray(0, 64);
  let offset = 0;

  if (prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf) {
    offset = 3;
  }

  while (
    prefix[offset] === 0x09 || prefix[offset] === 0x0a ||
    prefix[offset] === 0x0d || prefix[offset] === 0x20
  ) offset += 1;

  return prefix[offset] === 0x7b || prefix[offset] === 0x5b;
}

function extensionFor(mime) {
  return imageExtensions.get(mime) || null;
}

function locateAsset(id) {
  if (!validId(id)) return null;
  const found = fs.readdirSync(uploadDir).find((name) => name.startsWith(`${id}.`));
  return found ? path.join(uploadDir, found) : null;
}

app.get('/api/status', (req, res) => {
  res.json({service: 'chromatic', version: '3.4.1'});
});

app.post('/api/media', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({error: 'image is required'});

  try {
    const mime = await sniffMime(req.file.path);
    const extension = extensionFor(mime);
    if (!extension) {
      fs.unlinkSync(req.file.path);
      return res.status(415).json({error: 'unsupported image format', detected: mime});
    }

    if (hasDocumentPreamble(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(415).json({error: 'invalid image signature'});
    }

    const id = randomId();
    const storedName = `${id}${extension}`;
    fs.renameSync(req.file.path, path.join(uploadDir, storedName));
    return res.status(201).json({id, mime, name: storedName});
  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(error);
    return res.status(500).json({error: 'media inspection failed'});
  }
});

app.get('/api/media/raw', async (req, res) => {
  const asset = locateAsset(req.query.id);
  if (!asset) return res.status(404).json({error: 'asset not found'});

  try {
    const mime = await sniffMime(asset);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.setHeader('X-Asset-Id', req.query.id);
    return res.sendFile(asset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({error: 'asset read failed'});
  }
});

app.get('/api/workspaces/manifest', (req, res) => {
  const workspace = String(req.query.workspace || '');
  if (!validId(workspace)) return res.status(400).json({error: 'invalid workspace'});

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.json({
    name: 'Untitled workspace',
    owner: 'guest',
    blocks: [
      {kind: 'text', body: '<p>This workspace is waiting for its first idea.</p>'},
    ],
  });
});

app.post('/api/telemetry/:channel', (req, res) => {
  if (!validId(req.params.channel)) return res.status(400).json({error: 'invalid channel'});
  if (typeof req.body.sample !== 'string' || req.body.sample.length > 16_384) {
    return res.status(400).json({error: 'sample must be a short string'});
  }

  telemetry.set(req.params.channel, {
    sample: req.body.sample,
    expires: Date.now() + 120_000,
  });
  return res.status(204).end();
});

app.get('/api/telemetry/:channel', (req, res) => {
  if (!validId(req.params.channel)) return res.status(400).json({error: 'invalid channel'});
  const entry = telemetry.get(req.params.channel);
  if (!entry || entry.expires < Date.now()) {
    telemetry.delete(req.params.channel);
    return res.status(404).json({error: 'channel is empty'});
  }
  return res.json({sample: entry.sample});
});

app.post('/api/admin/export-preview', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({error: 'administrator session required'});
  if (!req.body.theme || typeof req.body.theme !== 'object' || Array.isArray(req.body.theme)) {
    return res.status(400).json({error: 'theme must be an object'});
  }
  if (typeof req.body.title !== 'string' || req.body.title.length > 128) {
    return res.status(400).json({error: 'title must be a short string'});
  }

  try {
    const upstream = await fetch(`${rendererUrl}/compose`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({theme: req.body.theme, title: req.body.title}),
      signal: AbortSignal.timeout(4000),
    });
    const body = await upstream.text();
    res.status(upstream.status).type('application/json').send(body);
  } catch (error) {
    console.error(error);
    res.status(502).json({error: 'renderer unavailable'});
  }
});

app.post('/api/report', async (req, res) => {
  const workspace = req.body.workspace;
  if (!validId(workspace)) return res.status(400).json({error: 'invalid workspace'});

  const now = Date.now();
  const last = reports.get(req.ip) || 0;
  if (now - last < 4000) return res.status(429).json({error: 'review queue is cooling down'});
  reports.set(req.ip, now);

  try {
    const upstream = await fetch(`${botUrl}/visit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-secret': botSecret,
      },
      body: JSON.stringify({workspace}),
      signal: AbortSignal.timeout(2500),
    });
    if (!upstream.ok) return res.status(502).json({error: 'review bot rejected the job'});
    return res.status(202).json({queued: true});
  } catch (error) {
    console.error(error);
    return res.status(502).json({error: 'review bot unavailable'});
  }
});

app.use('/static', express.static(path.join(__dirname, 'static'), {
  immutable: true,
  maxAge: '1h',
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({error: 'not found'});
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`chromatic web listening on ${port}`);
});
