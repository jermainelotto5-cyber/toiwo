// ============================================
// Supabase Client Setup & Helper Functions
// ============================================

// Initialize Supabase Client
const SUPABASE_URL = 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NzU3NjQsImV4cCI6MjA5OTE1MTc2NH0.cIuu86DwNQzHPvzyWoc6Hu3dEz8YTdE84MTi4fLhfRc';

// Custom fetch: routes all Supabase requests through our Vercel proxy
// so the browser never directly contacts supabase.co (bypassing network blocks)
const extractHeaders = (headers) => {
  if (!headers) return {};
  const obj = {};
  if (typeof headers.forEach === 'function') {
    headers.forEach((val, key) => { obj[key] = val; });
    return obj;
  }
  if (typeof headers.entries === 'function') {
    for (const [k, v] of headers.entries()) { obj[k] = v; }
    return obj;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (typeof headers === 'object') {
    return { ...headers };
  }
  return {};
};

const proxyFetch = async (url, options = {}) => {
  const outgoingHeaders = extractHeaders(options.headers);

  return fetch('/api/supabase-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url,
      method: options.method || 'GET',
      headers: outgoingHeaders,
      body: options.body || null
    })
  });
};

let supabaseClient;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { fetch: proxyFetch }
    });
    console.log('Supabase client initialized via proxy.');
  } else {
    console.error('window.supabase is not defined.');
  }
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}

if (supabaseClient) {
  window.supabase = supabaseClient;
  window.supabaseClient = supabaseClient;
}

// ============================================
// PROPERTY FUNCTIONS
// ============================================

async function getProperty(propertyId = null) {
  try {
    let query = supabaseClient.from('properties').select('*');
    if (propertyId) {
      query = query.eq('id', propertyId);
    }
    const { data, error } = await query.single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching property:', error);
    return null;
  }
}

async function getPropertyByName(name = 'Toiwo Residence') {
  try {
    const { data, error } = await supabaseClient
      .from('properties')
      .select('*')
      .eq('name', name)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching property by name:', error);
    return null;
  }
}

// ============================================
// ADMIN SETTINGS FUNCTIONS
// ============================================

async function getAdminSettings(propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return null;
  }
}

