// /api/supabase-proxy.js
// Transparent proxy between the browser and Supabase.
// The browser posts a JSON payload here; we parse it safely, then forward the request
// to Supabase and return the raw response bytes without forwarding Content-Encoding.

const SUPABASE_PREFIX = 'https://kzpdoxmooddkujtntvlf.supabase.co';

function getRequestPayload(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }

  // Some Vercel serverless bodies arrive as a Buffer. Parse it if present.
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch (error) {
      return {};
    }
  }

  return {};
}

module.exports = async (req, res) => {
  // CORS for browser requests from the site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, X-Client-Info, Prefer, Range, Accept-Profile, Content-Profile');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const payload = getRequestPayload(req);
    const url = payload.url;
    const method = (payload.method || 'GET').toUpperCase();
    const headers = Object.assign({}, payload.headers || {});
    const body = payload.body;

    if (!url || !url.startsWith(SUPABASE_PREFIX)) {
      return res.status(400).json({ error: 'Invalid proxy target' });
    }

    const fetchOptions = { method, headers };

    if (body != null && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!Object.keys(fetchOptions.headers).some(h => h.toLowerCase() === 'content-type')) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    const hopByHop = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade']);
    response.headers.forEach((value, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.status(response.status);
    if (buffer.length) {
      res.send(buffer);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Proxy request failed', message: error.message });
  }
};
