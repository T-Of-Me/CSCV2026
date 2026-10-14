const ejs = require('ejs');


function mergeCatalog(target, source, depth = 0) {
  if (depth > 10 || !source || typeof source !== 'object') return;

  for (const key of Object.keys(source)) {
    if (key === '__proto__') continue;
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
       if (!(key in target)) target[key] = {};
      mergeCatalog(target[key], value, depth + 1);
    } else {
      target[key] = value;
    }
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (input.length > 48_000) process.exit(1);
});
process.stdin.on('end', () => {
  try {
    const job = JSON.parse(input);
    const options = {
      cache: false,
      compileDebug: false,
      rmWhitespace: true,
    };
    mergeCatalog(options, job.theme);

    const layout = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title><%= boardName %></title></head>
        <body><main class="preview"><h1><%= boardName %></h1></main></body>
      </html>
    `;
    const html = ejs.render(layout, {boardName: job.title}, options);
    process.stdout.write(JSON.stringify({html}));
  } catch (error) {
    process.stderr.write(String(error.message || error));
    process.exitCode = 1;
  }
});

