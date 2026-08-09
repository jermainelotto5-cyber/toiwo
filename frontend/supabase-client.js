// ============================================
// Supabase Client Setup & Helper Functions
// ============================================

// Initialize Supabase Client
const SUPABASE_URL = 'https://kzpdoxmooddkujtntvlf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cGRveG1vb2Rka3VqdG50dmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5OTk0NzIsImV4cCI6MjA2NTU3NTQ3Mn0.NWXK5Z0ZL8-aZ5c_J5v8gX_t6Q5K5L5M5N5O5P5Q5R';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// PROPERTY FUNCTIONS
// ============================================

async function getProperty(propertyId = null) {
  try {
    let query = supabase.from('properties').select('*');
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('property_id', propertyId);
    if (error) throw error;
    return data.map(d => d.blocked_date);
  } catch (error) {
    console.error('Error fetching blocked dates:', error);
    return [];
  }
}

async function addBlockedDate(propertyId, date, reason = '') {
  try {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase.auth.signUp({
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
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase
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
    const { data, error } = await supabase
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
// SUPABASE STORAGE PHOTO UPLOAD
// ============================================

async function uploadPhotoToStorage(file) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `gallery/${fileName}`;
    const { data, error } = await supabase.storage
      .from('property-photos')
      .upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage
      .from('property-photos')
      .getPublicUrl(filePath);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}
