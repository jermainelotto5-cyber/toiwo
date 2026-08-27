// ============================================
// MAIN FRONTEND APPLICATION
// ============================================

let currentProperty = null;
let currentAdminSettings = null;
let siteContent = {}; // loaded from /api/content

const NIGHTLY_RATE = 180;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Load dynamic content from the admin CMS first
  await loadSiteContent();
  await initializeApp();
  setupEventListeners();
  setupScrollSpy();
});

async function loadSiteContent() {
  try {
    const res = await fetch('/api/content?t=' + Date.now());
    if (res.ok) {
      siteContent = await res.json();
      applySiteContent();
    }
  } catch (e) {
    console.warn('Could not load site content, using static fallback.', e);
  }
}

function applySiteContent() {
  // --- HERO ---
  const hero = siteContent.hero || {};
  setText('heroLocationTag', hero.location_tag);
  setText('heroHeadline', hero.headline);
  setText('heroSubHeadline', hero.sub_headline);
  setText('heroCtaPrimary', hero.cta_primary_label);
  setText('heroCtaSecondary', hero.cta_secondary_label);

  // --- ABOUT ---
  const about = siteContent.about || {};
  setText('aboutEyebrow', about.eyebrow);
  setText('aboutHeadline', about.headline);
  setText('aboutLead', about.lead);
  setText('aboutBody', about.body);
  setText('aboutCaption', about.photo_caption);
  if (about.photo_url) {
    const photoEl = document.getElementById('aboutPhotoEl');
    if (photoEl) {
      photoEl.style.backgroundImage = "linear-gradient(180deg, rgba(35, 41, 31, 0.15), rgba(35, 41, 31, 0.02)), url('" + about.photo_url + "')";
    }
  }
  if (about.pills && Array.isArray(about.pills)) {
    const pillsEl = document.getElementById('aboutPills');
    if (pillsEl) {
      pillsEl.innerHTML = about.pills.map(p => `<span class="pill">${p}</span>`).join('');
    }
  }

  // --- AMENITIES ---
  if (siteContent.amenities && Array.isArray(siteContent.amenities)) {
    const grid = document.getElementById('amenitiesGrid') || document.querySelector('.amen-grid');
    if (grid) {
      const icons = ['◈', '▤', '⛊', '♨', '▭', '↻', '☾', '✤', '◉', '◎', '⬡', '▣'];
      grid.innerHTML = siteContent.amenities.map((a, i) => `
        <div class="amen-item">
          <p><span class="amen-check">✓</span> <strong>${a.name}</strong>${a.description ? ' – ' + a.description : ''}</p>
        </div>
      `).join('');
    }
  }

  // --- REVIEWS ---
  if (siteContent.reviews && Array.isArray(siteContent.reviews)) {
    const grid = document.getElementById('reviewsGrid');
    if (grid) {
      grid.innerHTML = siteContent.reviews.map(r => `
        <div class="rev-card">
          <div class="stars">${'★'.repeat(r.stars || 5)}</div>
          <p>"${r.quote}"</p>
          <div class="who">
            <div class="avatar">${r.initials || r.author.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>
            <div class="who-meta"><strong>${r.author}</strong> – ${r.trip_type}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // --- CONTACT ---
  const contact = siteContent.contact || {};
  if (contact.phone) {
    const phoneEl = document.getElementById('contactPhoneText');
    if (phoneEl) { phoneEl.textContent = contact.phone; phoneEl.href = `tel:${contact.phone.replace(/\D/g, '')}`; }
  }
  if (contact.whatsapp) {
    const waEl = document.getElementById('contactWhatsAppText');
    if (waEl) { waEl.textContent = contact.whatsapp; waEl.href = `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`; }
  }
  if (contact.email) {
    const emEl = document.getElementById('contactEmailText');
    if (emEl) { emEl.textContent = contact.email; emEl.href = `mailto:${contact.email}`; }
  }

  // --- SOCIAL ---
  const social = siteContent.social || {};
  setHref('footerInstagram', social.instagram);
  setHref('footerFacebook', social.facebook);
  setHref('footerWhatsApp', social.whatsapp);

  // --- FOOTER ---
  const footer = siteContent.footer || {};
  setText('footerTagline', footer.tagline);

  // --- PROPERTY DETAILS ---
  const prop = siteContent.property || {};
  if (prop.bedrooms) setText('detailBedrooms', prop.bedrooms);
  if (prop.beds) setText('detailBeds', prop.beds);
  if (prop.bathrooms) setText('detailBathrooms', prop.bathrooms);
  if (prop.max_guests) setText('detailMaxGuests', prop.max_guests);
  if (prop.price_per_night) {
    setText('heroPrice', `$${prop.price_per_night}`);
    window.NIGHTLY_RATE = prop.price_per_night;
  }

  // --- GALLERY ---
  if (siteContent.gallery && siteContent.gallery.length > 0) {
    renderGallery(siteContent.gallery);
  }
}

function setText(id, value) {
  if (!value) return;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHref(id, value) {
  if (!value) return;
  const el = document.getElementById(id);
  if (el) el.href = value;
}

async function initializeApp() {
  try {
    currentProperty = await getPropertyByName('Toiwo Residence');
    if (currentProperty) {
      currentAdminSettings = await getAdminSettings(currentProperty.id);
      renderPropertyData();
    await initAvailabilityCalendar();
    }
    // Only render gallery from DB if no CMS gallery was set
    if (!siteContent.gallery || siteContent.gallery.length === 0) {
      const dbImgs = currentAdminSettings?.gallery_images || [];
      renderGallery(dbImgs.length > 0 ? dbImgs : [
  {
    "src": "/pics/exterior-day.jpg",
    "label": "Exterior"
  },
  {
    "src": "/pics/living-room.jpg",
    "label": "Living Room"
  },
  {
    "src": "/pics/dining-room.jpg",
    "label": "Dining Room"
  },
  {
    "src": "/pics/night-exterior.jpg",
    "label": "Night Exterior"
  },
  {
    "src": "/pics/kitchen.jpg",
    "label": "Kitchen"
  },
  {
    "src": "/pics/bedroom.jpg",
    "label": "Master Bedroom"
  },
  {
    "src": "/pics/bedroom-2.jpg",
    "label": "Guest Bedroom 1"
  },
  {
    "src": "/pics/bedroom-3.jpg",
    "label": "Guest Bedroom 2"
  },
  {
    "src": "/pics/bathroom.jpg",
    "label": "Main Bathroom"
  },
  {
    "src": "/pics/bathroom-2.jpg",
    "label": "Ensuite Bathroom"
  },
  {
    "src": "/pics/backyard.jpg",
    "label": "Private Garden & Backyard"
  },
  {
    "src": "/pics/outdoor-lounge.jpg",
    "label": "Outdoor Lounge"
  },
  {
    "src": "/pics/study.jpg",
    "label": "Study & Work Area"
  },
  {
    "src": "/pics/hallway.jpg",
    "label": "Arched Hallway"
  },
  {
    "src": "/pics/entryway.jpg",
    "label": "Gated Entryway"
  },
  {
    "src": "/pics/laundry.jpg",
    "label": "Laundry"
  }
]);
    }
    updateContactDetails();
  } catch (error) {
    console.error('Error initializing app:', error);
    if (!siteContent.gallery || siteContent.gallery.length === 0) {
      renderGallery([
  {
    "src": "/pics/exterior-day.jpg",
    "label": "Exterior"
  },
  {
    "src": "/pics/living-room.jpg",
    "label": "Living Room"
  },
  {
    "src": "/pics/dining-room.jpg",
    "label": "Dining Room"
  },
  {
    "src": "/pics/night-exterior.jpg",
    "label": "Night Exterior"
  },
  {
    "src": "/pics/kitchen.jpg",
    "label": "Kitchen"
  },
  {
    "src": "/pics/bedroom.jpg",
    "label": "Master Bedroom"
  },
  {
    "src": "/pics/bedroom-2.jpg",
    "label": "Guest Bedroom 1"
  },
  {
    "src": "/pics/bedroom-3.jpg",
    "label": "Guest Bedroom 2"
  },
  {
    "src": "/pics/bathroom.jpg",
    "label": "Main Bathroom"
  },
  {
    "src": "/pics/bathroom-2.jpg",
    "label": "Ensuite Bathroom"
  },
  {
    "src": "/pics/backyard.jpg",
    "label": "Private Garden & Backyard"
  },
  {
    "src": "/pics/outdoor-lounge.jpg",
    "label": "Outdoor Lounge"
  },
  {
    "src": "/pics/study.jpg",
    "label": "Study & Work Area"
  },
  {
    "src": "/pics/hallway.jpg",
    "label": "Arched Hallway"
  },
  {
    "src": "/pics/entryway.jpg",
    "label": "Gated Entryway"
  },
  {
    "src": "/pics/laundry.jpg",
    "label": "Laundry"
  }
]);
    }
    updateTotalPrice();
  }
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderPropertyData() {
  if (!currentProperty) return;
  updateContactDetails();
}

function renderGallery(photos = []) {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  let photoList = [];

  if (Array.isArray(photos) && photos.length > 0) {
    photoList = photos.map((p, i) => ({
      src: typeof p === 'string' ? p : (p.url || p.src || ''),
      label: typeof p === 'string' ? `Photo ${i + 1}` : (p.caption || p.label || `Photo ${i + 1}`)
    })).filter(p => p.src);
  }

  const default16Photos = [
  {
    "src": "/pics/exterior-day.jpg",
    "label": "Exterior"
  },
  {
    "src": "/pics/living-room.jpg",
    "label": "Living Room"
  },
  {
    "src": "/pics/dining-room.jpg",
    "label": "Dining Room"
  },
  {
    "src": "/pics/night-exterior.jpg",
    "label": "Night Exterior"
  },
  {
    "src": "/pics/kitchen.jpg",
    "label": "Kitchen"
  },
  {
    "src": "/pics/bedroom.jpg",
    "label": "Master Bedroom"
  },
  {
    "src": "/pics/bedroom-2.jpg",
    "label": "Guest Bedroom 1"
  },
  {
    "src": "/pics/bedroom-3.jpg",
    "label": "Guest Bedroom 2"
  },
  {
    "src": "/pics/bathroom.jpg",
    "label": "Main Bathroom"
  },
  {
    "src": "/pics/bathroom-2.jpg",
    "label": "Ensuite Bathroom"
  },
  {
    "src": "/pics/backyard.jpg",
    "label": "Private Garden & Backyard"
  },
  {
    "src": "/pics/outdoor-lounge.jpg",
    "label": "Outdoor Lounge"
  },
  {
    "src": "/pics/study.jpg",
    "label": "Study & Work Area"
  },
  {
    "src": "/pics/hallway.jpg",
    "label": "Arched Hallway"
  },
  {
    "src": "/pics/entryway.jpg",
    "label": "Gated Entryway"
  },
  {
    "src": "/pics/laundry.jpg",
    "label": "Laundry"
  }
];
  if (photoList.length < 5) {
    const existingSrcs = new Set(photoList.map(p => p.src));
    default16Photos.forEach(dp => {
      if (!existingSrcs.has(dp.src)) photoList.push(dp);
    });
  }

  if (photoList.length === 0) {
    galleryGrid.innerHTML = '<p style="color:var(--ink-soft); padding: 20px;">No gallery photos yet. Add some in the Admin panel.</p>';
    return;
  }

  renderGalleryGrid(photoList.slice(0, 4));

  const seeAllBtn = document.getElementById('seeAllGalleryBtn');
  if (seeAllBtn) {
    if (photoList.length > 4) {
      seeAllBtn.style.display = 'inline-flex';
      seeAllBtn.textContent = `See More ▼`;
      let isExpanded = false;

      seeAllBtn.onclick = () => {
        if (!isExpanded) {
          renderGalleryGrid(photoList);
          seeAllBtn.textContent = 'See Less ▲';
          isExpanded = true;
        } else {
          renderGalleryGrid(photoList.slice(0, 4));
          seeAllBtn.textContent = `See More ▼`;
          isExpanded = false;
          const galSection = document.getElementById('gallery');
          if (galSection) galSection.scrollIntoView({ behavior: 'smooth' });
        }
      };
    } else {
      seeAllBtn.style.display = 'none';
    }
  }
}

function renderGalleryGrid(photos) {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;
  galleryGrid.innerHTML = photos.map(({ src, label }) => `
    <div class="gal-item">
      <img src="${src}" alt="${label}" loading="lazy" />
      <span>${label}</span>
    </div>
  `).join('');
}

function updateContactDetails() {
  if (!currentProperty && !currentAdminSettings && !siteContent.contact) return;
  const contact = siteContent.contact || {};
  const settings = currentAdminSettings || {};
  const phone = contact.phone || settings.contact_phone || currentProperty?.host_phone || '+255 718 654 332';
  const whatsapp = contact.whatsapp || settings.contact_whatsapp || currentProperty?.host_whatsapp || '+255 718 654 332';
  const email = contact.email || settings.contact_email || currentProperty?.host_email || 'jermainelotto5@gmail.com';

  const phoneEl = document.getElementById('contactPhoneText');
  const whatsappEl = document.getElementById('contactWhatsAppText');
  const emailEl = document.getElementById('contactEmailText');

  if (phoneEl) { phoneEl.textContent = phone; phoneEl.href = `tel:${phone.replace(/\D/g, '')}`; }
  if (whatsappEl) { whatsappEl.textContent = whatsapp; whatsappEl.href = `https://wa.me/${whatsapp.replace(/\D/g, '')}`; }
  if (emailEl) { emailEl.textContent = email; emailEl.href = `mailto:${email}`; }
}

// ============================================
// BOOKING FORM FUNCTIONS
// ============================================

async function submitBooking() {
  const checkIn = document.getElementById('bookingCheckIn').value;
  const checkOut = document.getElementById('bookingCheckOut').value;
  const guestCount = document.getElementById('bookingGuests').value;
  const name = document.getElementById('bookingName').value;
  const email = document.getElementById('bookingEmail').value;
  const phone = document.getElementById('bookingPhone')?.value || '';
  const notes = document.getElementById('bookingNotes').value;

  if (!checkIn || !checkOut || !guestCount || !name || !email) {
    alert('Please fill in all required fields.');
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    alert('Check-out date must be after check-in date.');
    return;
  }

  try {
    // Recheck Airbnb and Booking.com before the final database availability
    // check so a newly imported reservation cannot be double-booked.
    await syncExternalCalendars(currentProperty.id);
    const isAvailable = await checkAvailability(currentProperty.id, checkIn, checkOut);
    if (!isAvailable) {
      alert('These dates are not available. Please choose different dates.');
      return;
    }

    const nights = calculateNights(checkIn, checkOut);
    const totalPrice = await calculatePriceForDates(checkIn, checkOut);

    const bookingData = {
      property_id: currentProperty.id,
      guest_name: name,
      guest_email: email,
      guest_phone: phone,
      check_in: checkIn,
      check_out: checkOut,
      num_guests: parseInt(guestCount),
      special_requests: notes,
      total_price: totalPrice,
      status: 'pending',
      payment_status: 'unpaid'
    };

    const booking = await createBooking(bookingData);
    showBookingConfirmation(booking, totalPrice, nights);
  } catch (error) {
    console.error('Error submitting booking:', error);
    alert('Error creating booking. Please try again.');
  }
}

function showBookingConfirmation(booking, totalPrice, nights) {
  const bookingForm = document.getElementById('bookingForm');
  const paymentSlot = document.getElementById('paymentSlot');
  if (bookingForm) bookingForm.style.display = 'none';
  if (paymentSlot) paymentSlot.style.display = 'block';
}

async function checkAvailabilityFromHero() {
  const checkIn = document.getElementById('heroCheckIn')?.value;
  const checkOut = document.getElementById('heroCheckOut')?.value;
  const guests = document.getElementById('heroGuests')?.value;

  if (document.getElementById('bookingGuests') && guests) {
    document.getElementById('bookingGuests').value = guests;
  }

  if (!checkIn || !checkOut) {
    // Open big calendar modal to pick dates
    openCalendarModal();
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    alert('Check-out date must be after check-in date.');
    return;
  }

  document.getElementById('bookingCheckIn').value = checkIn;
  document.getElementById('bookingCheckOut').value = checkOut;

  await initAvailabilityCalendar({ syncExternal: true });

  const isAvail = checkRangeAvailability(checkIn, checkOut);

  if (!isAvail) {
    // Dates are booked! Pop up Big Calendar Modal
    openCalendarModal();
    const sub = document.getElementById('modalSelectedDatesSub');
    if (sub) sub.innerHTML = '<span style="color:var(--error); font-weight:700;">⚠️ Selected dates (' + checkIn + ' to ' + checkOut + ') are ALREADY BOOKED!</span> See taken dates in red/gray below.';
  } else {
    // Available! Scroll to booking form and update total
    updateTotalPrice();
    const bookSec = document.getElementById('booking');
    if (bookSec) bookSec.scrollIntoView({ behavior: 'smooth' });
  }
}

function checkRangeAvailability(checkIn, checkOut) {
  if (!checkIn || !checkOut) return true;
  let curr = new Date(checkIn);
  const end = new Date(checkOut);
  while (curr < end) {
    const dateStr = curr.toISOString().split('T')[0];
    if (allBlockedDateStrings.includes(dateStr)) {
      return false; // Found a booked date
    }
    curr.setDate(curr.getDate() + 1);
  }
  return true;
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'bookingCheckIn' || e.target.id === 'bookingCheckOut') updateTotalPrice();
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'bookingCheckIn' || e.target.id === 'bookingCheckOut') updateTotalPrice();
});

