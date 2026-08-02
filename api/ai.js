const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    let targetUrl = body.endpoint || 'https://opencode.ai/zen/v1/chat/completions';
    if (!targetUrl.includes('/chat/completions')) {
      targetUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
    }

    const urlObj = new URL(targetUrl);
    const requestData = JSON.stringify({
      model: body.model || 'deepseek-v4-flash-free',
      messages: body.messages || [],
      temperature: body.temperature || 0.7
    });

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        'Authorization': body.apiKey ? `Bearer ${body.apiKey}` : ''
      }
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    const proxyReq = client.request(options, proxyRes => {
      let responseBody = '';
      proxyRes.on('data', chunk => responseBody += chunk);
      proxyRes.on('end', () => {
        res.status(proxyRes.statusCode || 200);
        res.setHeader('Content-Type', 'application/json');
        res.send(responseBody);
      });
    });

    proxyReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    proxyReq.write(requestData);
    proxyReq.end();
  } catch (err) {
    res.status(400).json({ error: 'Invalid payload: ' + err.message });
  }
};
