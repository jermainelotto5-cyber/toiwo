const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Booking service is not configured.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const required = ['property_id', 'guest_name', 'guest_email', 'check_in', 'check_out', 'num_guests'];
    if (required.some(key => !body[key])) return res.status(400).json({ error: 'Missing required booking fields.' });
    if (new Date(body.check_out) <= new Date(body.check_in)) return res.status(400).json({ error: 'Check-out must be after check-in.' });
    if (Number(body.num_guests) < 1 || Number(body.num_guests) > 8) return res.status(400).json({ error: 'Guest count must be between 1 and 8.' });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        property_id: body.property_id,
        guest_name: String(body.guest_name).slice(0, 255),
        guest_email: String(body.guest_email).slice(0, 255),
        guest_phone: body.guest_phone ? String(body.guest_phone).slice(0, 20) : '',
        check_in: body.check_in,
        check_out: body.check_out,
        num_guests: Number(body.num_guests),
        special_requests: body.special_requests || '',
        total_price: Number(body.total_price || 0),
        status: 'pending',
        payment_status: 'unpaid'
      })
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!response.ok) return res.status(response.status).json({ error: data?.message || data?.error || 'Could not create booking.', details: data });
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Booking service failed.' });
  }
};
