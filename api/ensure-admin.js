const SUPABASE_URL = 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'toiwo-setup-2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jermainelotto5@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.query.key !== SETUP_KEY) {
    return res.status(403).json({ error: 'Invalid setup key' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not set in Vercel environment variables.',
      steps: [
        'Open Supabase Dashboard → Project Settings → API → copy the service_role key',
        'Open Vercel Dashboard → toiwo-residence → Settings → Environment Variables',
        'Add SUPABASE_SERVICE_ROLE_KEY with the service_role value',
        'Set ADMIN_EMAIL and ADMIN_PASSWORD if you want to create/update the admin account',
        'Redeploy, then visit this URL again'
      ]
    });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const listResp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`,
      { headers }
    );
    const listData = await listResp.json();

    if (!listResp.ok) {
      return res.status(listResp.status).json({ error: 'Failed to look up admin user', details: listData });
    }

    const existingUser = listData.users?.[0];

    if (existingUser) {
      const updateResp = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            password: ADMIN_PASSWORD,
            email_confirm: true
          })
        }
      );
      const updateData = await updateResp.json();
      if (!updateResp.ok) {
        return res.status(updateResp.status).json({ error: 'Failed to update admin password', details: updateData });
      }
      return res.status(200).json({
        success: true,
        action: 'updated',
        email: ADMIN_EMAIL,
        message: 'Admin password reset. You can now sign in at /admin'
      });
    }

    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true
      })
    });
    const createData = await createResp.json();
    if (!createResp.ok) {
      return res.status(createResp.status).json({ error: 'Failed to create admin user', details: createData });
    }

    return res.status(200).json({
      success: true,
      action: 'created',
      email: ADMIN_EMAIL,
      message: 'Admin account created. You can now sign in at /admin'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
