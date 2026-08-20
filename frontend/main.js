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
    const res = await fetch('/api/content');
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
    }
    // Only render gallery from DB if no CMS gallery was set
    if (!siteContent.gallery || siteContent.gallery.length === 0) {
      renderGallery(currentAdminSettings?.gallery_images || []);
    }
    updateContactDetails();
  } catch (error) {
    console.error('Error initializing app:', error);
    if (!siteContent.gallery || siteContent.gallery.length === 0) {
      renderGallery([]);
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
    // Normalise: could be { url, caption } objects or plain strings
    photoList = photos.map((p, i) => ({
      src: typeof p === 'string' ? p : (p.url || p.src || ''),
      label: typeof p === 'string' ? `Photo ${i + 1}` : (p.caption || p.label || `Photo ${i + 1}`)
    })).filter(p => p.src);
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
      seeAllBtn.onclick = () => { renderGalleryGrid(photoList); seeAllBtn.style.display = 'none'; };
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
  const checkIn = document.getElementById('heroCheckIn').value;
  const checkOut = document.getElementById('heroCheckOut').value;

  if (!checkIn || !checkOut) { alert('Please select check-in and check-out dates.'); return; }
  if (new Date(checkOut) <= new Date(checkIn)) { alert('Check-out date must be after check-in date.'); return; }

  try {
    const isAvailable = await checkAvailability(currentProperty.id, checkIn, checkOut);
    if (isAvailable) {
      document.getElementById('bookingCheckIn').value = checkIn;
      document.getElementById('bookingCheckOut').value = checkOut;
      document.getElementById('bookingGuests').value = document.getElementById('heroGuests').value;
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
    } else {
      alert('These dates are not available. Please choose different dates.');
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    alert('Error checking availability.');
  }
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

  if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
    if (subtotalEl) subtotalEl.textContent = '$0';
    if (totalEl) totalEl.textContent = '$0';
    return;
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
