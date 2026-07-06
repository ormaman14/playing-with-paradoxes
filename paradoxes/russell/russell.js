/* ============================================================
   Russell's Paradox — the barber registry game
   Villager cards are filed into two drawers by tap-to-select +
   tap-to-place, or by dragging (Pointer Events, touch-friendly).
   The barber is rejected from BOTH drawers; after the second
   rejection the LOGIC ERROR panel opens and the "village logic
   machine" starts evaluating `does the barber shave himself?` —
   flipping TRUE/FALSE forever. Rounding (Achilles), overflow
   (Hilbert), and now non-termination.
   ============================================================ */
'use strict';

(() => {
  const VILLAGERS = [
    { id: 'nikos', emoji: '🧑‍🌾', who: 'Farmer Nikos',
      fact: 'Keeps a razor by the well and shaves himself at dawn.', truth: 'self',
      wrong: 'Nikos handles his own stubble — the barber never touches him. Read his card again.' },
    { id: 'petros', emoji: '👨‍🍳', who: 'Baker Petros',
      fact: 'Hands always in the dough — the barber shaves him every Tuesday.', truth: 'barber',
      wrong: 'Petros never shaves himself; flour and razors don’t mix. He belongs with the barber’s clients.' },
    { id: 'yannis', emoji: '🧔', who: 'Fisherman Yannis',
      fact: 'Trims his own beard with his fishing knife.', truth: 'self',
      wrong: 'Yannis does his own trimming, knife in hand. Not a client of the barber.' },
    { id: 'alexis', emoji: '👨‍🏫', who: 'Teacher Alexis',
      fact: 'Cannot be trusted with a blade; visits the barber daily.', truth: 'barber',
      wrong: 'Alexis with a razor? The village forbids it. The barber shaves him.' },
    { id: 'stavros', emoji: '👴', who: 'Grandpa Stavros',
      fact: 'Has shaved himself every morning for seventy years.', truth: 'self',
      wrong: 'Seventy years of self-shaving — Stavros files under “shaves himself.”' },
    { id: 'takis', emoji: '🎻', who: 'Fiddler Takis',
      fact: 'His bow hand is steady, his razor hand is not — the barber does it.', truth: 'barber',
      wrong: 'Takis’s razor hand shakes; the barber shaves him. Other drawer.' },
    { id: 'barber', emoji: '💈', who: 'The Barber',
      fact: 'Shaves all those, and only those, who do not shave themselves.', truth: 'paradox' },
  ];

  const LOOPS = {
    'bin-self':
      '<span class="loop-symbol">⟲</span> Suppose the barber <strong>shaves himself</strong>. ' +
      'But he shaves <em>only</em> those who do <em>not</em> shave themselves — so he cannot be one of his own clients… ' +
      'so he does <strong>not</strong> shave himself. Which is the other drawer. Try it?',
    'bin-barber':
      '<span class="loop-symbol">⟲</span> Suppose the barber is <strong>shaved by the barber</strong> — that is, by himself. ' +
      'Then he is a man who shaves himself. But he shaves <em>only</em> those who do <em>not</em> shave themselves… ' +
      'so he does <strong>not</strong> shave himself — yet then the rule says the barber must shave him. Which is where you started.',
  };

  const el = {
    tray: document.getElementById('card-tray'),
    bins: { 'bin-self': document.getElementById('bin-self'), 'bin-barber': document.getElementById('bin-barber') },
    status: document.getElementById('game-status'),
    loopStrip: document.getElementById('loop-strip'),
    logicError: document.getElementById('logic-error'),
    lmOut: document.getElementById('lm-out'),
    lmSteps: document.getElementById('lm-steps'),
    reset: document.getElementById('btn-reset'),
  };

  const state = {
    selected: null,        // card element awaiting a drawer tap
    placedCount: 0,
    barberTried: new Set(),
    broken: false,         // both drawers refused the barber
    lmTimer: null,
    lmSteps: 0,
  };

  // ---------- rendering ----------
  function renderGame() {
    el.tray.innerHTML = '';
    for (const v of VILLAGERS) {
      const card = document.createElement('div');
      card.className = 'drag-card' + (v.truth === 'paradox' ? ' the-barber' : '');
      card.dataset.id = v.id;
      card.innerHTML =
        `<div class="top"><span class="emoji">${v.emoji}</span><span class="who">${v.who}</span></div>` +
        `<div class="fact">${v.fact}</div>`;
      attachCardHandlers(card);
      el.tray.appendChild(card);
    }
    Object.values(el.bins).forEach(b => { b.querySelector('.bin-cards').innerHTML = ''; });
  }

  const villager = card => VILLAGERS.find(v => v.id === card.dataset.id);

  // ---------- placement logic ----------
  function attemptPlace(card, binId) {
    if (state.broken || card.classList.contains('placed')) return;
    const v = villager(card);

    if (v.truth === 'paradox') {
      rejectBarber(card, binId);
      return;
    }

    const correct = (v.truth === 'self') === (binId === 'bin-self');
    if (correct) {
      card.classList.remove('selected');
      card.classList.add('placed');
      state.selected = null;
      el.bins[binId].querySelector('.bin-cards').appendChild(card);
      state.placedCount += 1;
      if (state.placedCount === VILLAGERS.length - 1) {
        el.status.innerHTML =
          '✅ Six villagers, six clean placements. One card left: <strong>the barber himself</strong>. ' +
          'He is a man of the village, so he must go in one of the two drawers. Which one?';
      } else {
        el.status.innerHTML = `✔ ${v.who} filed. ${VILLAGERS.length - 1 - state.placedCount} villagers to go — then the barber.`;
      }
    } else {
      bounce(card);
      el.status.innerHTML = `✘ ${v.wrong}`;
    }
  }

  function rejectBarber(card, binId) {
    bounce(card);
    el.bins[binId].classList.remove('reject');
    void el.bins[binId].offsetWidth; // restart the flash animation
    el.bins[binId].classList.add('reject');
    state.barberTried.add(binId);

    el.loopStrip.innerHTML = LOOPS[binId];
    el.loopStrip.classList.add('visible');

    if (state.barberTried.size === 2) {
      state.broken = true;
      el.status.innerHTML =
        '⚠ Both drawers refuse him. The registry rule <em>itself</em> is broken — see below.';
      el.logicError.classList.add('visible');
      startLogicMachine();
    } else {
      el.status.innerHTML = '⟲ The drawer spits the card back out. There is one other drawer…';
    }
  }

  function bounce(card) {
    card.classList.remove('selected', 'rejected');
    state.selected = null;
    void card.offsetWidth; // restart the shake animation
    card.classList.add('rejected');
  }

  // ---------- the stuck evaluator ----------
  function startLogicMachine() {
    stopLogicMachine();
    state.lmSteps = 0;
    state.lmTimer = setInterval(() => {
      state.lmSteps += 1;
      const isTrue = state.lmSteps % 2 === 1;
      el.lmOut.textContent = isTrue ? 'TRUE' : 'FALSE';
      el.lmOut.classList.toggle('t', isTrue);
      el.lmOut.classList.toggle('f', !isTrue);
      el.lmSteps.textContent = state.lmSteps.toLocaleString('en-US');
    }, 600);
  }

  function stopLogicMachine() {
    if (state.lmTimer) clearInterval(state.lmTimer);
    state.lmTimer = null;
  }

  // ---------- interaction: tap-to-select + drag ----------
  function attachCardHandlers(card) {
    let drag = null;
    let suppressClick = false;

    card.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      if (state.broken || card.classList.contains('placed')) return;
      const was = card.classList.contains('selected');
      document.querySelectorAll('.drag-card.selected').forEach(c => c.classList.remove('selected'));
      state.selected = null;
      if (!was) {
        card.classList.add('selected');
        state.selected = card;
        el.status.innerHTML = `${villager(card).who} in hand — now tap a drawer.`;
      }
    });

    card.addEventListener('pointerdown', e => {
      if (state.broken || card.classList.contains('placed') || e.button !== 0) return;
      const r = card.getBoundingClientRect();
      drag = { startX: e.clientX, startY: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, moving: false };
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.moving) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
        drag.moving = true;
        card.classList.add('dragging');
        card.style.width = card.getBoundingClientRect().width + 'px';
      }
      card.style.left = (e.clientX - drag.offX) + 'px';
      card.style.top = (e.clientY - drag.offY) + 'px';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const bin = under && under.closest('.drop-bin');
      Object.values(el.bins).forEach(b => b.classList.toggle('over', b === bin));
    });

    const endDrag = e => {
      if (!drag) return;
      const wasMoving = drag.moving;
      drag = null;
      if (!wasMoving) return; // plain tap → let the click handler run
      suppressClick = true;
      card.classList.remove('dragging');
      card.style.left = card.style.top = card.style.width = '';
      Object.values(el.bins).forEach(b => b.classList.remove('over'));
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const bin = under && under.closest('.drop-bin');
      if (bin) attemptPlace(card, bin.id);
    };
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);
  }

  Object.values(el.bins).forEach(bin => {
    bin.addEventListener('click', () => {
      if (state.selected) attemptPlace(state.selected, bin.id);
    });
  });

  // ---------- reset ----------
  function reset() {
    stopLogicMachine();
    state.selected = null;
    state.placedCount = 0;
    state.barberTried = new Set();
    state.broken = false;
    el.loopStrip.classList.remove('visible');
    el.loopStrip.innerHTML = '';
    el.logicError.classList.remove('visible');
    el.lmOut.textContent = '…';
    el.lmOut.classList.remove('t', 'f');
    el.lmSteps.textContent = '0';
    el.status.textContent =
      'Six villagers and one barber await filing. The rule: the barber shaves exactly those who do not shave themselves.';
    renderGame();
  }

  el.reset.addEventListener('click', reset);
  reset();
})();
