// ============================================
// MAIN FRONTEND APPLICATION
// ============================================

let currentProperty = null;
let currentAdminSettings = null;

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
    // Fetch property data
    currentProperty = await getPropertyByName('Toiwo Residence');
    if (!currentProperty) {
      console.error('Property not found');
      return;
    }

    // Fetch admin settings
    currentAdminSettings = await getAdminSettings(currentProperty.id);

    // Populate UI with data
    renderPropertyData();
    renderGallery(currentAdminSettings?.gallery_images || []);
    renderAmenities();
    renderDetails();
    updateContactDetails();

  } catch (error) {
    console.error('Error initializing app:', error);
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

  const defaultLabels = ['Courtyard entrance', 'Living room', 'Kitchen', 'Bedroom', 'Garden terrace', 'Outdoor dining', 'Terrace view', 'Master bedroom'];
  const urls = (imageUrls || []).filter(Boolean);
  const list = urls.length > 0 ? urls : (currentProperty?.photos || []);

  galleryGrid.innerHTML = list.slice(0, 8).map((url, index) => `
    <div class="gal-item" style="background-image: url('${url}');">
      <span>${defaultLabels[index] || 'Photo'}</span>
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
    phoneEl.href = `tel:${phone.replace(/\s/g, '')}`;
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
    const totalPrice = calculateTotalPrice(currentProperty.price_per_night, nights);

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

// Update total price when dates or guests change
document.addEventListener('change', (e) => {
  if (e.target.id === 'bookingCheckIn' || e.target.id === 'bookingCheckOut' || e.target.id === 'bookingGuests') {
    updateTotalPrice();
  }
});

function updateTotalPrice() {
  const checkIn = document.getElementById('bookingCheckIn').value;
  const checkOut = document.getElementById('bookingCheckOut').value;
  const totalPriceEl = document.getElementById('totalPrice');
  const nightsEl = document.getElementById('nightsDisplay');

  if (checkIn && checkOut && new Date(checkOut) > new Date(checkIn)) {
    const nights = calculateNights(checkIn, checkOut);
    const total = calculateTotalPrice(currentProperty.price_per_night, nights);
    
    if (totalPriceEl) totalPriceEl.value = formatCurrency(total);
    if (nightsEl) nightsEl.textContent = `${nights} ${nights === 1 ? 'night' : 'nights'} × $${currentProperty.price_per_night}/night = ${formatCurrency(total)}`;
  }
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
  }
  if (checkOutEl) {
    checkOutEl.addEventListener('change', updateTotalPrice);
  }
}
