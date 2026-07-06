/* ============================================================
   Hilbert's Hotel — interactive simulation
   The hotel state is a *rule*, not a list: we store the sequence
   of operations (shift / bus) and compute the occupant of any
   room on demand by inverting the ops. That is the whole point:
   infinity handled by a function, not by enumeration.
   The one thing we cannot fake: past 2^53 the machine's integers
   give out — "find the last room" runs into it on purpose.
   ============================================================ */
'use strict';

(() => {
  const canvas = document.getElementById('hotel-canvas');
  const ctx = canvas.getContext('2d');

  const el = {
    guest: document.getElementById('btn-guest'),
    bus: document.getElementById('btn-bus'),
    cantor: document.getElementById('btn-cantor'),
    lastroom: document.getElementById('btn-lastroom'),
    reset: document.getElementById('btn-reset'),
    status: document.getElementById('desk-status'),
    occupancy: document.getElementById('stat-occupancy'),
    moved: document.getElementById('stat-moved'),
    checkins: document.getElementById('stat-checkins'),
    empty: document.getElementById('stat-empty'),
    highroom: document.getElementById('stat-highroom'),
    cantorPanel: document.getElementById('cantor-panel'),
    cantorTable: document.getElementById('cantor-table'),
    cantorVerdict: document.getElementById('cantor-verdict'),
    callout: document.getElementById('overflow-callout'),
  };

  const COLORS = { orig: '#e0aa4b', new: '#e0705a', bus: '#7ec8a9' };
  const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1

  // ---------- hotel state ----------
  const hotel = {
    ops: [],            // {type:'shift'|'bus', id}
    walkIns: 0,
    busloads: 0,
    cantorFailed: false,
    highRoom: 1,
  };

  // camera: center (in room units) + span (rooms visible)
  const view = { c: 4.5, s: 9 };

  // transition animation
  const anim = { active: false, type: null, movers: [], start: 0, dur: 900 };

  // "find the last room" warp
  const warp = { holding: false, v: 0, overflowed: false, start: 0, lastT: 0 };

  // Cantor sequence bookkeeping
  const cantor = { running: false, timers: [] };

  /** Who sleeps in room n after the first `depth` operations? */
  function occupant(n, depth = hotel.ops.length) {
    for (let i = depth - 1; i >= 0; i--) {
      const op = hotel.ops[i];
      if (op.type === 'shift') {
        if (n === 1) return { kind: 'new', num: op.id };
        n -= 1;
      } else {
        if (n % 2 === 1) return { kind: 'bus', num: (n + 1) / 2 };
        n /= 2;
      }
    }
    return { kind: 'orig', num: n };
  }

  const guestLabel = g => (g.kind === 'orig' ? 'g' : g.kind === 'new' ? 'n' : 'b') + g.num;
  const guestColor = g => COLORS[g.kind];

  // ---------- operations ----------
  function opShift() {
    if (busy()) return;
    hotel.walkIns += 1;
    const movers = collectShiftMovers();
    hotel.ops.push({ type: 'shift', id: hotel.walkIns });
    startAnim('shift', movers, 900);
    el.status.innerHTML =
      `📢 <em>“Everyone kindly move up one room.”</em> All ℵ₀ guests move in one announcement — ` +
      `room 1 is free, guest <strong style="color:${COLORS.new}">n${hotel.walkIns}</strong> checks in. Still full.`;
    el.moved.innerHTML = 'all of them <span class="unit">(ℵ₀)</span>';
    el.empty.innerHTML = '1 <span class="unit">(instantly filled)</span>';
    updateStats();
  }

  function opBus() {
    if (busy()) return;
    hotel.busloads += 1;
    const movers = collectBusMovers();
    hotel.ops.push({ type: 'bus', id: hotel.busloads });
    startAnim('bus', movers, 1300);
    el.status.innerHTML =
      `📢 <em>“Everyone to double your room number!”</em> The current guests take the even rooms; ` +
      `the bus passengers <strong style="color:${COLORS.bus}">b1, b2, b3, …</strong> fill the odd ones. ` +
      `Two infinite crowds, one hotel — still full.`;
    el.moved.innerHTML = 'all of them <span class="unit">(ℵ₀)</span>';
    el.empty.innerHTML = 'ℵ₀ <span class="unit">(instantly filled)</span>';
    updateStats();
  }

  function visibleRange(pad = 2) {
    const lo = Math.max(1, Math.floor(view.c - view.s / 2) - pad);
    const hi = Math.ceil(view.c + view.s / 2) + pad;
    return [lo, hi];
  }

  function collectShiftMovers() {
    const [lo, hi] = visibleRange();
    const movers = [];
    const start = Math.max(1, lo - 1);
    const count = Math.min(Math.round(hi - start), 200);
    for (let i = 0; i <= count; i++) {
      const m = start + i;
      const g = occupant(m);
      movers.push({ label: guestLabel(g), color: guestColor(g), from: m, to: m + 1, entry: null });
    }
    // the newcomer walks in from the left edge
    movers.push({
      label: 'n' + (hotel.walkIns), color: COLORS.new,
      from: null, to: 1, entry: 'left',
    });
    return movers;
  }

  function collectBusMovers() {
    const [lo, hi] = visibleRange();
    const movers = [];
    const start = Math.max(1, Math.floor(lo / 2));
    const count = Math.min(Math.round(hi - start), 200);
    for (let i = 0; i <= count; i++) {
      const m = start + i;
      const g = occupant(m);
      movers.push({ label: guestLabel(g), color: guestColor(g), from: m, to: 2 * m, entry: null });
    }
    const count2 = Math.min(Math.round(hi - lo), 200);
    for (let i = 0; i <= count2; i++) {
      const n = lo + i;
      if (n % 2 === 1) {
        movers.push({ label: 'b' + ((n + 1) / 2), color: COLORS.bus, from: null, to: n, entry: 'top' });
      }
    }
    return movers;
  }

  function startAnim(type, movers, dur) {
    anim.active = true;
    anim.type = type;
    anim.movers = movers;
    anim.start = performance.now();
    anim.dur = dur;
    setButtons();
  }

  // ---------- the Cantor bus ----------
  const CANTOR_GUESTS = [
    '4142135', '7182818', '1415926', '5772156', '6931471', '6180339', '3010299',
  ];

  function opCantor() {
    if (busy()) return;
    cantor.running = true;
    setButtons();
    el.cantorPanel.classList.add('visible');
    el.cantorVerdict.innerHTML = '';
    buildCantorTable();
    el.status.innerHTML =
      `🚌 A bus arrives with one passenger for <em>every real number between 0 and 1</em>. ` +
      `The front desk confidently proposes a room list…`;

    const later = (fn, ms) => cantor.timers.push(setTimeout(fn, ms));
    const n = CANTOR_GUESTS.length;

    // highlight the diagonal, one digit at a time
    for (let i = 0; i < n; i++) {
      later(() => {
        document.querySelector(`#cantor-table td[data-r="${i}"][data-c="${i}"]`)
          ?.classList.add('diag-hi');
        const srow = document.querySelector('#cantor-table tr.stowaway');
        const d = Number(CANTOR_GUESTS[i][i]);
        const nd = d === 5 ? 6 : 5;
        srow.querySelector(`td[data-c="${i}"]`).textContent = nd;
        if (i === 0) {
          el.cantorVerdict.textContent =
            'The stowaway ρ: walk down the diagonal and change every digit…';
        }
      }, 900 + i * 650);
    }

    later(() => {
      el.cantorVerdict.innerHTML =
        `ρ differs from the guest of room <em>n</em> at the <em>n</em>-th digit — for every n. ` +
        `ρ is on the bus but on <strong>nobody's list</strong>, and the same diagonal trick defeats ` +
        `<em>every</em> list the desk could try.<br><span class="no-vacancy">NO VACANCY</span>`;
      el.status.innerHTML =
        `🔴 For the first time in its history, the Grand Hotel turns a bus away. ` +
        `Some infinities are simply bigger — see section 3.`;
      hotel.cantorFailed = true;
      cantor.running = false;
      el.cantor.textContent = '🚌 Replay the Cantor bus';
      updateStats();
      setButtons();
    }, 900 + n * 650 + 700);
  }

  function buildCantorTable() {
    let html = '';
    CANTOR_GUESTS.forEach((digits, r) => {
      html += `<tr><td class="room-label">room ${r + 1} →</td><td>0.</td>`;
      for (let c = 0; c < digits.length; c++) {
        html += `<td class="dg" data-r="${r}" data-c="${c}">${digits[c]}</td>`;
      }
      html += `<td>…</td></tr>`;
    });
    html += `<tr class="stowaway"><td class="room-label">stowaway ρ →</td><td>0.</td>`;
    for (let c = 0; c < CANTOR_GUESTS[0].length; c++) {
      html += `<td class="dg" data-c="${c}"></td>`;
    }
    html += `<td>…</td></tr>`;
    el.cantorTable.innerHTML = html;
  }

  // ---------- find the last room ----------
  function warpTick(now) {
    if (!warp.holding || warp.overflowed) return;
    // wall-clock driven so a throttled tab accelerates just as fast
    const dt = Math.min((now - warp.lastT) / 1000, 0.3);
    warp.lastT = now;
    const held = (now - warp.start) / 1000;
    warp.v = 3 * Math.pow(10, 1.4 * held); // ~1.4 orders of magnitude per second
    view.c += warp.v * dt;
    const n = Math.round(view.c);
    if (n + 1 === n || n >= MAX_SAFE) {
      warp.overflowed = true;
      warp.holding = false;
      view.c = MAX_SAFE;
      el.callout.classList.add('visible');
      el.status.innerHTML =
        `⚠ Around room <strong>2<sup>53</sup></strong> the door numbers stopped increasing: ` +
        `<code>n + 1 === n</code>. The machine ran out of integers long before the hotel ran out of rooms.`;
      el.highroom.innerHTML = '≈ 2<sup>53</sup> — see the note below';
      setButtons();
      setTimeout(() => {
        if (warp.overflowed) {
          view.c = 4.5;
          el.status.innerHTML =
            '🚶 The manager quietly walks you back to the lobby. The corridor, of course, continues.';
        }
      }, 5000);
    } else if (Math.random() < 0.2) {
      el.status.innerHTML = `🔭 Passing room ${fmtRoom(n)} … still no last room in sight.`;
    }
  }

  function fmtRoom(n) {
    return n < 1e15 ? n.toLocaleString('en-US') : n.toExponential(4);
  }

  // ---------- stats / buttons ----------
  function busy() {
    return anim.active || cantor.running || warp.holding;
  }

  function updateStats() {
    el.occupancy.textContent = hotel.cantorFailed ? 'Full — one bus refused' : 'Full';
    el.checkins.innerHTML = hotel.busloads > 0
      ? `${hotel.walkIns} + ${hotel.busloads}·ℵ₀`
      : String(hotel.walkIns);
    if (!warp.overflowed) {
      hotel.highRoom = Math.max(hotel.highRoom, Math.floor(view.c + view.s / 2));
      el.highroom.textContent = fmtRoom(hotel.highRoom);
    }
  }

  function setButtons() {
    const b = busy();
    el.guest.disabled = b;
    el.bus.disabled = b;
    el.cantor.disabled = anim.active || cantor.running || warp.holding;
    el.lastroom.disabled = anim.active || cantor.running || warp.overflowed;
  }

  function reset() {
    hotel.ops = [];
    hotel.walkIns = 0;
    hotel.busloads = 0;
    hotel.cantorFailed = false;
    hotel.highRoom = 1;
    view.c = 4.5; view.s = 9;
    anim.active = false;
    warp.holding = false; warp.v = 0; warp.overflowed = false;
    cantor.timers.forEach(clearTimeout);
    cantor.timers = [];
    cantor.running = false;
    el.cantorPanel.classList.remove('visible');
    el.cantorTable.innerHTML = '';
    el.cantorVerdict.innerHTML = '';
    el.cantor.textContent = '🚌 The Cantor bus arrives';
    el.callout.classList.remove('visible');
    el.status.textContent = 'Welcome to the Grand Hotel. Every room is occupied.';
    el.moved.innerHTML = '&mdash;';
    el.empty.textContent = '0';
    updateStats();
    setButtons();
  }

  // ---------- rendering ----------
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ease = p => 1 - Math.pow(1 - p, 3);

  function draw(now) {
    resizeCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    warpTick(now);

    const x = pos => ((pos - (view.c - view.s / 2)) / view.s) * W;
    const floorY = H * 0.82;
    const doorH = Math.min(H * 0.42, 150);
    const doorTop = floorY - doorH;

    // corridor floor + ceiling line
    ctx.strokeStyle = '#3a3d55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY); ctx.lineTo(W, floorY);
    ctx.stroke();

    // rooms — iterate by small-index offset, NOT by n++ directly: at n ≈ 2^53
    // doubles give n + 1 === n and a naive loop would hang the page (which is
    // the exhibit's own point, but the browser doesn't deserve to prove it)
    const [lo, hi] = visibleRange(1);
    const roomW = W / view.s;
    const animP = anim.active ? ease(Math.min((now - anim.start) / anim.dur, 1)) : 1;
    const roomCount = Math.min(Math.round(hi - lo), 200);

    for (let i = 0; i <= roomCount; i++) {
      const n = lo + i;
      const x0 = x(n - 1), cx = x(n - 0.5);
      // door
      ctx.fillStyle = '#222436';
      ctx.strokeStyle = '#2e3145';
      const dw = roomW * 0.72;
      ctx.beginPath();
      ctx.roundRect(cx - dw / 2, doorTop, dw, doorH, [8, 8, 0, 0]);
      ctx.fill();
      ctx.stroke();
      // number plate
      const label = fmtRoom(n);
      ctx.fillStyle = '#a09aad';
      let fs = 12;
      ctx.font = `${fs}px Inter, sans-serif`;
      const tw = ctx.measureText(label).width;
      if (tw > roomW * 0.9) fs = Math.max(7, fs * (roomW * 0.9) / tw);
      ctx.font = `${fs}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, doorTop - 8);
      // occupant (static, unless a transition animation owns the stage)
      if (!anim.active) {
        drawGuest(occupantDrawInfo(n), cx, floorY);
      }
    }

    // transition movers
    if (anim.active) {
      for (const m of anim.movers) {
        let gx, gy = floorY;
        if (m.entry === 'left') {
          gx = x(0.5) - (1 - animP) * (x(0.5) + 60);
        } else if (m.entry === 'top') {
          gx = x(m.to - 0.5);
          gy = floorY - (1 - animP) * (floorY + 30);
        } else {
          gx = x(m.from - 0.5) + (x(m.to - 0.5) - x(m.from - 0.5)) * animP;
        }
        drawGuest({ label: m.label, color: m.color }, gx, gy);
      }
      if (animP >= 1) {
        anim.active = false;
        setButtons();
      }
    }

    // hotel sign
    ctx.textAlign = 'left';
    ctx.font = '13px Fraunces, Georgia, serif';
    if (hotel.cantorFailed) {
      ctx.fillStyle = '#e0705a';
      ctx.fillText('HOTEL ∞ · NO VACANCY', 12, 22);
    } else {
      ctx.fillStyle = 'rgba(224,170,75,0.85)';
      ctx.fillText('HOTEL ∞ · every room occupied · guests welcome', 12, 22);
    }

    // warp speed streaks
    if (warp.holding && warp.v > 200) {
      ctx.strokeStyle = 'rgba(224,170,75,0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const sy = doorTop + Math.random() * doorH;
        const sx = Math.random() * W;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx - 40 - Math.random() * 60, sy);
        ctx.stroke();
      }
    }

    updateHighRoomStat();
    requestAnimationFrame(draw);
  }

  function occupantDrawInfo(n) {
    const g = occupant(n);
    return { label: guestLabel(g), color: guestColor(g) };
  }

  function drawGuest(info, cx, floorY) {
    ctx.beginPath();
    ctx.arc(cx, floorY - 34, 11, 0, Math.PI * 2);
    ctx.fillStyle = info.color;
    ctx.fill();
    ctx.fillStyle = '#0e0f16';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.label, cx, floorY - 31);
  }

  let statThrottle = 0;
  function updateHighRoomStat() {
    if (++statThrottle % 15 === 0 && !warp.overflowed) updateStats();
  }

  // ---------- interaction: drag to pan ----------
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (warp.holding) return;
    drag = { x: e.clientX, c: view.c };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const W = canvas.clientWidth;
    view.c = drag.c - (e.clientX - drag.x) / W * view.s;
    view.c = Math.max(view.s / 2 - 0.5, view.c);
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---------- wiring ----------
  el.guest.addEventListener('click', opShift);
  el.bus.addEventListener('click', opBus);
  el.cantor.addEventListener('click', opCantor);
  el.reset.addEventListener('click', reset);

  el.lastroom.addEventListener('pointerdown', e => {
    if (anim.active || cantor.running || warp.overflowed) return;
    e.preventDefault();
    warp.holding = true;
    warp.v = 0;
    warp.start = warp.lastT = performance.now();
    setButtons();
    el.status.textContent = '🔭 Searching for the last room… (keep holding)';
  });
  const stopWarp = () => {
    if (warp.holding) {
      warp.holding = false;
      warp.v = 0;
      if (!warp.overflowed) {
        el.status.innerHTML =
          `You stopped at room ${fmtRoom(Math.round(view.c))}. The corridor continues. It always does.`;
      }
      setButtons();
    }
  };
  el.lastroom.addEventListener('pointerup', stopWarp);
  el.lastroom.addEventListener('pointerleave', stopWarp);
  window.addEventListener('blur', stopWarp);

  reset();
  requestAnimationFrame(draw);
})();