async function calculatePriceForDates(checkIn, checkOut) {
  if (!currentProperty) return 0;
  try {
    const rules = await getPricingRules(currentProperty.id);
    const basePrice = parseFloat(currentProperty.price_per_night || siteContent.property?.price_per_night || 180);
    let totalPrice = 0;
    let current = new Date(checkIn);
    const end = new Date(checkOut);
    while (current < end) {
      const dateStr = current.toISOString().split('T')[0];
      const rule = rules.find(r => dateStr >= r.start_date && dateStr <= r.end_date);
      totalPrice += rule ? parseFloat(rule.price_per_night) : basePrice;
      current.setDate(current.getDate() + 1);
    }
    return totalPrice;
  } catch (error) {
    const base = parseFloat(siteContent.property?.price_per_night || 180);
    return calculateNights(checkIn, checkOut) * base;
  }
}

function updateTotalPrice() {
  const checkIn = document.getElementById('bookingCheckIn')?.value;
  const checkOut = document.getElementById('bookingCheckOut')?.value;
  const subtotalEl = document.getElementById('subtotalPrice');
  const totalEl = document.getElementById('totalPrice');
  const msgEl = document.getElementById('bookingMessage');

  if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
    if (subtotalEl) subtotalEl.textContent = '$0';
    if (totalEl) totalEl.textContent = '$0';
    if (msgEl) msgEl.style.display = 'none';
    return;
  }

  // Check if dates are available
  const isAvail = checkRangeAvailability(checkIn, checkOut);
  if (!isAvail) {
    if (subtotalEl) subtotalEl.textContent = '$0';
    if (totalEl) totalEl.textContent = '$0';
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.innerHTML = '<span style="color:var(--error); font-weight:700;">⚠️ Selected dates are ALREADY BOOKED!</span> Opening calendar...';
    }
    openCalendarModal();
    return;
  } else {
    if (msgEl) msgEl.style.display = 'none';
  }

  const rate = siteContent.property?.price_per_night || NIGHTLY_RATE;
  const nights = calculateNights(checkIn, checkOut);
  const total = nights * rate;
  const formatted = formatCurrency(total);
  if (subtotalEl) subtotalEl.textContent = formatted;
  if (totalEl) totalEl.textContent = formatted;
}

