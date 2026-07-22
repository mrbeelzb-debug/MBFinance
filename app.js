// Entrypoint Vercel. UI sebenarnya tetap aplikasi HTML/CSS/JS statis.
const fs = require('node:fs');
const path = require('node:path');

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
  '/config.js': ['config.js', 'text/javascript; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8']
};

module.exports = (request, response) => {
  const pathname = new URL(request.url, 'https://mb-finance.local').pathname;
  const file = staticFiles[pathname];
  if (!file) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }

  const [filename, contentType] = file;
  const content = fs.readFileSync(path.join(__dirname, filename));
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', 'no-store');
  response.end(content);
};
