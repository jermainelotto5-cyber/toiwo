// /api/content.js — Public API to read site content from Supabase
// Called by the frontend on every page load (no auth required, read-only)

const SUPABASE_URL = 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU3NTc2NCwiZXhwIjoyMDk5MTUxNzY0fQ.Jc2ivNcjUQYqdlMsCby4PDDCpvkwSDew8xQdvxv66mE';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/site_content?select=section,content&order=section`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        }
      }
    );

    if (!response.ok) {
      // Table might not exist yet — return empty object
      return res.status(200).json({});
    }

    const rows = await response.json();
    // Convert array of { section, content } rows into a flat object
    const result = {};
    (rows || []).forEach(row => { result[row.section] = row.content; });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Content API error:', err);
    return res.status(200).json({});
  }
};
