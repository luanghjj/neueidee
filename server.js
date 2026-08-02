const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 8085;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // AI Proxy Endpoint: /api/ai
  if (req.url === '/api/ai' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        let targetUrl = payload.endpoint || 'https://opencode.ai/zen/v1/chat/completions';
        if (!targetUrl.includes('/chat/completions')) {
          targetUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
        }
        
        const urlObj = new URL(targetUrl);
        const requestData = JSON.stringify({
          model: payload.model || 'deepseek-v4-flash-free',
          messages: payload.messages,
          temperature: payload.temperature || 0.7
        });

        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData),
            'Authorization': payload.apiKey ? `Bearer ${payload.apiKey}` : ''
          }
        };

        const client = (urlObj.protocol === 'https:' ? https : http);
        const proxyReq = client.request(options, proxyRes => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          proxyRes.pipe(res);
        });

        proxyReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(requestData);
        proxyReq.end();
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, req.url.split('?')[0]);
  if (filePath.endsWith('/') || filePath === PUBLIC_DIR) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Spark Server running at http://localhost:${PORT}`);
});