async function updateAdminSettings(propertyId, updates) {
  try {
    const payload = {
      property_id: propertyId,
      ...updates,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .upsert(payload, { onConflict: 'property_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating admin settings:', error);
    throw error;
  }
}

// ============================================
// BOOKING FUNCTIONS
// ============================================

async function checkAvailability(propertyId, checkIn, checkOut) {
  try {
    const { data, error } = await supabaseClient
      .rpc('check_availability', {
        property_id: propertyId,
        check_in_date: checkIn,
        check_out_date: checkOut
      });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
}

async function createBooking(bookingData) {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .insert([bookingData])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
}

async function getBookingsByEmail(email) {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('guest_email', email);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

async function getAllBookings(propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId)
      .order('check_in', { ascending: false });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    return [];
  }
}

async function updateBookingStatus(bookingId, status) {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

// ============================================
// BLOCKED DATES FUNCTIONS
// ============================================

async function getBlockedDates(propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from('blocked_dates')
      .select('*')
      .eq('property_id', propertyId);
    if (error) throw error;
    // `blocked_date` is the canonical field. The range handling keeps old
    // imported records unavailable while the database migration is applied.
    const dates = new Set();
    (data || []).forEach(block => {
      const singleDate = block.blocked_date || block.date;
      if (singleDate) dates.add(String(singleDate).slice(0, 10));

      if (block.start_date) {
        const start = new Date(`${block.start_date}T00:00:00Z`);
        const end = block.end_date
          ? new Date(`${block.end_date}T00:00:00Z`)
          : new Date(start.getTime() + 86400000);
        for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
          dates.add(day.toISOString().slice(0, 10));
        }
      }
    });
    return Array.from(dates);
  } catch (error) {
    console.error('Error fetching blocked dates:', error);
    return [];
  }
}

// Refresh external calendars before availability is shown or a direct booking
// is accepted. The server holds the private iCal URLs; the browser only asks
// it to update the property's cached blocked dates.
async function syncExternalCalendars(propertyId) {
  if (!propertyId) return false;
  try {
    const response = await fetch(`/api/ical?sync=true&property_id=${encodeURIComponent(propertyId)}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Calendar sync returned ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Calendar sync failed');
    return true;
  } catch (error) {
    console.warn('External calendar refresh failed; using the latest saved availability.', error);
    return false;
  }
}

async function addBlockedDate(propertyId, date, reason = '') {
  try {
    const { data, error } = await supabaseClient
      .from('blocked_dates')
      .insert([{ property_id: propertyId, blocked_date: date, reason }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding blocked date:', error);
    throw error;
  }
}

async function removeBlockedDate(blockedDateId) {
  try {
    const { data, error } = await supabaseClient
      .from('blocked_dates')
      .delete()
      .eq('id', blockedDateId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing blocked date:', error);
    throw error;
  }
}

// ============================================
// CONTACT MESSAGE FUNCTIONS
// ============================================

async function createContactMessage(propertyId, senderName, senderEmail, message) {
  try {
    const { data, error } = await supabaseClient
      .from('contact_messages')
      .insert([{
        property_id: propertyId,
        sender_name: senderName,
        sender_email: senderEmail,
        message: message
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating contact message:', error);
    throw error;
  }
}

async function getContactMessages(propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from('contact_messages')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    return [];
  }
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function signUpAdmin(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}

async function signInAdmin(email, password) {
  try {
    if (!supabaseClient) {
      throw new Error('Supabase client failed to load! Your browser or adblocker may be blocking it (cdn.jsdelivr.net). Please disable your adblocker or try a different browser.');
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

async function signOutAdmin() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

async function resetAdminPassword(email) {
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateNights(checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const timeDiff = checkOutDate - checkInDate;
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(1, daysDiff);
}

function calculateTotalPrice(pricePerNight, nights, numGuests = 1) {
  return pricePerNight * nights;
}

function formatCurrency(amount, currency = 'USD') {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  });
  return formatter.format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// ============================================
// PRICING RULES FUNCTIONS
// ============================================

async function getPricingRules(propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from('pricing_rules')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    return [];
  }
}

async function addPricingRule(propertyId, rule) {
  try {
    const { data, error } = await supabaseClient
      .from('pricing_rules')
      .insert([{ property_id: propertyId, ...rule }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding pricing rule:', error);
    throw error;
  }
}

async function removePricingRule(ruleId) {
  try {
    const { error } = await supabaseClient
      .from('pricing_rules')
      .delete()
      .eq('id', ruleId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing pricing rule:', error);
    throw error;
  }
}

// ============================================
// PROPERTY UPDATE FUNCTIONS
// ============================================

async function updatePropertyDetails(propertyId, updates) {
  try {
    const { data, error } = await supabaseClient
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating property details:', error);
    throw error;
  }
}

// ============================================
// SITE CONTENT (CMS) FUNCTIONS
// ============================================

async function getAllSiteContent() {
  try {
    const { data, error } = await supabaseClient
      .from('site_content')
      .select('section, content');
    if (error) throw error;
    const result = {};
    (data || []).forEach(row => {
      result[row.section] = row.content;
    });
    return result;
  } catch (error) {
    console.error('Error fetching site content:', error);
    return {};
  }
}

async function saveSiteContentSection(section, content) {
  try {
    const { data, error } = await supabaseClient
      .from('site_content')
      .upsert({
        section: section,
        content: content,
        updated_at: new Date().toISOString()
      }, { onConflict: 'section' })
      .select();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error saving site content for section ${section}:`, error);
    throw error;
  }
}

async function uploadPhotoToStorage(file) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `gallery/${fileName}`;
    const { data, error } = await supabaseClient.storage
      .from('property-photos')
      .upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabaseClient.storage
      .from('property-photos')
      .getPublicUrl(filePath);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}


