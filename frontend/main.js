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
  contact.email = 'jessicalotto9@gmail.com';
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
  renderReviewsList(instantLocalReviews);
  try {
    currentProperty = await getPropertyByName('Toiwo Residence');
    if (currentProperty) {
      currentAdminSettings = await getAdminSettings(currentProperty.id);
      renderPropertyData();
    renderReviewsList();
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
  const email = contact.email || settings.contact_email || currentProperty?.host_email || 'jessicalotto9@gmail.com';

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


// ============================================
// PAYMENT INFO & AUTO-FORWARDING
// ============================================

let currentActiveBooking = null;

function showBookingConfirmation(booking, totalPrice, nights) {
  currentActiveBooking = booking;
  const bookingForm = document.getElementById('bookingForm');
  const paymentSlot = document.getElementById('paymentSlot');
  if (bookingForm) bookingForm.style.display = 'none';

  const amount = totalPrice || booking.total_price || 180;
  const nightCount = nights || 1;

  if (paymentSlot) {
    paymentSlot.style.display = 'block';
    paymentSlot.innerHTML = `
      <div style="background: var(--white); border: 1.5px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">

        <div style="text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--line);">
          <span style="background: rgba(21, 128, 61, 0.12); color: #15803d; font-weight: 700; padding: 6px 14px; border-radius: 999px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Reservation Created (#${booking.id ? booking.id.substring(0,8) : 'TOIWO'})
          </span>
          <h3 style="margin: 6px 0; color: var(--ink); font-size: 21px;">Complete Your Payment</h3>
          <p style="color: var(--ink-soft); font-size: 14px; margin: 0;">Total: <strong style="color: var(--clay); font-size: 18px;">\$${amount} USD</strong> for ${nightCount} night${nightCount > 1 ? 's' : ''}</p>
        </div>

        <div style="background: var(--sand); border-radius: 14px; padding: 18px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(21, 128, 61, 0.12); display: flex; align-items: center; justify-content: center; color: #15803d;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            </div>
            <div>
              <strong style="font-size: 15px; color: var(--ink);">M-Pesa / Tigo Pesa</strong>
              <p style="margin: 0; font-size: 12.5px; color: var(--ink-soft);">Send payment to the number below</p>
            </div>
          </div>
          <div style="background: var(--white); border: 1px solid var(--line); border-radius: 10px; padding: 14px; text-align: center;">
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--ink-soft); display: block; margin-bottom: 4px;">Phone Number</span>
            <span style="font-size: 22px; font-weight: 800; color: var(--ink); letter-spacing: 1px;">0718 654 332</span>
            <p style="margin: 6px 0 0; font-size: 12.5px; color: var(--ink-soft);">Name: <strong>Jessica Lotto Mollel</strong></p>
          </div>
        </div>

        <div style="background: var(--sand); border-radius: 14px; padding: 18px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(156, 63, 30, 0.1); display: flex; align-items: center; justify-content: center; color: var(--clay);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"></path><path d="M3 10h18"></path><path d="M5 6l7-3 7 3"></path><path d="M4 10v11"></path><path d="M20 10v11"></path><path d="M8 14v4"></path><path d="M12 14v4"></path><path d="M16 14v4"></path></svg>
            </div>
            <div>
              <strong style="font-size: 15px; color: var(--ink);">Bank Transfer</strong>
              <p style="margin: 0; font-size: 12.5px; color: var(--ink-soft);">Diamond Trust Bank (DTB)</p>
            </div>
          </div>
          <div style="background: var(--white); border: 1px solid var(--line); border-radius: 10px; padding: 14px; text-align: center;">
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--ink-soft); display: block; margin-bottom: 4px;">Account Number</span>
            <span style="font-size: 22px; font-weight: 800; color: var(--ink); letter-spacing: 2px;">5237474001</span>
            <p style="margin: 6px 0 0; font-size: 12.5px; color: var(--ink-soft);">Account Name: <strong>Jessica Lotto Mollel</strong></p>
            <p style="margin: 3px 0 0; font-size: 12.5px; color: var(--ink-soft);">Bank: <strong>Diamond Trust Bank</strong></p>
          </div>
        </div>

        <a href="https://wa.me/255718654332?text=${encodeURIComponent(
          'Hello Toiwo Residence! I have made my payment of $' + amount + ' USD for ' + nightCount + ' night(s).\\n\\n' +
          'Booking Ref: #' + (booking.id ? booking.id.substring(0,8) : 'TOIWO') + '\\n' +
          'Name: ' + (booking.guest_name || '') + '\\n' +
          'Check-in: ' + (booking.check_in || '') + '\\n' +
          'Check-out: ' + (booking.check_out || '') + '\\n\\n' +
          'Please confirm my reservation.'
        )}" target="_blank" rel="noopener" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; background: #25D366; border-color: #25D366; color: #fff; font-weight: 700; font-size: 15px; border-radius: 999px; text-decoration: none; box-sizing: border-box;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.84 9.84 0 0 0 12.04 2z"/></svg>
          <span>Confirm Payment via WhatsApp</span>
        </a>

        <p style="text-align: center; margin: 12px 0 0; font-size: 13px; color: var(--ink-soft);">
          After making your payment, tap the button above to confirm with the host.
        </p>
      </div>
    `;
  }

  // Auto-forward booking to WhatsApp and email
  autoForwardBooking(booking, amount, nightCount);
}

function autoForwardBooking(booking, amount, nights) {
  const guestName = booking.guest_name || 'Guest';
  const guestEmail = booking.guest_email || '';
  const guestPhone = booking.guest_phone || 'N/A';
  const checkIn = booking.check_in || '';
  const checkOut = booking.check_out || '';
  const guests = booking.num_guests || '';
  const notes = booking.special_requests || '';
  const refId = booking.id ? booking.id.substring(0,8) : 'TOIWO';

  const bookingText =
    'NEW RESERVATION - Toiwo Residence\n\n' +
    'Booking Ref: #' + refId + '\n' +
    'Guest: ' + guestName + '\n' +
    'Email: ' + guestEmail + '\n' +
    'Phone: ' + guestPhone + '\n' +
    'Check-in: ' + checkIn + '\n' +
    'Check-out: ' + checkOut + '\n' +
    'Guests: ' + guests + '\n' +
    'Nights: ' + nights + '\n' +
    'Total: $' + amount + ' USD\n' +
    (notes ? 'Special Requests: ' + notes + '\n' : '') +
    '\nStatus: Awaiting Payment';

  // 1. Send WhatsApp notification to host
  const waUrl = 'https://wa.me/255718654332?text=' + encodeURIComponent(bookingText);
  setTimeout(function() {
    try { window.open(waUrl, '_blank'); } catch(e) { /* silent */ }
  }, 800);

  // 2. Send email notification to host
  const emailSubject = encodeURIComponent('New Booking: ' + guestName + ' | ' + checkIn + ' - ' + checkOut + ' | #' + refId);
  const emailBody = encodeURIComponent(bookingText);
  const mailtoUrl = 'mailto:jessicalotto9@gmail.com?subject=' + emailSubject + '&body=' + emailBody;
  setTimeout(function() {
    try {
      var a = document.createElement('a');
      a.href = mailtoUrl;
      a.target = '_blank';
      a.click();
    } catch(e) { /* silent */ }
  }, 2000);
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
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const nameEl = document.getElementById('contactName');
  const emailEl = document.getElementById('contactEmailInput');
  const messageEl = document.getElementById('contactMessage');
  const statusEl = document.getElementById('contactFormMessage');

  const name = nameEl ? nameEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const message = messageEl ? messageEl.value.trim() : '';

  if (!name || !email || !message) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span style="color:var(--error); font-weight:700;">Please fill in your name, email, and message.</span>';
    }
    return;
  }

  const waPhone = '255718654332';
  const waText = encodeURIComponent(
    `Hello Toiwo Residence!\n\n` +
    `👤 Name: ${name}\n` +
    `✉️ Email: ${email}\n` +
    `💬 Message: ${message}`
  );
  const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `
      <div style="margin-top: 10px; padding: 14px; background: rgba(37, 211, 102, 0.15); border-radius: 12px; border: 1px solid rgba(37, 211, 102, 0.4); text-align: center;">
        <p style="margin-bottom: 8px; color: #0d120a; font-weight: 700;">✓ Message Sent! Connecting to WhatsApp...</p>
        <a href="${waUrl}" id="waDirectBtn" target="_blank" rel="noopener" class="btn" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; font-size: 15px;">
          💬 Open WhatsApp (+255 71 865 4332)
        </a>
      </div>
    `;
  }

  // Save to database asynchronously
  try {
    const propId = currentProperty?.id || '8156fa77-dd4b-4af5-ab19-646920f7a3ca';
    createContactMessage(propId, name, email, message).catch(console.error);
  } catch (err) {
    console.error('Contact message error:', err);
  }

  // Open WhatsApp on mobile seamlessly
  setTimeout(() => {
    try {
      window.location.href = waUrl;
    } catch (e) {
      window.open(waUrl, '_blank');
    }
  }, 250);

  if (event && event.target && typeof event.target.reset === 'function') {
    event.target.reset();
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


// ============================================
// REVIEWS TOGGLE FUNCTION (3 COMMENTS INITIAL VIEW)
// ============================================


// ============================================
// INSTANT REVIEWS DATA (0ms DELAY ON REFRESH)
// ============================================

const instantLocalReviews = [
  { author: 'Liselotte', quote: 'Great accommodation. The house met all expectations and gives a homely feeling, we felt very nice here. The communication with Jessica is great, she always responds and thinks proactively. For example, she arranged taxis for us and gave tips to discover Arusha. All in all great start to our vacation!', stars: 5, trip_type: 'Netherlands', initials: 'L' },
  { author: 'Daniel', quote: "Our stay at Toiwo Residence in Ilboru was absolutely fantastic! We had such a great time that we wanted to share our experience. First off, Jessica, our Airbnb host, was incredible. She was always available, super helpful, and kept everything spotless. The house itself is amazing - clean, tidy, and equipped with everything you could possibly need. And we can't forget about Gerald, the night watchman - he was friendly and reliable, adding an extra layer of security and warmth to our stay. Overall, our time at Toiwo Residence exceeded our expectations, and we can't wait to come back for another visit. It's definitely a great Airbnb experience, and we highly recommend it to anyone looking for a great place to stay in Ilboru. Thanks again for such a wonderful experience!", stars: 5, trip_type: 'Germany', initials: 'D' },
  { author: 'Paul', quote: 'spacious and peaceful home, great before and after the safari trip, secure on the outside, comfortable inside. kitchen fully equipped, good dinner table for the family, comfortable beds. host Jessica helped arranged the rides from the and to the airport.', stars: 5, trip_type: 'United States', initials: 'P' },
  { author: 'Athanasia', quote: 'Really nice and comfortable place that can house multiple people. Located at a safe neighborhood. The hostess, Jessica, is very helpful and gave us tips and help with so many different things. It was sufficiently clean, some extra details could have been spotted too.', stars: 5, trip_type: 'Netherlands', initials: 'A' },
  { author: 'Mara', quote: 'Wonderful house, with very large and fascinating spaces. Clean, nice, with a terrace to see the sky and the surroundings. Very nice people to welcome us. The house has a night guard to keep the security of the place.', stars: 5, trip_type: 'Italy', initials: 'M' },
  { author: 'Svetlana', quote: "A wonderful house, it's clear that everything was done with love, it's cozy, with attention to detail! Everything is clean and cozy! The hostess was wonderful and treated us with great attention. We arrived before check-in time, and they accommodated us, cleaned up quickly, and checked us in. It was very nice. We had a great time! I recommend it! Thank you very much for the rest.", stars: 5, trip_type: 'Russia', initials: 'S' },
  { author: 'Catherine', quote: 'Conveniently located, a welcoming host and high level of privacy. The residence is conveniently located close to town which made it easy for us to get around. It offered a high level of privacy and the host, Jessica was exceptionally friendly. We also had the pleasure of enjoying a lovely bonfire experience.', stars: 5, trip_type: 'Kenya', initials: 'C' },
  { author: 'Karanja', quote: 'Perfect place to unwind and have a you time to reflect !! Will definitely revisit for a long stay!!', stars: 5, trip_type: 'Kenya', initials: 'K' },
  { author: 'Zayumba', quote: 'Staying at Toiwo Residence was an idyllic retreat with impeccable service and serene surroundings. Very calm, clean and nice customer service', stars: 5, trip_type: 'Tanzania', initials: 'Z' },
  { author: 'Mohamed', quote: "We had an amazing stay at Jessica's place. Jessica is a wonderful host who is very helpful and responsive. The place is very clean and tidy and matches the photos perfectly. It's a very nice house with all the needed amenities available.", stars: 5, trip_type: 'UAE', initials: 'M' }
];

function renderReviewsList(reviewsList) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;

  const list = (Array.isArray(reviewsList) && reviewsList.length > 0) ? reviewsList : instantLocalReviews;

  function buildCardsHtml(items) {
    return items.map(r => `
      <div class="rev-card">
        <div class="stars">${'★'.repeat(r.stars || 5)}</div>
        <p>"${r.quote || r.text || ''}"</p>
        <div class="who">
          <div class="avatar">${r.initials || (r.author ? r.author.trim().split(' ').map(w => w[0]).join('').substring(0,2) : 'GR')}</div>
          <div class="who-meta"><strong>${r.author || 'Guest'}</strong> – ${r.trip_type || 'Stay'}</div>
        </div>
      </div>
    `).join('');
  }

  // Render initial 3 reviews instantly
  grid.innerHTML = buildCardsHtml(list.slice(0, 3));

  const seeAllBtn = document.getElementById('seeAllReviewsBtn');
  if (seeAllBtn) {
    if (list.length > 3) {
      seeAllBtn.style.display = 'inline-flex';
      seeAllBtn.textContent = 'See More ▼';
      let isExpanded = false;

      seeAllBtn.onclick = () => {
        if (!isExpanded) {
          grid.innerHTML = buildCardsHtml(list);
          seeAllBtn.textContent = 'See Less ▲';
          isExpanded = true;
        } else {
          grid.innerHTML = buildCardsHtml(list.slice(0, 3));
          seeAllBtn.textContent = 'See More ▼';
          isExpanded = false;
          const reviewsSec = document.getElementById('reviews');
          if (reviewsSec) reviewsSec.scrollIntoView({ behavior: 'smooth' });
        }
      };
    } else {
      seeAllBtn.style.display = 'none';
    }
  }
}