// ============================================
// CONTACT FORM FUNCTIONS
// ============================================

async function submitContactForm(event) {
  event.preventDefault();
  const name = document.getElementById('contactName').value;
  const email = document.getElementById('contactEmailInput').value;
  const message = document.getElementById('contactMessage').value;
  const statusEl = document.getElementById('contactFormMessage');

  if (!name || !email || !message) {
    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '<span style="color:var(--error);">Please fill in all fields.</span>'; }
    return;
  }

  try {
    if (currentProperty) {
      await createContactMessage(currentProperty.id, name, email, message);
    }
    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '<span style="color:var(--success);">Message sent! We\'ll reply soon.</span>'; }
    event.target.reset();
    setTimeout(() => { if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = ''; } }, 5000);
  } catch (error) {
    console.error('Error submitting contact message:', error);
    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '<span style="color:var(--error);">Error sending message. Please try again.</span>'; }
  }
}

// ============================================
// NAVIGATION & SCROLL SPY
// ============================================

function setupScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('nav a[data-section]');
  window.addEventListener('scroll', () => {
    let currentSection = '';
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 150) currentSection = section.getAttribute('id');
    });
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === currentSection) link.classList.add('active');
    });
  });
}

function setupEventListeners() {
  const header = document.getElementById('siteHeader');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  });

  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  if (navToggle) navToggle.addEventListener('click', () => siteNav.classList.toggle('open'));

  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => siteNav.classList.remove('open'));
  });

  const checkInEl = document.getElementById('bookingCheckIn');
  const checkOutEl = document.getElementById('bookingCheckOut');
  if (checkInEl) { checkInEl.addEventListener('change', updateTotalPrice); checkInEl.addEventListener('input', updateTotalPrice); }
  if (checkOutEl) { checkOutEl.addEventListener('change', updateTotalPrice); checkOutEl.addEventListener('input', updateTotalPrice); }

  updateTotalPrice();
}

