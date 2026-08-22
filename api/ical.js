const SUPABASE_URL = 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU3NTc2NCwiZXhwIjoyMDk5MTUxNzY0fQ.Jc2ivNcjUQYqdlMsCby4PDDCpvkwSDew8xQdvxv66mE';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { export_uuid, sync, property_id } = req.query;

  try {
    // ----------------------------------------------------
    // CASE 1: EXPORT CALENDAR FEED
    // ----------------------------------------------------
    if (export_uuid) {
      // Find property admin settings that match the export uuid
      // We check both airbnb and booking export UUIDs
      const settingsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_settings?or=(airbnb_ical_export_uuid.eq.${export_uuid},booking_ical_export_uuid.eq.${export_uuid})&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      const settingsList = await settingsResp.json();
      if (!settingsList || settingsList.length === 0) {
        return res.status(404).send('Calendar feed not found.');
      }

      const settings = settingsList[0];
      const propId = settings.property_id;

      // Fetch confirmed bookings for this property
      const bookingsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?property_id=eq.${propId}&status=eq.confirmed&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const bookings = await bookingsResp.json();

      // Fetch manual date blocks
      const blocksResp = await fetch(
        `${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${propId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const blocks = await blocksResp.json();

      // Build iCal text
      let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Toiwo Residence//Arusha Direct Bookings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];

      // Add bookings to iCal
      bookings.forEach(b => {
        const start = b.check_in.replace(/-/g, '');
        const end = b.check_out.replace(/-/g, '');
        ics.push(
          'BEGIN:VEVENT',
          `UID:booking-${b.id}@toiwo-residence.app`,
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${end}`,
          `SUMMARY:Toiwo Booking - ${b.guest_name}`,
          'END:VEVENT'
        );
      });

      // Add manual blocks to iCal (single dates)
      // Group contiguous blocked dates by reason to make it cleaner, or just export them as individual days
      blocks.forEach(block => {
        const start = block.blocked_date.replace(/-/g, '');
        // iCal DTEND for a date block is exclusive, so the next day
        const d = new Date(block.blocked_date);
        d.setDate(d.getDate() + 1);
        const end = d.toISOString().split('T')[0].replace(/-/g, '');

        ics.push(
          'BEGIN:VEVENT',
          `UID:block-${block.id}@toiwo-residence.app`,
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${end}`,
          `SUMMARY:Blocked - ${block.reason || 'Manual Block'}`,
          'END:VEVENT'
        );
      });

      ics.push('END:VCALENDAR');
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      return res.status(200).send(ics.join('\r\n'));
    }

    // ----------------------------------------------------
    // CASE 2: IMPORT/SYNC CALENDAR FEEDS
    // ----------------------------------------------------
    if (sync && property_id) {
      // Fetch settings to get import URLs
      const settingsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_settings?property_id=eq.${property_id}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const settingsList = await settingsResp.json();
      if (!settingsList || settingsList.length === 0) {
        return res.status(404).json({ error: 'Settings not found' });
      }
      
      const settings = settingsList[0];
      const airbnbUrl = settings.airbnb_ical_import_url;
      const bookingUrl = settings.booking_ical_import_url;

      let newBlocks = [];

      // Fetch & Parse Airbnb iCal
      if (airbnbUrl && airbnbUrl.startsWith('http')) {
        try {
          const resp = await fetch(airbnbUrl);
          const text = await resp.text();
          const parsed = parseICal(text);
          parsed.forEach(evt => {
            newBlocks.push({
              property_id,
              blocked_date_start: evt.start,
              blocked_date_end: evt.end,
              reason: 'Airbnb Sync Booked'
            });
          });
        } catch (e) {
          console.error('Error fetching Airbnb iCal:', e);
        }
      }

      // Fetch & Parse Booking.com iCal
      if (bookingUrl && bookingUrl.startsWith('http')) {
        try {
          const resp = await fetch(bookingUrl);
          const text = await resp.text();
          const parsed = parseICal(text);
          parsed.forEach(evt => {
            newBlocks.push({
              property_id,
              blocked_date_start: evt.start,
              blocked_date_end: evt.end,
              reason: 'Booking.com Sync Booked'
            });
          });
        } catch (e) {
          console.error('Error fetching Booking.com iCal:', e);
        }
      }

      // Delete existing synced blocks (blocks with 'Sync Booked' in reason)
      await fetch(
        `${SUPABASE_URL}/rest/v1/blocked_dates?property_id=eq.${property_id}&reason=like.*Sync%20Booked`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      // Expand start/end ranges into individual daily blocks for the blocked_dates table
      const dailyBlocks = [];
      newBlocks.forEach(block => {
        let curr = new Date(block.blocked_date_start);
        const end = new Date(block.blocked_date_end);
        // Exclude checkout day (end date is checkout/exclusive)
        while (curr < end) {
          dailyBlocks.push({
            property_id: block.property_id,
            blocked_date: curr.toISOString().split('T')[0],
            reason: block.reason
          });
          curr.setDate(curr.getDate() + 1);
        }
      });

      // Bulk insert daily blocks
      if (dailyBlocks.length > 0) {
        const insertResp = await fetch(
          `${SUPABASE_URL}/rest/v1/blocked_dates`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(dailyBlocks)
          }
        );
        const insertData = await insertResp.json();
        return res.status(200).json({ success: true, imported: dailyBlocks.length, data: insertData });
      }

      return res.status(200).json({ success: true, imported: 0 });
    }

    return res.status(400).send('Invalid request parameters.');

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

// Simple lightweight iCal parser
function parseICal(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;

  for (let line of lines) {
    line = line.trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('DTSTART')) {
        const val = line.split(':').pop();
        currentEvent.start = parseICalDate(val);
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':').pop();
        currentEvent.end = parseICalDate(val);
      } else if (line.startsWith('SUMMARY')) {
        currentEvent.summary = line.split(':').slice(1).join(':');
      }
    }
  }
  return events;
}

function parseICalDate(dateStr) {
  // Format could be: 20260810 or 20260810T110000Z or;VALUE=DATE:20260810
  const clean = dateStr.replace(/[^0-9T]/g, '');
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return `${y}-${m}-${d}`;
}
