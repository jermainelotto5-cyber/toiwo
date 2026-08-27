const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU3NTc2NCwiZXhwIjoyMDk5MTUxNzY0fQ.Jc2ivNcjUQYqdlMsCby4PDDCpvkwSDew8xQdvxv66mE';

module.exports = async (req, res) => {
  // Basic CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { sync, property_id, export_uuid } = req.query || {};

    // Ensure service key is present for any write/read operations
    if (!SERVICE_KEY) {
      return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY not set in environment.' });
    }

    // ------------- EXPORT (unchanged) -------------
    if (export_uuid) {
      // serve an iCal feed based on bookings + blocked_dates
      const settingsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_settings?or=(airbnb_ical_export_uuid.eq.${encodeURIComponent(export_uuid)},booking_ical_export_uuid.eq.${encodeURIComponent(export_uuid)})&select=*`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (!settingsResp.ok) return res.status(404).send('Calendar feed not found.');
      const settingsList = await settingsResp.json();
      const settings = Array.isArray(settingsList) ? settingsList[0] : settingsList;
      if (!settings) return res.status(404).send('Calendar feed not found.');
      const propId = settings.property_id;

      // Fetch bookings and blocks
      const [bookingsResp, blocksResp] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/bookings?property_id=eq.${propId}&status=eq.confirmed&select=*`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${propId}&select=*`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })
      ]);
      const bookings = bookingsResp.ok ? await bookingsResp.json() : [];
      const blocks = blocksResp.ok ? await blocksResp.json() : [];

      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Toiwo Residence//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
      bookings.forEach(b => {
        const start = (b.check_in || '').replace(/-/g, '');
        const end = (b.check_out || '').replace(/-/g, '');
        ics.push('BEGIN:VEVENT', `UID:booking-${b.id}@toiwo-residence`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:Toiwo Booking - ${b.guest_name || ''}`, 'END:VEVENT');
      });
      blocks.forEach(block => {
        const dateValue = block.date || block.blocked_date;
        if (!dateValue) return;
        const start = String(dateValue).replace(/-/g, '');
        const d = new Date(dateValue);
        d.setDate(d.getDate() + 1);
        const end = d.toISOString().split('T')[0].replace(/-/g, '');
        ics.push('BEGIN:VEVENT', `UID:block-${block.id}@toiwo-residence`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:Blocked - ${block.reason || 'Manual'}`, 'END:VEVENT');
      });
      ics.push('END:VCALENDAR');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      return res.status(200).send(ics.join('\r\n'));
    }

    // ------------- SYNC IMPORT -------------
    if (sync && property_id) {\n      // Validate property_id is a UUID (prevent SQL errors from invalid input)\n      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;\n      if (!uuidRegex.test(String(property_id))) {\n        return res.status(400).json({ success: false, error: 'Invalid property_id format (expected UUID).' });\n      }
      // Get admin settings for property to find external iCal URLs
      const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?property_id=eq.${property_id}&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      });
      if (!settingsResp.ok) {
        const txt = await settingsResp.text();
        return res.status(502).json({ success: false, error: 'Failed to fetch admin_settings', details: txt });
      }
      const settingsList = await settingsResp.json();
      const settings = Array.isArray(settingsList) ? settingsList[0] : settingsList;
      if (!settings) return res.status(404).json({ success: false, error: 'No admin_settings for property' });

      const importUrls = [];
      if (settings.airbnb_ical_import_url) importUrls.push(settings.airbnb_ical_import_url);
      if (settings.booking_ical_import_url) importUrls.push(settings.booking_ical_import_url);
      if (importUrls.length === 0) return res.json({ success: true, message: 'No import URLs configured for this property.' });

      // helper: lightweight iCal parse
      function parseICalDates(icsText) {
        if (!icsText) return [];
        const events = [];
        const lines = icsText.split(/\r?\n/);
        let cur = null;
        for (let rawLine of lines) {
          const line = rawLine.trim();
          if (line === 'BEGIN:VEVENT') cur = {};
          else if (line === 'END:VEVENT') { if (cur && cur.dtstart) events.push({ start: cur.dtstart, end: cur.dtend || cur.dtstart }); cur = null; }
          else if (cur) {
            if (line.startsWith('DTSTART')) cur.dtstart = line.split(':').pop();
            else if (line.startsWith('DTEND')) cur.dtend = line.split(':').pop();
          }
        }
        // normalize YYYYMMDD or YYYYMMDDTHHMMSSZ to YYYY-MM-DD
        return events.map(e => {
          const toYMD = (v) => { if (!v) return null; const m = v.match(/^(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null };
          return { start: toYMD(e.start), end: toYMD(e.end) };
        }).filter(e => e.start);
      }

      function expandDates(start, end) {
        const dates = [];
        const s = new Date(start + 'T00:00:00Z');
        const e = end ? new Date(end + 'T00:00:00Z') : new Date(s.getTime() + 24*3600*1000);
        // Treat end as exclusive (typical iCal DTEND semantics)
        for (let d = new Date(s); d < e; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().split('T')[0]);
        return dates;
      }

      const allDates = new Set();
      // Fetch each iCal URL
      for (const u of importUrls) {
        try {
          const resp = await fetch(u, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
          if (!resp.ok) { console.warn('iCal fetch failed', u, resp.status); continue; }
          const txt = await resp.text();
          const evts = parseICalDates(txt);
          evts.forEach(ev => {
            const dates = expandDates(ev.start, ev.end);
            dates.forEach(d => allDates.add(d));
          });
        } catch (err) {
          console.warn('iCal fetch/parse error for', u, err && err.message ? err.message : err);
        }
      }

      // If no dates found, respond but clear previous external blocks
      if (allDates.size === 0) {
        // Optionally remove previous external-calendar blocks to keep state fresh
        const deleteUrl = `${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${property_id}&or=(reason.eq.external-calendar,reason.ilike.*Sync%20Booked)`;
        await fetch(deleteUrl, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        return res.json({ success: true, message: 'No blocked dates found in external calendars.' });
      }

      // Delete previous external blocks (by reason marker) to avoid duplicates
      const deleteUrl = `${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${property_id}&or=(reason.eq.external-calendar,reason.ilike.*Sync%20Booked)`;
      await fetch(deleteUrl, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });

      // Insert new daily blocked_dates
      const payload = Array.from(allDates).map(d => ({ property_id: property_id, date: d, reason: 'external-calendar' }));
      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/blocked_dates`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(payload)
      });
      if (!insertResp.ok) {
        const txt = await insertResp.text();
        return res.status(502).json({ success: false, error: 'Failed to insert blocked dates', details: txt });
      }

      return res.json({ success: true, message: `Imported ${payload.length} blocked dates from external calendars.` });
    }

<<<<<<< HEAD
    return res.status(400).json({ success: false, error: 'Invalid request. Provide ?sync=true&property_id=<id> or ?export_uuid=<uuid>' });
  } catch (err) {
    console.error('iCal handler error:', err);
    return res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
=======
    return res.status(400).json({ error: 'Invalid request parameters.' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
>>>>>>> 2a1199b (Fix: add logo to top, photo management for welcome section in admin, fix iCal sync JSON error and mobile layout)
  }
};




