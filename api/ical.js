const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU3NTc2NCwiZXhwIjoyMDk5MTUxNzY0fQ.Jc2ivNcjUQYqdlMsCby4PDDCpvkwSDew8xQdvxv66mE';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { sync, property_id, export_uuid } = req.query || {};

    if (!SERVICE_KEY) {
      return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY not set in environment.' });
    }

    // ------------- CASE 1: EXPORT CALENDAR FEED -------------
    if (export_uuid) {
      const settingsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_settings?or=(airbnb_ical_export_uuid.eq.${encodeURIComponent(export_uuid)},booking_ical_export_uuid.eq.${encodeURIComponent(export_uuid)})&select=*`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (!settingsResp.ok) return res.status(404).send('Calendar feed not found.');
      const settingsList = await settingsResp.json();
      const settings = Array.isArray(settingsList) ? settingsList[0] : settingsList;
      if (!settings) return res.status(404).send('Calendar feed not found.');
      const propId = settings.property_id;

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

    // ------------- CASE 2: SYNC / IMPORT EXTERNAL CALENDARS -------------
    if (sync && property_id) {
      const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?property_id=eq.${property_id}&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      });
      if (!settingsResp.ok) {
        const txt = await settingsResp.text();
        return res.status(502).json({ success: false, error: 'Failed to fetch admin_settings', details: txt });
      }
      const settingsList = await settingsResp.json();
      const settings = Array.isArray(settingsList) ? settingsList[0] : settingsList;
      if (!settings) return res.status(404).json({ success: false, error: 'No admin_settings found for property.' });

      const importUrls = [];
      if (settings.airbnb_ical_import_url && settings.airbnb_ical_import_url.startsWith('http')) {
        importUrls.push({ url: settings.airbnb_ical_import_url, source: 'airbnb' });
      }
      if (settings.booking_ical_import_url && settings.booking_ical_import_url.startsWith('http')) {
        importUrls.push({ url: settings.booking_ical_import_url, source: 'booking' });
      }

      if (importUrls.length === 0) {
        return res.status(200).json({ success: true, imported: 0, message: 'No valid import URLs configured.' });
      }

      function parseICalDates(icsText) {
        if (!icsText) return [];
        const events = [];
        const lines = icsText.split(/\r?\n/);
        let cur = null;
        for (let rawLine of lines) {
          const line = rawLine.trim();
          if (line === 'BEGIN:VEVENT') cur = {};
          else if (line === 'END:VEVENT') {
            if (cur && cur.dtstart) events.push({ start: cur.dtstart, end: cur.dtend || cur.dtstart });
            cur = null;
          } else if (cur) {
            if (line.startsWith('DTSTART')) cur.dtstart = line.split(':').pop();
            else if (line.startsWith('DTEND')) cur.dtend = line.split(':').pop();
          }
        }
        return events.map(e => {
          const toYMD = (v) => {
            if (!v) return null;
            const m = String(v).replace(/[^0-9]/g, '').match(/^(\d{4})(\d{2})(\d{2})/);
            return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
          };
          return { start: toYMD(e.start), end: toYMD(e.end) };
        }).filter(e => e.start);
      }

      function expandDates(start, end, source) {
        const dates = [];
        const s = new Date(start + 'T00:00:00Z');
        const e = end ? new Date(end + 'T00:00:00Z') : new Date(s.getTime() + 24*3600*1000);
        for (let d = new Date(s); d < e; d.setUTCDate(d.getUTCDate() + 1)) {
          dates.push({ date: d.toISOString().split('T')[0], source });
        }
        return dates;
      }

      const allBlocksMap = new Map();
      for (const item of importUrls) {
        try {
          const resp = await fetch(item.url, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
          });
          if (!resp.ok) continue;
          const txt = await resp.text();
          const evts = parseICalDates(txt);
          evts.forEach(ev => {
            const days = expandDates(ev.start, ev.end, item.source);
            days.forEach(b => allBlocksMap.set(b.date, b));
          });
        } catch (err) {
          console.warn('iCal fetch error for', item.url, err.message);
        }
      }

      const dailyBlocks = Array.from(allBlocksMap.values()).map(b => ({
        property_id: property_id,
        date: b.date,
        source: b.source,
        reason: b.source === 'airbnb' ? 'Airbnb booking' : 'Booking.com booking'
      }));

      // Delete existing synced external blocks for this property
      await fetch(
        `${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${property_id}&source=in.(airbnb,booking)`,
        {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        }
      );

      // Insert new daily blocks if any
      if (dailyBlocks.length > 0) {
        const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/blocked_dates`, {
          method: 'POST',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(dailyBlocks)
        });
        if (!insertResp.ok) {
          const txt = await insertResp.text();
          return res.status(502).json({ success: false, error: 'Failed to insert blocked dates.', details: txt });
        }
      }

      return res.status(200).json({
        success: true,
        imported: dailyBlocks.length,
        message: `Successfully synced ${dailyBlocks.length} blocked date(s) from external calendars.`
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid parameters. Pass ?sync=true&property_id=<id> or ?export_uuid=<uuid>' });
  } catch (error) {
    console.error('iCal handler error:', error);
    return res.status(500).json({ success: false, error: error && error.message ? error.message : String(error) });
  }
};
