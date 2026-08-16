// /api/supabase-proxy.js
// Transparent proxy between the browser and Supabase.
// This server-side route forwards requests to Supabase and returns
// the raw response bytes to the browser while preserving important headers.

const SUPABASE_PREFIX = 'https://kzpdoxmooddkujtntvlf.supabase.co';

module.exports = async (req, res) => {
  // CORS for browser requests from the site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, X-Client-Info, Prefer, Range, Accept-Profile, Content-Profile');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Expect the client to POST a JSON payload: { url, method, headers, body }
    const payload = req.body || {};
    const url = payload.url;
    const method = (payload.method || 'GET').toUpperCase();
    const headers = Object.assign({}, payload.headers || {});
    const body = payload.body;

    if (!url || !url.startsWith(SUPABASE_PREFIX)) {
      return res.status(400).json({ error: 'Invalid proxy target' });
    }

    const fetchOptions = { method, headers };

    // If the client provided a body, forward it. Keep it as a string if already a string.
    if (body != null && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      // Ensure content-type header is present when we send JSON
      if (!Object.keys(fetchOptions.headers).some(h => h.toLowerCase() === 'content-type')) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    // Copy response headers but exclude those that would cause the browser to try to
    // re-decode an already-decoded body (Content-Encoding) or other hop-by-hop headers.
    const hopByHop = new Set(['transfer-encoding', 'connection', 'content-encoding', 'content-length']);
    response.headers.forEach((value, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Read raw response bytes and send them directly so encoding is preserved.
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.status(response.status);
    // Some responses may be empty (204). If buffer has length, send it; otherwise end.
    if (buffer.length) {
      res.send(buffer);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy error:', error);
    // Return a JSON error (safe for the client) with status 502 to indicate upstream failure
    res.status(502).json({ error: 'Proxy request failed', message: error.message });
  }
};