// ============================================
// AIRBNB-STYLE AVAILABILITY CALENDAR
// ============================================

let allBlockedDateStrings = [];
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();
let selectedCheckInDate = null;
let selectedCheckOutDate = null;

async function initAvailabilityCalendar({ syncExternal = true } = {}) {
  const container = document.getElementById('availabilityCalendarContainer');

  try {
    const propId = currentProperty?.id || '8156fa77-dd4b-4af5-ab19-646920f7a3ca';
    if (syncExternal) await syncExternalCalendars(propId);
    const [dates, allBookings] = await Promise.all([
      getBlockedDates(propId),
      getAllBookings(propId)
    ]);
    
    // Expand confirmed bookings into date strings
    const bookingDates = [];
    allBookings.forEach(b => {
      if (b.status === 'confirmed' || b.status === 'pending') {
        let curr = new Date(b.check_in);
        const end = new Date(b.check_out);
        while (curr < end) {
          bookingDates.push(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
      }
    });
    
    allBlockedDateStrings = Array.from(new Set([...dates, ...bookingDates]));
  } catch (e) {
    console.warn('Could not load blocked dates for calendar widget:', e);
  }

  renderAvailabilityCalendar();
}

function renderAvailabilityCalendar() {
  const container = document.getElementById('availabilityCalendarContainer');
  if (!container) return;

  const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1);
  const lastDay = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0);
  const startingDay = firstDay.getDay();
  const monthDays = lastDay.getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[calendarCurrentMonth];

  let daysHtml = '';
  for (let i = 0; i < startingDay; i++) {
    daysHtml += '<div class="cal-day empty"></div>';
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let day = 1; day <= monthDays; day++) {
    const d = new Date(calendarCurrentYear, calendarCurrentMonth, day);
    const dateStr = d.toISOString().split('T')[0];
    const isPast = dateStr < todayStr;
    const isBooked = allBlockedDateStrings.includes(dateStr) || isPast;

    let dayClass = isBooked ? 'booked' : 'available';
    if (selectedCheckInDate === dateStr) dayClass += ' selected-start';
    else if (selectedCheckOutDate === dateStr) dayClass += ' selected-end';
    else if (selectedCheckInDate && selectedCheckOutDate && dateStr > selectedCheckInDate && dateStr < selectedCheckOutDate) {
      dayClass += ' selected-range';
    }

    daysHtml += `
      <div class="cal-day ${dayClass}" data-date="${dateStr}" ${!isBooked ? `onclick="handleCalendarDayClick('${dateStr}')"` : ''}>
        ${day}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="availability-calendar-box">
      <div class="cal-header">
        <button type="button" class="cal-nav-btn" onclick="changeCalendarMonth(-1)">‹ Prev</button>
        <div class="cal-month-title">${monthName} ${calendarCurrentYear}</div>
        <button type="button" class="cal-nav-btn" onclick="changeCalendarMonth(1)">Next ›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-day-header">Su</div>
        <div class="cal-day-header">Mo</div>
        <div class="cal-day-header">Tu</div>
        <div class="cal-day-header">We</div>
        <div class="cal-day-header">Th</div>
        <div class="cal-day-header">Fr</div>
        <div class="cal-day-header">Sa</div>
        ${daysHtml}
      </div>
      <div class="cal-legend">
        <div class="cal-legend-item"><span class="cal-dot available"></span> Available</div>
        <div class="cal-legend-item"><span class="cal-dot booked"></span> Booked / Taken</div>
        <div class="cal-legend-item"><span class="cal-dot selected"></span> Selected</div>
      </div>
      <div id="calendarNotice" style="font-size: 13px; font-weight: 600; text-align: center; margin-top: 10px; color: var(--clay);"></div>
    </div>
  `;
}

function changeCalendarMonth(delta) {
  calendarCurrentMonth += delta;
  if (calendarCurrentMonth > 11) {
    calendarCurrentMonth = 0;
    calendarCurrentYear++;
  } else if (calendarCurrentMonth < 0) {
    calendarCurrentMonth = 11;
    calendarCurrentYear--;
  }
  renderAvailabilityCalendar();
}

function handleCalendarDayClick(dateStr) {
  const noticeEl = document.getElementById('calendarNotice');

  if (!selectedCheckInDate || (selectedCheckInDate && selectedCheckOutDate)) {
    selectedCheckInDate = dateStr;
    selectedCheckOutDate = null;
    const inEl = document.getElementById('bookingCheckIn');
    const outEl = document.getElementById('bookingCheckOut');
    if (inEl) inEl.value = dateStr;
    if (outEl) outEl.value = '';
    if (noticeEl) noticeEl.textContent = 'Now click check-out date on calendar';
  } else if (selectedCheckInDate && !selectedCheckOutDate) {
    if (dateStr <= selectedCheckInDate) {
      selectedCheckInDate = dateStr;
      const inEl = document.getElementById('bookingCheckIn');
      if (inEl) inEl.value = dateStr;
      if (noticeEl) noticeEl.textContent = 'Now click check-out date on calendar';
    } else {
      let curr = new Date(selectedCheckInDate);
      const end = new Date(dateStr);
      let hasConflict = false;

      while (curr < end) {
        const checkStr = curr.toISOString().split('T')[0];
        if (allBlockedDateStrings.includes(checkStr)) {
          hasConflict = true;
          break;
        }
        curr.setDate(curr.getDate() + 1);
      }

      if (hasConflict) {
        if (noticeEl) noticeEl.textContent = '⚠️ Range includes booked dates. Pick open dates.';
        return;
      }

      selectedCheckOutDate = dateStr;
      const outEl = document.getElementById('bookingCheckOut');
      if (outEl) outEl.value = dateStr;
      if (noticeEl) noticeEl.textContent = '✓ Dates selected! Complete details below to reserve.';
      updateTotalPrice();
    }
  }

  renderAvailabilityCalendar();
}

// ============================================
// BIG MODAL AVAILABILITY CALENDAR (AIRBNB STYLE)
// ============================================

function openCalendarModal() {
  const modal = document.getElementById('calendarModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderModalCalendar();
  }
}

function closeCalendarModal() {
  const modal = document.getElementById('calendarModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function handleModalOverlayClick(event) {
  if (event.target && event.target.id === 'calendarModal') {
    closeCalendarModal();
  }
}

function renderModalCalendar() {
  const container = document.getElementById('modalCalendarContainer');
  if (!container) return;

  const m1Month = calendarCurrentMonth;
  const m1Year = calendarCurrentYear;
  const m2Month = (calendarCurrentMonth === 11) ? 0 : calendarCurrentMonth + 1;
  const m2Year = (calendarCurrentMonth === 11) ? calendarCurrentYear + 1 : calendarCurrentYear;

  const htmlMonth1 = buildSingleMonthHtml(m1Year, m1Month);
  const htmlMonth2 = buildSingleMonthHtml(m2Year, m2Month);

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <button type="button" class="cal-nav-btn" onclick="changeCalendarMonth(-1); renderModalCalendar();">‹ Prev Month</button>
      <button type="button" class="cal-nav-btn" onclick="changeCalendarMonth(1); renderModalCalendar();">Next Month ›</button>
    </div>
    <div class="modal-months-row">
      ${htmlMonth1}
      ${htmlMonth2}
    </div>
    <div class="cal-legend" style="margin-top:20px;">
      <div class="cal-legend-item"><span class="cal-dot available"></span> Available</div>
      <div class="cal-legend-item"><span class="cal-dot booked"></span> Booked / Taken</div>
      <div class="cal-legend-item"><span class="cal-dot selected"></span> Selected Range</div>
    </div>
  `;

  updateModalSummaryText();
}

function buildSingleMonthHtml(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const monthDays = lastDay.getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month];

  let daysHtml = '';
  for (let i = 0; i < startingDay; i++) {
    daysHtml += '<div class="cal-day empty"></div>';
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let day = 1; day <= monthDays; day++) {
    const d = new Date(year, month, day);
    const dateStr = d.toISOString().split('T')[0];
    const isPast = dateStr < todayStr;
    const isBooked = allBlockedDateStrings.includes(dateStr) || isPast;

    let dayClass = isBooked ? 'booked' : 'available';
    if (selectedCheckInDate === dateStr) dayClass += ' selected-start';
    else if (selectedCheckOutDate === dateStr) dayClass += ' selected-end';
    else if (selectedCheckInDate && selectedCheckOutDate && dateStr > selectedCheckInDate && dateStr < selectedCheckOutDate) {
      dayClass += ' selected-range';
    }

    daysHtml += `
      <div class="cal-day ${dayClass}" data-date="${dateStr}" ${!isBooked ? `onclick="handleCalendarDayClick('${dateStr}'); renderModalCalendar();"` : ''}>
        ${day}
      </div>
    `;
  }

  return `
    <div class="availability-calendar-box" style="margin-bottom:0;">
      <div class="cal-month-title" style="text-align:center; margin-bottom:12px;">${monthName} ${year}</div>
      <div class="cal-grid">
        <div class="cal-day-header">Su</div>
        <div class="cal-day-header">Mo</div>
        <div class="cal-day-header">Tu</div>
        <div class="cal-day-header">We</div>
        <div class="cal-day-header">Th</div>
        <div class="cal-day-header">Fr</div>
        <div class="cal-day-header">Sa</div>
        ${daysHtml}
      </div>
    </div>
  `;
}

function updateModalSummaryText() {
  const footerSummary = document.getElementById('modalFooterSummary');
  const headerSub = document.getElementById('modalSelectedDatesSub');

  if (selectedCheckInDate && selectedCheckOutDate) {
    const nights = calculateNights(selectedCheckInDate, selectedCheckOutDate);
    const rate = siteContent.property?.price_per_night || NIGHTLY_RATE;
    const total = nights * rate;
    const text = `${selectedCheckInDate} → ${selectedCheckOutDate} (${nights} night${nights > 1 ? 's' : ''}) • $${total}`;
    if (footerSummary) footerSummary.textContent = text;
    if (headerSub) headerSub.textContent = `${nights} night stay selected. Click "Apply Selected Dates" to proceed.`;
  } else if (selectedCheckInDate) {
    if (footerSummary) footerSummary.textContent = `Check-in: ${selectedCheckInDate} — Select check-out date`;
    if (headerSub) headerSub.textContent = 'Now click your check-out date on the calendar.';
  } else {
    if (footerSummary) footerSummary.textContent = 'No dates selected';
    if (headerSub) headerSub.textContent = 'Click open dates on the calendar to choose Check-in and Check-out.';
  }
}

function clearModalDates() {
  selectedCheckInDate = null;
  selectedCheckOutDate = null;
  const inEl = document.getElementById('bookingCheckIn');
  const outEl = document.getElementById('bookingCheckOut');
  if (inEl) inEl.value = '';
  if (outEl) outEl.value = '';
  updateTotalPrice();
  renderAvailabilityCalendar();
  renderModalCalendar();
}

function applyModalDates() {
  closeCalendarModal();
  updateTotalPrice();
  const bookSec = document.getElementById('booking');
  if (bookSec) bookSec.scrollIntoView({ behavior: 'smooth' });
}
