// Bosko Barbershop — nav, mobile menu, scroll reveals, open-now status, booking form.
(() => {
  window.BOSKO_READY = true; // tells the head fallback that reveals are handled

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav: shadow once the page moves ---------- */
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const toggle = nav.querySelector('.nav__toggle');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    menu.hidden = !open;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Затвори мени' : 'Отвори мени');
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !nav.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- reveal on scroll ---------- */
  // The hero is above the fold by definition: play its entrance straight away (after the first
  // paint, so the transition runs), instead of waiting for items to cross the observer margin.
  const heroItems = document.querySelectorAll('.hero [data-reveal]');
  const showHero = () => heroItems.forEach((el) => el.classList.add('is-in'));
  requestAnimationFrame(() => requestAnimationFrame(showHero));
  setTimeout(showHero, 120); // rAF never fires in background tabs

  const revealables = document.querySelectorAll('main > section:not(.hero) [data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
    revealables.forEach((el) => io.observe(el));
  }

  /* ---------- opening hours: open-now pill + today's row ---------- */
  // Hours from the sign on the shop door, in minutes after midnight (Europe/Skopje).
  // Index = weekday, 0 = Sunday.
  const weekday = [[540, 900], [960, 1080]];
  const HOURS = [[], weekday, weekday, weekday, weekday, weekday, [[540, 780]]];
  // Chrome has no Macedonian Intl data, so day names are spelled out here.
  const DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];

  const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const skopjeNow = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Skopje', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
      minute: Number(get('hour')) * 60 + Number(get('minute')),
    };
  };

  const describe = ({ day, minute }) => {
    const open = HOURS[day].find(([from, to]) => minute >= from && minute < to);
    if (open) return { open: true, text: `Отворено сега · до ${clock(open[1])}` };
    const later = HOURS[day].find(([from]) => from > minute);
    if (later) return { open: false, text: `Затворено · отвора во ${clock(later[0])}` };
    for (let i = 1; i <= 7; i += 1) {
      const d = (day + i) % 7;
      if (HOURS[d].length) {
        const when = i === 1 ? 'утре' : `во ${DAYS[d]}`;
        return { open: false, text: `Затворено · отвора ${when} во ${clock(HOURS[d][0][0])}` };
      }
    }
    return { open: false, text: 'Затворено' };
  };

  const pills = document.querySelectorAll('[data-status]');
  const rows = document.querySelectorAll('[data-days]');

  const renderHours = () => {
    let now;
    try { now = skopjeNow(); } catch { return; } // very old browsers: leave the static table as is
    const s = describe(now);
    pills.forEach((pill) => {
      pill.classList.toggle('is-open', s.open);
      pill.querySelector('[data-status-text]').textContent = s.text;
      pill.hidden = false;
    });
    rows.forEach((row) => {
      row.classList.toggle('is-today', row.dataset.days.split(',').map(Number).includes(now.day));
    });
  };
  renderHours();
  setInterval(renderHours, 60 * 1000);

  /* ---------- booking form: service, day, time -> a ready-to-send SMS to the shop ---------- */
  // There is no server. The request is written out as a text message to the shop's phone and
  // the visitor sends it; Bosko replies to confirm.
  const book = document.getElementById('book');
  if (book) {
    const SHOP_PHONE = '+38978590978';
    const LEAD = 20; // minutes: today's first bookable slot must be at least this far ahead
    const DAYS_SHORT = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];
    const MONTHS = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
    const MONTHS_SHORT = ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек'];

    const daysList = book.querySelector('[data-days-list]');
    const timesList = book.querySelector('[data-times-list]');
    const summary = book.querySelector('[data-summary]');
    const error = book.querySelector('[data-error]');
    const nameInput = book.querySelector('input[name="name"]');
    const phoneInput = book.querySelector('input[name="phone"]');
    const done = document.querySelector('[data-done]');
    const timesHint = timesList.innerHTML;

    // 30-minute slots inside the opening hours, ending by closing time
    const slotsFor = (wd) => HOURS[wd].flatMap(([from, to]) => {
      const out = [];
      for (let t = from; t + 30 <= to; t += 30) out.push(t);
      return out;
    });

    const skopjeDate = () => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date());
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return { y: get('year'), m: get('month') - 1, d: get('day') };
    };

    // the next 12 open days; today only if a slot is still ahead
    const days = [];
    try {
      const today = skopjeDate();
      const nowMinute = skopjeNow().minute;
      for (let i = 0; days.length < 12 && i < 21; i += 1) {
        const date = new Date(Date.UTC(today.y, today.m, today.d + i));
        const wd = date.getUTCDay();
        const slots = slotsFor(wd).filter((t) => i > 0 || t >= nowMinute + LEAD);
        if (slots.length) days.push({ i, date, wd, slots });
      }
    } catch { /* no Intl time zones: the form falls back to "call us" below */ }

    const longDate = (d) => `${DAYS[d.wd]}, ${d.date.getUTCDate()} ${MONTHS[d.date.getUTCMonth()]}`;

    if (days.length) {
      daysList.innerHTML = days.map((d, n) => {
        const top = d.i === 0 ? 'денес' : d.i === 1 ? 'утре' : DAYS_SHORT[d.wd];
        return `<label class="chip chip--day"><input type="radio" name="day" value="${d.date.toISOString().slice(0, 10)}" data-index="${n}" aria-label="${longDate(d)}"><span class="chip__body"><small>${top}</small><b>${d.date.getUTCDate()}</b><small>${MONTHS_SHORT[d.date.getUTCMonth()]}</small></span></label>`;
      }).join('');
    } else {
      daysList.innerHTML = '<p class="book__hint">Јави се на 078 590 978 за слободен термин.</p>';
    }

    const picked = () => {
      const service = book.querySelector('input[name="service"]:checked');
      const dayInput = book.querySelector('input[name="day"]:checked');
      const time = book.querySelector('input[name="time"]:checked');
      return { service, day: dayInput ? days[Number(dayInput.dataset.index)] : null, time };
    };

    // a new day brings its own times, which also clears any time picked for the old day;
    // un-picking the day empties the times again
    daysList.addEventListener('change', () => {
      const dayInput = book.querySelector('input[name="day"]:checked');
      const d = dayInput ? days[Number(dayInput.dataset.index)] : null;
      timesList.innerHTML = d
        ? d.slots.map((t) => `<label class="chip chip--time"><input type="radio" name="time" value="${clock(t)}"><span class="chip__body">${clock(t)}</span></label>`).join('')
        : timesHint;
    });

    // a second click on a picked choice un-picks it, which radio buttons can't do by themselves
    let pressedChecked = null;
    book.addEventListener('pointerdown', (e) => {
      const input = e.target.closest('.chip input');
      pressedChecked = input && input.checked ? input : null;
    });
    book.addEventListener('click', (e) => {
      const input = e.target.closest('.chip input');
      if (input && input === pressedChecked) {
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      pressedChecked = null;
    });

    book.addEventListener('change', () => {
      const { service, day, time } = picked();
      const bits = [];
      if (service) bits.push(`${service.value} (${service.dataset.price} ден)`);
      if (day) bits.push(longDate(day));
      if (time) bits.push(`во ${time.value}`);
      summary.textContent = bits.join(' · ');
      error.textContent = '';
    });

    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let message = '';

    book.addEventListener('submit', (e) => {
      e.preventDefault();
      const { service, day, time } = picked();
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const fail = (text, el) => { error.textContent = text; if (el) el.focus(); };
      if (!service) return fail('Избери услуга.', book.querySelector('input[name="service"]'));
      if (!day) return fail('Избери ден.', book.querySelector('input[name="day"]'));
      if (!time) return fail('Избери час.', book.querySelector('input[name="time"]'));
      if (name.length < 2) return fail('Внеси го твоето име.', nameInput);
      if (phone.replace(/\D/g, '').length < 8) return fail('Внеси телефонски број, за да ти се јави Бошко.', phoneInput);

      message = [
        'Здраво Бошко! Би сакал/а термин:',
        `Услуга: ${service.value} (${service.dataset.price} ден)`,
        `Ден: ${longDate(day)}`,
        `Час: ${time.value}`,
        `Име: ${name}`,
        `Телефон: ${phone}`,
        '(преку веб-страната)',
      ].join('\n');
      // iOS wants "&body=", everything else "?body="
      const sms = `sms:${SHOP_PHONE}${isIOS ? '&' : '?'}body=${encodeURIComponent(message)}`;

      done.querySelector('[data-msg]').textContent = message;
      done.querySelector('[data-sms]').href = sms;
      book.hidden = true;
      done.hidden = false;
      done.focus();
      // phones open the message straight away; desktops keep the panel (copy it, or call)
      if (matchMedia('(pointer: coarse)').matches) window.location.href = sms;
      return undefined;
    });

    const copyBtn = done.querySelector('[data-copy]');
    const copyLabel = copyBtn.textContent;
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(message);
        copyBtn.textContent = 'Копирано ✓';
      } catch {
        // no clipboard access: select the text so it can be copied by hand
        const range = document.createRange();
        range.selectNodeContents(done.querySelector('[data-msg]'));
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        copyBtn.textContent = 'Означено — копирај';
      }
      setTimeout(() => { copyBtn.textContent = copyLabel; }, 2500);
    });

    // back to the form with every choice still in place, to change something or start over
    done.querySelector('[data-back]').addEventListener('click', () => {
      done.hidden = true;
      book.hidden = false;
      (book.querySelector('.chip input:checked') || book.querySelector('.chip input')).focus();
    });
  }

  /* ---------- photo viewer: a gallery photo opens big, arrows flip through the rest ---------- */
  // Cards stay plain links to the Instagram video, so without JS (or with ctrl/cmd-click) they still work.
  const viewer = document.getElementById('viewer');
  const shots = [...document.querySelectorAll('.gallery .shot')];
  if (viewer && shots.length && typeof viewer.showModal === 'function') {
    const vImg = viewer.querySelector('.viewer__img');
    const vName = viewer.querySelector('.viewer__name');
    const vCount = viewer.querySelector('.viewer__count');
    const vVideo = viewer.querySelector('.viewer__video');
    const items = shots.map((a) => {
      const img = a.querySelector('img');
      return { src: img.getAttribute('src'), alt: img.alt, name: a.querySelector('.shot__name').textContent, video: a.href };
    });
    let current = 0;
    let opener = null;

    const show = (i) => {
      current = (i + items.length) % items.length;
      const item = items[current];
      vImg.src = item.src;
      vImg.alt = item.alt;
      vName.textContent = item.name;
      vCount.textContent = `${current + 1} / ${items.length}`;
      vVideo.href = item.video;
    };

    shots.forEach((a, i) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      opener = a;
      show(i);
      viewer.showModal();
      document.documentElement.classList.add('viewer-open');
    }));

    viewer.querySelector('.viewer__close').addEventListener('click', () => viewer.close());
    viewer.querySelector('.viewer__nav--prev').addEventListener('click', () => show(current - 1));
    viewer.querySelector('.viewer__nav--next').addEventListener('click', () => show(current + 1));
    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    // clicking the dark area around the photo closes it
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer || e.target.classList.contains('viewer__stage')) viewer.close();
    });
    // swipe left / right on phones
    let touchX = null;
    viewer.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
    viewer.addEventListener('close', () => {
      document.documentElement.classList.remove('viewer-open');
      if (opener) opener.focus();
    });
  }

  /* ---------- footer year ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
