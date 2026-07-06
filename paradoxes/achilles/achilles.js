/* ============================================================
   Achilles & the Tortoise — interactive Zeno simulation
   Two modes:
     - Zeno steps: discrete stages of the argument, camera zooms
       into the shrinking gap (log scale), counters track the
       geometric series. Positions are computed *incrementally*
       in floating point ON PURPOSE, so that the gap eventually
       rounds away — the "floating-point moment".
     - Real race: continuous time, Achilles simply overtakes.
   ============================================================ */
'use strict';

(() => {
  const canvas = document.getElementById('race-canvas');
  const ctx = canvas.getContext('2d');

  const el = {
    step: document.getElementById('btn-step'),
    step10: document.getElementById('btn-step10'),
    race: document.getElementById('btn-race'),
    reset: document.getElementById('btn-reset'),
    headStart: document.getElementById('slider-headstart'),
    headStartOut: document.getElementById('out-headstart'),
    ratio: document.getElementById('slider-ratio'),
    ratioOut: document.getElementById('out-ratio'),
    statStep: document.getElementById('stat-step'),
    statGap: document.getElementById('stat-gap'),
    statSum: document.getElementById('stat-sum'),
    statTime: document.getElementById('stat-time'),
    statLimit: document.getElementById('stat-limit'),
    seriesTerms: document.getElementById('series-terms'),
    sumBar: document.getElementById('sum-bar'),
    sumBarMax: document.getElementById('sum-bar-max'),
    status: document.getElementById('race-status'),
    callout: document.getElementById('float-callout'),
    calloutSteps: document.getElementById('callout-steps'),
  };

  const V_ACHILLES = 10; // m/s, fixed; tortoise speed = V_ACHILLES / k

  // ---------- simulation state ----------
  const sim = {
    H: 100,        // head start (m)
    k: 10,         // speed ratio
    n: 0,          // completed Zeno steps
    a: 0,          // Achilles position (incremental float — precision loss intended)
    t: 100,        // tortoise position
    terms: [],     // distance covered in each Zeno stage
    collapsed: false,
    mode: 'idle',  // 'idle' | 'stepping' | 'realtime' | 'finished'
  };

  // step animation state
  const anim = { active: false, fromA: 0, toA: 0, fromT: 0, toT: 0, start: 0, dur: 700, queue: 0 };

  // real-race state
  const race = { t: 0, last: 0, done: false };

  // camera: center + span (meters), eased toward a target every frame
  const view = { c: 60, s: 160, tc: 60, ts: 160 };

  const limitDist = () => sim.H * sim.k / (sim.k - 1);
  const limitTime = () => (sim.H / V_ACHILLES) * sim.k / (sim.k - 1);
  const gap = () => sim.t - sim.a;

  // ---------- reset ----------
  function reset() {
    sim.H = Number(el.headStart.value);
    sim.k = Number(el.ratio.value);
    sim.n = 0;
    sim.a = 0;
    sim.t = sim.H;
    sim.terms = [];
    sim.collapsed = false;
    sim.mode = 'idle';
    anim.active = false;
    anim.queue = 0;
    race.t = 0;
    race.done = false;
    el.callout.classList.remove('visible');
    el.status.textContent = '';
    el.sumBar.innerHTML = '';
    frameWholeTrack(true);
    updateStats();
    setButtons();
  }

  function frameWholeTrack(snap = false) {
    const L = limitDist();
    view.tc = L * 0.52;
    view.ts = L * 1.35;
    if (snap) { view.c = view.tc; view.s = view.ts; }
  }

  // ---------- Zeno stepping ----------
  function startStep(queue) {
    if (sim.collapsed || anim.active || sim.mode === 'realtime') return;
    sim.mode = 'stepping';
    const g = gap();
    anim.active = true;
    anim.fromA = sim.a;
    anim.toA = sim.t;                    // Achilles runs to where the tortoise is now
    anim.fromT = sim.t;
    anim.toT = sim.t + g / sim.k;        // tortoise crawls ahead meanwhile
    anim.start = performance.now();
    anim.dur = queue > 0 ? 220 : 700;    // brisker when fast-forwarding
    anim.queue = queue;
    setButtons();
  }

  function finishStep() {
    anim.active = false;
    sim.terms.push(gap());               // distance Achilles covered this stage = old gap
    sim.a = anim.toA;
    sim.t = anim.toT;
    sim.n += 1;

    addSumSegment(sim.terms[sim.terms.length - 1]);

    if (gap() <= 0) {
      // The float rounded away: t + g/k === t at this precision.
      sim.collapsed = true;
      sim.mode = 'finished';
      anim.queue = 0;
      el.calloutSteps.textContent = String(sim.n);
      el.callout.classList.add('visible');
      el.status.innerHTML = `⚠ After <strong>${sim.n}</strong> steps the gap rounded to exactly 0 — see the note below the simulation.`;
      frameWholeTrack();
    } else {
      // zoom into the new gap
      const g = gap();
      view.tc = sim.a + g / 2;
      view.ts = Math.max(g * 5, 5e-13);
      if (anim.queue > 0) {
        startStep(anim.queue - 1);
      } else {
        sim.mode = 'idle';
      }
    }
    updateStats();
    setButtons();
  }

  // ---------- the real race ----------
  function startRace() {
    reset();
    sim.mode = 'realtime';
    race.t = 0;
    race.last = performance.now();
    race.done = false;
    frameWholeTrack();
    el.status.textContent = 'Racing in real time…';
    setButtons();
  }

  function tickRace(now) {
    const dt = Math.min((now - race.last) / 1000, 0.1);
    race.last = now;
    race.t += dt;
    const vT = V_ACHILLES / sim.k;
    sim.a = V_ACHILLES * race.t;
    sim.t = sim.H + vT * race.t;

    const tStar = sim.H / (V_ACHILLES - vT);
    if (!race.done && race.t >= tStar) {
      race.done = true;
      el.status.innerHTML =
        `🏁 Achilles drew level at <strong>t = ${fmtNum(tStar, 6)} s</strong>, ` +
        `${fmtNum(limitDist(), 6)} m from his start — exactly where the series says. ` +
        `He passed through <em>all</em> of Zeno's stages without pressing any buttons.`;
    }
    // stop once Achilles has visibly overtaken
    if (race.t > tStar * 1.25) {
      sim.mode = 'finished';
    }
    updateStats();
    setButtons();
  }

  // ---------- stats / series UI ----------
  function updateStats() {
    const g = Math.max(gap(), 0);
    el.statStep.innerHTML = sim.mode === 'realtime' || (sim.mode === 'finished' && race.t > 0)
      ? zenoStepsSoFar()
      : String(sim.n);
    el.statGap.innerHTML = sim.collapsed
      ? '0 <span class="unit">m</span> (rounded!)'
      : `${fmtNum(g, 4)} <span class="unit">m</span>`;
    el.statSum.innerHTML = `${fmtNum(sim.a, 16)} <span class="unit">m</span>`;
    const elapsed = sim.mode === 'realtime' || race.t > 0 ? race.t : sim.a / V_ACHILLES;
    el.statTime.innerHTML = `${fmtNum(elapsed, 12)} <span class="unit">s</span>`;
    el.statLimit.innerHTML =
      `${fmtNum(limitDist(), 12)} <span class="unit">m</span> &middot; ${fmtNum(limitTime(), 12)} <span class="unit">s</span>`;
    el.sumBarMax.innerHTML = `${fmtNum(limitDist(), 6)} m`;
    updateSeriesTerms();
  }

  // During the real race: how many Zeno stages are already behind Achilles?
  function zenoStepsSoFar() {
    const g = gap();
    if (g <= 0) return '&infin; <span class="unit">(all of them)</span>';
    const n = Math.max(0, Math.floor(Math.log(sim.H / g) / Math.log(sim.k)));
    return String(n);
  }

  function updateSeriesTerms() {
    if (sim.terms.length === 0) {
      el.seriesTerms.innerHTML =
        'No steps yet. The first stage will cover the whole head start: ' +
        `<strong>${fmtNum(sim.H, 6)} m</strong>.`;
      return;
    }
    const shown = sim.terms.slice(0, 6).map(t => fmtNum(t, 4));
    const parts = shown.join(' + ');
    const tail = sim.terms.length > 6 ? ' + &hellip;' : '';
    const status = sim.collapsed
      ? ` = <strong>${fmtNum(sim.a, 16)} m</strong> — and there the computer stopped.`
      : ` = <strong>${fmtNum(sim.a, 16)} m</strong>, still short of ${fmtNum(limitDist(), 12)} m`;
    el.seriesTerms.innerHTML = parts + tail + status;
  }

  function addSumSegment(term) {
    const pct = (term / limitDist()) * 100;
    if (pct < 0.02) return; // invisible anyway — which is rather the point
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.width = pct + '%';
    el.sumBar.appendChild(seg);
  }

  function setButtons() {
    const busy = anim.active || sim.mode === 'realtime';
    el.step.disabled = busy || sim.collapsed;
    el.step10.disabled = busy || sim.collapsed;
    el.race.disabled = sim.mode === 'realtime';
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

  const ease = p => 1 - Math.pow(1 - p, 3); // easeOutCubic

  function currentPositions(now) {
    if (anim.active) {
      const p = ease(Math.min((now - anim.start) / anim.dur, 1));
      return {
        a: anim.fromA + (anim.toA - anim.fromA) * p,
        t: anim.fromT + (anim.toT - anim.fromT) * p,
        done: p >= 1,
      };
    }
    return { a: sim.a, t: sim.t, done: false };
  }

  function draw(now) {
    resizeCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // ease camera toward target (span in log space for smooth deep zooms)
    view.c += (view.tc - view.c) * 0.08;
    view.s = Math.exp(Math.log(view.s) + (Math.log(view.ts) - Math.log(view.s)) * 0.08);

    const x = pos => ((pos - (view.c - view.s / 2)) / view.s) * W;
    const pos = currentPositions(now);

    const trackY = H * 0.62;

    // track line
    ctx.strokeStyle = '#3a3d55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, trackY);
    ctx.lineTo(W, trackY);
    ctx.stroke();

    // distance ticks
    const step = niceStep(view.s / 6);
    const first = Math.ceil((view.c - view.s / 2) / step) * step;
    ctx.fillStyle = '#6f7391';
    ctx.strokeStyle = '#2e3145';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let m = first; m <= view.c + view.s / 2; m += step) {
      const tx = x(m);
      ctx.beginPath();
      ctx.moveTo(tx, trackY - 5);
      ctx.lineTo(tx, trackY + 5);
      ctx.stroke();
      ctx.fillText(tickLabel(m, step), tx, trackY + 20);
    }

    // the limit — where mathematics says they meet
    const L = limitDist();
    const lx = x(L);
    if (lx > -80 && lx < W + 80) {
      ctx.save();
      ctx.strokeStyle = '#e0aa4b';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, 22);
      ctx.lineTo(lx, trackY + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0aa4b';
      ctx.font = '12px Inter, sans-serif';
      const label = `the meeting point (${parseFloat(L.toPrecision(6))} m)`;
      const tw = ctx.measureText(label).width;
      if (lx + 8 + tw <= W - 6) {
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 8, 34);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(label, Math.max(lx - 8, tw + 6), 34);
      }
      ctx.restore();
    }

    // gap bracket between the two runners (when meaningfully zoomed)
    const ax = x(pos.a), tx2 = x(pos.t);
    if (!sim.collapsed && tx2 - ax > 40 && sim.n > 0 && sim.mode !== 'realtime') {
      ctx.strokeStyle = '#7ec8a9';
      ctx.lineWidth = 1;
      const by = trackY + 34;
      ctx.beginPath();
      ctx.moveTo(ax, by); ctx.lineTo(ax, by + 6);
      ctx.moveTo(ax, by + 3); ctx.lineTo(tx2, by + 3);
      ctx.moveTo(tx2, by); ctx.lineTo(tx2, by + 6);
      ctx.stroke();
      ctx.fillStyle = '#7ec8a9';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const g = Math.max(sim.t - sim.a, 0);
      ctx.fillText(`gap ≈ ${plainNum(g)} m`, (ax + tx2) / 2, by + 20);
    }

    // runners (emoji), with name labels
    drawRunner('🏃', '#e0705a', 'Achilles', ax, trackY, W);
    drawRunner('🐢', '#7ec8a9', 'Tortoise', tx2, trackY, W);

    // zoom badge
    if (sim.n > 0 && sim.mode !== 'realtime' && !sim.collapsed) {
      const zoom = (limitDist() * 1.35) / view.s;
      if (zoom > 1.5) {
        ctx.fillStyle = 'rgba(224,170,75,0.85)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`🔍 camera zoom ≈ ${zoomLabel(zoom)}`, 12, 20);
      }
    }

    if (anim.active && pos.done) finishStep();
    if (sim.mode === 'realtime') tickRace(now);

    requestAnimationFrame(draw);
  }

  function drawRunner(emoji, color, name, px, trackY, W) {
    if (px < -60 || px > W + 60) return;
    // emoji face left by default — mirror them so they run to the right
    ctx.save();
    ctx.translate(px, trackY - 12);
    ctx.scale(-1, 1);
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(name, px, trackY - 48);
  }

  function tickLabel(m, step) {
    if (Math.abs(m) < step / 1e6) m = 0;
    if (step >= 1) return `${Math.round(m)} m`;
    if (step >= 1e-3) return `${parseFloat(m.toFixed(6))} m`;
    return m === 0 ? '0' : m.toExponential(2) + ' m';
  }

  function plainNum(v) {
    if (v === 0) return '0';
    if (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e6) return v.toExponential(2);
    return String(parseFloat(v.toPrecision(4)));
  }

  function zoomLabel(z) {
    if (z < 1e6) return `${Math.round(z).toLocaleString('en-US')}×`;
    const e = Math.floor(Math.log10(z));
    return `10^${e}×`;
  }

  // ---------- wiring ----------
  el.step.addEventListener('click', () => startStep(0));
  el.step10.addEventListener('click', () => startStep(9));
  el.race.addEventListener('click', startRace);
  el.reset.addEventListener('click', reset);

  el.headStart.addEventListener('input', () => {
    el.headStartOut.textContent = `${el.headStart.value} m`;
    reset();
  });
  el.ratio.addEventListener('input', () => {
    el.ratioOut.innerHTML = `${el.ratio.value}&times; faster`;
    reset();
  });

  reset();
  requestAnimationFrame(draw);
})();
