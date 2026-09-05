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
  renderReviewsList(siteContent.reviews);
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

const defaultReviewsList = [
  { author: "Jemma M.", quote: "An oasis of calm — thoughtful touches and genuine hospitality.", stars: 5, trip_type: "Family stay", initials: "JM" },
  { author: "Rashid K.", quote: "Perfect base for our safari — comfortable, quiet, and beautifully hosted.", stars: 5, trip_type: "Explorer", initials: "RK" },
  { author: "Alice L.", quote: "The garden and the morning light were unforgettable — we'll be back.", stars: 5, trip_type: "Couple", initials: "AL" },
  { author: "David & Sarah P.", quote: "Extremely spacious and clean villa! The courtyard breakfast was lovely.", stars: 5, trip_type: "Safari Group", initials: "DS" },
  { author: "Elena R.", quote: "Quiet neighborhood in Ilboru, fast Wi-Fi for work, and incredible hosting.", stars: 5, trip_type: "Business Traveler", initials: "ER" },
  { author: "Michael T.", quote: "Felt like home from day one. Highly recommended for any trip to Arusha!", stars: 5, trip_type: "Vacation", initials: "MT" }
];

function renderReviewsList(reviewsList) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;

  const list = (Array.isArray(reviewsList) && reviewsList.length > 0) ? reviewsList : defaultReviewsList;

  function buildCardsHtml(items) {
    return items.map(r => `
      <div class="rev-card">
        <div class="stars">${'★'.repeat(r.stars || 5)}</div>
        <p>"${r.quote || r.text || ''}"</p>
        <div class="who">
          <div class="avatar">${r.initials || (r.author ? r.author.split(' ').map(w => w[0]).join('').substring(0,2) : 'GR')}</div>
          <div class="who-meta"><strong>${r.author || 'Guest'}</strong> – ${r.trip_type || 'Stay'}</div>
        </div>
      </div>
    `).join('');
  }

  // Render initial 3 reviews
  grid.innerHTML = buildCardsHtml(list.slice(0, 3));

  const seeAllBtn = document.getElementById('seeAllReviewsBtn');
  if (seeAllBtn) {
    if (list.length > 3) {
      seeAllBtn.style.display = 'inline-flex';
      seeAllBtn.textContent = `See All Reviews (${list.length}) ▼`;
      let isExpanded = false;

      seeAllBtn.onclick = () => {
        if (!isExpanded) {
          grid.innerHTML = buildCardsHtml(list);
          seeAllBtn.textContent = 'Show Less Reviews ▲';
          isExpanded = true;
        } else {
          grid.innerHTML = buildCardsHtml(list.slice(0, 3));
          seeAllBtn.textContent = `See All Reviews (${list.length}) ▼`;
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
