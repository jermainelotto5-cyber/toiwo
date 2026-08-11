// ============================================
// MAIN FRONTEND APPLICATION
// ============================================

let currentProperty = null;
let currentAdminSettings = null;

const NIGHTLY_RATE = 180;

const DEFAULT_GALLERY_PHOTOS = [
  { src: '/pics/gallery-new-1.jpg', label: 'Interior' },
  { src: '/pics/gallery-new-2.jpg', label: 'Corridor' },
  { src: '/pics/gallery-new-3.jpg', label: 'Bedroom Front' },
  { src: '/pics/gallery-new-4.jpg', label: 'Bedroom Side' },
  { src: '/pics/living-room.jpg', label: 'Living Room' },
  { src: '/pics/bedroom.jpg', label: 'Bedroom' },
  { src: '/pics/kitchen.jpg', label: 'Kitchen' },
  { src: '/pics/hallway.jpg', label: 'Hallway' },
  { src: '/pics/exterior-entrance.jpg', label: 'Exterior Entrance' },
  { src: '/pics/outdoor-lounge.jpg', label: 'Outdoor Lounge' },
  { src: '/pics/night-exterior.jpg', label: 'Night Exterior' },
  { src: '/pics/hero-new.jpg', label: 'Hero' }
];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
  setupScrollSpy();
});

async function initializeApp() {
  try {
    currentProperty = await getPropertyByName('Toiwo Residence');

    if (currentProperty) {
      currentAdminSettings = await getAdminSettings(currentProperty.id);
      renderPropertyData();
      renderAmenities();
      renderDetails();
    }

    renderGallery(currentAdminSettings?.gallery_images || []);
    updateContactDetails();
  } catch (error) {
    console.error('Error initializing app:', error);
    renderGallery([]);
    updateTotalPrice();
  }
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderPropertyData() {
  if (!currentProperty) return;

  // Update host name
  const hostNameEl = document.getElementById('hostName');
  if (hostNameEl) hostNameEl.textContent = currentProperty.host_name;

  // Update contact details
  updateContactDetails();
}

function renderAmenities() {
  if (!currentProperty) return;

  const amenitiesGrid = document.getElementById('amenitiesGrid');
  if (!amenitiesGrid) return;

  const amenitiesList = currentProperty.amenities || [];
  const amenityIcons = ['◈', '▤', '⛊', '♨', '▭', '↻', '☾', '✤'];

  amenitiesGrid.innerHTML = amenitiesList.map((amenity, index) => `
    <div class="amen-item">
      <div class="amen-icon">${amenityIcons[index] || '✓'}</div>
      <strong>${amenity}</strong>
    </div>
  `).join('');
}

function renderDetails() {
  if (!currentProperty) return;

  const detailsGrid = document.getElementById('detailsGrid');
  if (!detailsGrid) return;

  detailsGrid.innerHTML = `
    <div class="detail-card"><div class="num">${currentProperty.bedrooms}</div><div class="label">Bedrooms</div></div>
    <div class="detail-card"><div class="num">${currentProperty.beds}</div><div class="label">Beds</div></div>
    <div class="detail-card"><div class="num">${currentProperty.bathrooms}</div><div class="label">Bathrooms</div></div>
    <div class="detail-card"><div class="num">${currentProperty.max_guests}</div><div class="label">Max Guests</div></div>
  `;
}

function renderGallery(imageUrls = []) {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  const urls = (imageUrls || []).filter(Boolean);
  let photos = DEFAULT_GALLERY_PHOTOS;

  if (urls.length > 0) {
    photos = urls.map((src, index) => ({
      src,
      label: DEFAULT_GALLERY_PHOTOS[index]?.label || `Photo ${index + 1}`
    }));
  }

  renderGalleryGrid(photos.slice(0, 4));

  const seeAllBtn = document.getElementById('seeAllGalleryBtn');
  if (seeAllBtn) {
    if (photos.length > 4) {
      seeAllBtn.style.display = 'inline-flex';
      seeAllBtn.onclick = () => {
        renderGalleryGrid(photos);
        seeAllBtn.style.display = 'none';
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
  if (!currentProperty && !currentAdminSettings) return;

  const settings = currentAdminSettings || {};
  const phone = settings.contact_phone || currentProperty?.host_phone || '+255 718 654 332';
  const whatsapp = settings.contact_whatsapp || currentProperty?.host_whatsapp || '+255 718 654 332';
  const email = settings.contact_email || currentProperty?.host_email || 'jermainelotto5@gmail.com';

  // Update contact section
  const phoneEl = document.getElementById('contactPhoneText');
  const whatsappEl = document.getElementById('contactWhatsAppText');
  const emailEl = document.getElementById('contactEmailText');

  if (phoneEl) {
    phoneEl.textContent = phone;
    phoneEl.href = `tel:${phone.replace(/\D/g, '')}`;
  }
  if (whatsappEl) {
    whatsappEl.textContent = whatsapp;
    whatsappEl.href = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
  }
  if (emailEl) {
    emailEl.textContent = email;
    emailEl.href = `mailto:${email}`;
  }
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
  const phone = document.getElementById('bookingPhone').value;
  const notes = document.getElementById('bookingNotes').value;

  // Validation
  if (!checkIn || !checkOut || !guestCount || !name || !email) {
    alert('Please fill in all required fields.');
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    alert('Check-out date must be after check-in date.');
    return;
  }

  try {
    // Check availability
    const isAvailable = await checkAvailability(currentProperty.id, checkIn, checkOut);
    if (!isAvailable) {
      alert('These dates are not available. Please choose different dates.');
      return;
    }

    // Calculate total price
    const nights = calculateNights(checkIn, checkOut);
    const totalPrice = await calculatePriceForDates(checkIn, checkOut);

    // Create booking
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
    
    // Show booking confirmation and payment
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

  // Update payment button
  const paymentBtn = document.getElementById('selcomPaymentBtn');
  if (paymentBtn) {
    paymentBtn.onclick = () => initializeSelcomPayment(booking, totalPrice);
  }
}

function initializeSelcomPayment(booking, amount) {
  // Selcom payment integration
  // This is a placeholder - integrate with actual Selcom API
  const selcomData = {
    booking_id: booking.id,
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'USD',
    phone: booking.guest_phone,
    email: booking.guest_email,
    description: `Booking for ${booking.guest_name} at Toiwo Residence`
  };

  // Redirect to payment page or open payment modal
  console.log('Initiating Selcom payment:', selcomData);
  alert('Payment integration would be processed here. Booking ID: ' + booking.id);
}

async function checkAvailabilityFromHero() {
  const checkIn = document.getElementById('heroCheckIn').value;
  const checkOut = document.getElementById('heroCheckOut').value;

  if (!checkIn || !checkOut) {
    alert('Please select check-in and check-out dates.');
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    alert('Check-out date must be after check-in date.');
    return;
  }

  try {
    const isAvailable = await checkAvailability(currentProperty.id, checkIn, checkOut);
    if (isAvailable) {
      // Populate booking form with dates
      document.getElementById('bookingCheckIn').value = checkIn;
      document.getElementById('bookingCheckOut').value = checkOut;
      document.getElementById('bookingGuests').value = document.getElementById('heroGuests').value;
      
      // Scroll to booking form
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
      alert('These dates are available!');
    } else {
      alert('These dates are not available. Please choose different dates.');
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    alert('Error checking availability.');
  }
}

// Update total price when dates change
document.addEventListener('change', (e) => {
  if (e.target.id === 'bookingCheckIn' || e.target.id === 'bookingCheckOut') {
    updateTotalPrice();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'bookingCheckIn' || e.target.id === 'bookingCheckOut') {
    updateTotalPrice();
  }
});

async function calculatePriceForDates(checkIn, checkOut) {
  if (!currentProperty) return 0;
  
  try {
    const rules = await getPricingRules(currentProperty.id);
    const basePrice = parseFloat(currentProperty.price_per_night);
    
    let totalPrice = 0;
    let current = new Date(checkIn);
    const end = new Date(checkOut);
    
    while (current < end) {
      const dateStr = current.toISOString().split('T')[0];
      const rule = rules.find(r => dateStr >= r.start_date && dateStr <= r.end_date);
      if (rule) {
        totalPrice += parseFloat(rule.price_per_night);
      } else {
        totalPrice += basePrice;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return totalPrice;
  } catch (error) {
    console.error('Error calculating seasonal price:', error);
    return calculateNights(checkIn, checkOut) * parseFloat(currentProperty.price_per_night);
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

  const nights = calculateNights(checkIn, checkOut);
  const total = nights * NIGHTLY_RATE;
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
  const email = document.getElementById('contactEmail').value;
  const message = document.getElementById('contactMessage').value;
  const statusEl = document.getElementById('contactFormStatus');

  if (!name || !email || !message) {
    if (statusEl) statusEl.innerHTML = '<span style="color: var(--error);">Please fill in all fields.</span>';
    return;
  }

  try {
    await createContactMessage(currentProperty.id, name, email, message);
    
    if (statusEl) statusEl.innerHTML = '<span style="color: var(--success);">Message sent! We\'ll reply soon.</span>';
    
    // Reset form
    document.getElementById('contactFormElement').reset();
    
    setTimeout(() => {
      if (statusEl) statusEl.innerHTML = '';
    }, 5000);

  } catch (error) {
    console.error('Error submitting contact message:', error);
    if (statusEl) statusEl.innerHTML = '<span style="color: var(--error);">Error sending message. Please try again.</span>';
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
      if (link.getAttribute('data-section') === currentSection) {
        link.classList.add('active');
      }
    });
  });
}

function setupEventListeners() {
  // Header scroll effect
  const header = document.getElementById('siteHeader');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Mobile menu toggle
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      siteNav.classList.toggle('open');
    });
  }

  // Close mobile menu when clicking links
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('open');
    });
  });

  // Booking form validation
  const checkInEl = document.getElementById('bookingCheckIn');
  const checkOutEl = document.getElementById('bookingCheckOut');

  if (checkInEl) {
    checkInEl.addEventListener('change', updateTotalPrice);
    checkInEl.addEventListener('input', updateTotalPrice);
  }
  if (checkOutEl) {
    checkOutEl.addEventListener('change', updateTotalPrice);
    checkOutEl.addEventListener('input', updateTotalPrice);
  }

  updateTotalPrice();
}
