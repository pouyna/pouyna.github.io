/* Grow the Film: gas-phase physics, ALD pulse cycle, pulse-ring input, single growth front.
   Depends on the Film global from film.js. */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var hudThick = document.getElementById('hud-thick');
  var hudSub = document.getElementById('hud-sub');
  var hudPhase = document.getElementById('hud-phase');
  var hudBar = document.getElementById('hud-bar');
  var hudBarCtx = hudBar.getContext('2d');
  var hudHint = document.getElementById('hud-hint');
  var navLinks = document.querySelectorAll('nav a');
  var overlayEl = document.getElementById('overlay');

  var ring = document.getElementById('ring');
  var ringFill = document.getElementById('ring-fill');
  var ringDot = document.getElementById('ring-dot');
  var ringLabel = document.getElementById('ring-label');
  var RING_R = 52;
  var RING_C = 2 * Math.PI * RING_R;

  var card = document.getElementById('card');
  var cardEyebrow = document.getElementById('card-eyebrow');
  var cardNm = document.getElementById('card-nm');
  var cardPurity = document.getElementById('card-purity');
  var cardDefects = document.getElementById('card-defects');
  var cardZaps = document.getElementById('card-zaps');
  var cardCycles = document.getElementById('card-cycles');
  var cardGpc = document.getElementById('card-gpc');
  var cardBestLabel = document.getElementById('card-best-label');
  var cardBest = document.getElementById('card-best');
  var cardBestRow = document.getElementById('card-best-row');
  var cardFoot = document.getElementById('card-foot');

  var COL_W = 26, CELL_H = 14, SUBSTRATE_H = 12, CAP_H = 4;
  var BLUE = '#5B8DEF', YELLOW = '#EFC94C', INERT = 'rgba(215,222,232,0.85)';
  var GREEN_A = '#3DA35D', GREEN_B = '#348C50';
  var DEFECT_CELL = '#7A3B34', CVD_COLOR = '#B0564A';
  var BG = '#0B0E14';
  var GRAY = '#3A4252', DIM = '#8A94A6', COPPER = '#D98E4C';

  var DOSE_T = 3.0, PURGE_T = 5.0;
  var CYCLE_T = 2 * (DOSE_T + PURGE_T);

  var MAX_MOLECULES = 150;
  var EDGE = 40;
  var RESTITUTION = 0.85;

  var BAR_W = 150, BAR_H = 4;
  var SWIPE_DEAD = 24;

  /* Real molar-mass ratios in H2O units: TMA 72, H2O 18, Ar 40, TMA·H2O adduct 90 g/mol */
  var SPECIES = {
    blue:   { mass: 4,    radius: 9 },
    yellow: { mass: 1,    radius: 7 },
    inert:  { mass: 2.22, radius: 5 },
    cvd:    { mass: 5,    radius: 10 }
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var HINT_IDLE = coarse ? 'swipe up to grow the film' : 'drag up or press Enter to grow the film';
  var HINT_PLAY = coarse ? 'tap the red CVD clusters before they land' : 'click the red CVD clusters before they land';
  var HINT_END = coarse ? 'swipe up any time to end the run' : 'drag up or press Esc to end the run';
  var HINT_LIMIT = 'runs complete at the limit line, purity is the score';

  var W = 0, H = 0, dpr = 1;
  var colW = COL_W;
  var film = null;
  var filmCanvas = document.createElement('canvas');
  var filmCtx = filmCanvas.getContext('2d');
  var filmDirty = true;

  var molecules = [];
  var effects = [];
  var playing = false;
  var clock = 0;
  var gameTime = 0;
  var spawnAcc = 0;
  var hudAcc = 0;
  var lastT = 0;
  var zaps = 0;
  var hintT1 = 0, hintT2 = 0, hintT3 = 0;
  var gesture = null;
  var ceilY = 0;
  var best = loadBest();

  function loadBest() {
    try {
      var raw = localStorage.getItem('growFilmBest');
      var b = raw ? JSON.parse(raw) : null;
      if (b && typeof b.purity === 'number') return { purity: b.purity };
      return null;
    } catch (err) { return null; }
  }

  function saveBest(b) {
    try { localStorage.setItem('growFilmBest', JSON.stringify(b)); } catch (err) {}
  }

  function gauss() {
    var u = 1 - Math.random();
    var v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sigmaOf(kind) {
    return 60 / Math.sqrt(SPECIES[kind].mass);
  }

  function measureCeiling() {
    var b = 0;
    if (overlayEl && overlayEl.getBoundingClientRect) b = overlayEl.getBoundingClientRect().bottom;
    ceilY = Math.min(H - SUBSTRATE_H - 3 * CELL_H, Math.max(60, b + 14));
  }

  function sizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    measureCeiling();
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    filmCanvas.width = Math.floor(W * dpr);
    filmCanvas.height = Math.floor(H * dpr);
    filmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = Math.max(1, Math.round(W / COL_W));
    colW = W / cols;
    if (film) {
      film = Film.resize(film, cols);
    } else {
      film = Film.create(cols);
    }
    filmDirty = true;
    hudBar.width = Math.floor(BAR_W * dpr);
    hudBar.height = Math.floor(BAR_H * dpr);
    hudBarCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function surfaceY(col) { return H - SUBSTRATE_H - Film.height(film, col) * CELL_H; }

  function colOf(x) {
    var c = Math.floor(x / colW);
    if (c < 0) c = 0;
    if (c > film.cols - 1) c = film.cols - 1;
    return c;
  }

  function ramp() { return Math.min(70, gameTime * 1.5); }

  function phase() {
    if (!playing) return { name: 'idle', label: 'chamber idle', color: DIM, species: 'inert', interval: 240 };
    var t = clock % CYCLE_T;
    if (t < DOSE_T) return { name: 'doseBlue', label: 'precursor dose', color: BLUE, species: Film.BLUE, interval: 55 };
    if (t < DOSE_T + PURGE_T) return { name: 'purge', label: 'purge', color: DIM, species: 'inert', interval: 70 };
    if (t < 2 * DOSE_T + PURGE_T) return { name: 'doseYellow', label: 'co-reactant dose', color: YELLOW, species: Film.YELLOW, interval: 55 };
    return { name: 'purge', label: 'purge', color: DIM, species: 'inert', interval: 70 };
  }

  function spawn(ph) {
    if (molecules.length >= MAX_MOLECULES) return;
    var kind = ph.species;
    var x, vx, vy;
    if (kind === 'inert') {
      if (ph.name === 'purge') {
        x = Math.random() * W;
        vx = gauss() * 90;
        vy = Math.max(30, 150 + gauss() * 40);
      } else {
        x = Math.random() * W;
        vx = gauss() * 40;
        vy = Math.max(15, 70 + gauss() * 40);
      }
    } else {
      x = Math.random() * W;
      vx = gauss() * sigmaOf(kind);
      vy = Math.max(40, 110 + ramp() + gauss() * sigmaOf(kind) * 0.5);
    }
    molecules.push({
      kind: kind,
      x: x,
      y: -SPECIES[kind].radius - 4,
      vx: vx,
      vy: vy,
      spin: Math.random() * Math.PI * 2,
      spinV: (Math.random() - 0.5) * 3
    });
  }

  function makeCvd(x, y, vx, vy) {
    return {
      kind: 'cvd', x: x, y: y, vx: vx, vy: vy,
      spin: Math.random() * Math.PI * 2, spinV: 2.4
    };
  }

  function updateHud(ph) {
    hudThick.textContent = (Film.avgLayers(film) * 0.1).toFixed(2) + ' nm';
    hudSub.textContent = 'purity ' + (Film.purity(film) * 100).toFixed(1) + '% · defects ' + film.defects + ' · cycles ' + Math.floor(clock / CYCLE_T);
    hudPhase.textContent = ph.label;
    hudPhase.style.color = ph.color;
  }

  function drawHudBar() {
    hudBarCtx.clearRect(0, 0, BAR_W, BAR_H);
    var segs = [
      { t: DOSE_T, color: BLUE },
      { t: PURGE_T, color: GRAY },
      { t: DOSE_T, color: YELLOW },
      { t: PURGE_T, color: GRAY }
    ];
    var x = 0;
    hudBarCtx.globalAlpha = playing ? 0.95 : 0.4;
    for (var i = 0; i < segs.length; i++) {
      var w = segs[i].t / CYCLE_T * BAR_W;
      hudBarCtx.fillStyle = segs[i].color;
      hudBarCtx.fillRect(x, 0, w - 1, BAR_H);
      x += w;
    }
    hudBarCtx.globalAlpha = 1;
    if (playing) {
      var cx = (clock % CYCLE_T) / CYCLE_T * BAR_W;
      hudBarCtx.fillStyle = '#E8ECF1';
      hudBarCtx.fillRect(cx - 1, 0, 2, BAR_H);
    }
  }

  function zapAt(x, y, radius) {
    var best2 = -1, bestD = radius;
    for (var i = 0; i < molecules.length; i++) {
      var m = molecules[i];
      if (m.kind !== 'cvd') continue;
      var d = Math.hypot(m.x - x, m.y - y);
      if (d <= bestD) { bestD = d; best2 = i; }
    }
    if (best2 >= 0) {
      effects.push({ x: molecules[best2].x, y: molecules[best2].y, t: 0, kind: 'zap' });
      molecules.splice(best2, 1);
      return true;
    }
    return false;
  }

  function hintPulse() {
    hudHint.classList.remove('pulse');
    void hudHint.offsetWidth;
    hudHint.classList.add('pulse');
  }

  function idlePing(x, y) {
    effects.push({ x: x, y: y, t: 0, kind: 'ping' });
    hintPulse();
  }

  /* Pulse ring */
  function ringShow(label) {
    ringLabel.textContent = label;
    ring.classList.remove('pop');
    ring.classList.add('on');
  }

  function ringHide() { ring.classList.remove('on'); }

  function ringSet(p) {
    ringFill.style.strokeDashoffset = String(RING_C * (1 - p));
    var a = p * Math.PI * 2;
    ringDot.setAttribute('cx', (60 + RING_R * Math.cos(a)).toFixed(1));
    ringDot.setAttribute('cy', (60 + RING_R * Math.sin(a)).toFixed(1));
  }

  function ringPop() {
    ring.classList.remove('on');
    ring.classList.add('pop');
    window.setTimeout(function () { ring.classList.remove('pop'); ringSet(0); }, 320);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
  }

  function hideCard() { card.classList.remove('on'); }

  function startRun() {
    if (playing) return;
    hideCard();
    measureCeiling();
    playing = true;
    document.body.classList.add('playing');
    for (var n = 0; n < navLinks.length; n++) navLinks[n].tabIndex = -1;
    clock = 0;
    gameTime = 0;
    spawnAcc = 0;
    zaps = 0;
    clearTimeout(hintT1);
    clearTimeout(hintT2);
    clearTimeout(hintT3);
    hudHint.textContent = HINT_PLAY;
    hintT1 = setTimeout(function () {
      if (!playing) return;
      hudHint.textContent = HINT_END;
      hintT2 = setTimeout(function () {
        if (!playing) return;
        hudHint.textContent = HINT_LIMIT;
        hintT3 = setTimeout(function () { if (playing) hudHint.textContent = ''; }, 5000);
      }, 5000);
    }, 7000);
  }

  function endRun(reason) {
    if (!playing) return;
    var run = {
      nm: Film.avgLayers(film) * 0.1,
      purity: Film.purity(film),
      defects: film.defects,
      zaps: zaps,
      cycles: Math.floor(clock / CYCLE_T)
    };
    playing = false;
    document.body.classList.remove('playing');
    for (var n = 0; n < navLinks.length; n++) navLinks[n].tabIndex = 0;
    clearTimeout(hintT1);
    clearTimeout(hintT2);
    clearTimeout(hintT3);
    if (reason === 'limit' && navigator.vibrate) {
      try { navigator.vibrate([30, 40, 30]); } catch (err) {}
    }
    Film.reset(film);
    molecules.length = 0;
    effects.length = 0;
    clock = 0;
    gameTime = 0;
    spawnAcc = 0;
    filmDirty = true;
    hudHint.textContent = HINT_IDLE;
    updateHud(phase());

    var scored = reason === 'limit';
    cardEyebrow.textContent = scored ? 'run complete' : 'run ended';
    cardNm.textContent = run.nm.toFixed(2) + ' nm';
    cardPurity.textContent = (run.purity * 100).toFixed(1) + '%';
    cardDefects.textContent = String(run.defects);
    cardZaps.textContent = String(run.zaps);
    cardCycles.textContent = String(run.cycles);
    cardGpc.textContent = run.cycles > 0 ? (run.nm / run.cycles).toFixed(3) + ' nm' : 'n/a';
    if (scored) {
      var isBest = !best || run.purity > best.purity;
      if (isBest) {
        best = { purity: run.purity };
        saveBest(best);
      }
      cardBestRow.style.display = '';
      cardBestLabel.textContent = isBest ? 'new best' : 'best purity';
      cardBestLabel.style.color = isBest ? COPPER : '';
      cardBest.textContent = (best.purity * 100).toFixed(1) + '%';
      cardBest.style.color = isBest ? COPPER : '';
      cardFoot.textContent = coarse ? 'swipe up for a fresh run' : 'drag up or press Enter for a fresh run';
    } else {
      if (best) {
        cardBestRow.style.display = '';
        cardBestLabel.textContent = 'best purity';
        cardBestLabel.style.color = '';
        cardBest.textContent = (best.purity * 100).toFixed(1) + '%';
        cardBest.style.color = '';
      } else {
        cardBestRow.style.display = 'none';
      }
      cardFoot.textContent = 'reach the limit line to score a run';
    }
    card.classList.add('on');
  }

  function update(dt) {
    if (playing) {
      clock += dt;
      gameTime += dt;
    }
    var ph = phase();
    var interval = Math.max(20, ph.interval * 1440 / Math.max(320, W));
    spawnAcc += dt * 1000;
    while (spawnAcc >= interval) { spawnAcc -= interval; spawn(ph); }

    for (var i = molecules.length - 1; i >= 0; i--) {
      var m = molecules[i];
      var r = SPECIES[m.kind].radius;
      m.spin += m.spinV * dt;
      if (m.kind === 'cvd' && m.vy < 150) {
        m.vy = Math.min(150, m.vy + 60 * dt);
      }
      var prevY = m.y;
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      if (m.x < -EDGE || m.x > W + EDGE || m.y < -EDGE || m.y > H + EDGE) {
        molecules.splice(i, 1);
        continue;
      }

      var col = colOf(m.x);
      var sy = surfaceY(col);
      if (m.y + r >= sy) {
        if (prevY + r > sy + CELL_H) {
          var colLeft = col * colW, colRight = colLeft + colW;
          m.vx = -m.vx;
          m.x = m.vx > 0 ? colRight + r : colLeft - r;
        } else if (m.kind === 'cvd') {
          Film.depositDefect(film, col);
          filmDirty = true;
          effects.push({ x: m.x, y: sy - CELL_H / 2, t: 0, kind: 'flash' });
          molecules.splice(i, 1);
        } else if (m.kind !== 'inert' && Film.canReact(film, col, m.kind)) {
          Film.react(film, col, m.kind);
          filmDirty = true;
          effects.push({ x: col * colW + colW / 2, y: sy - CELL_H, t: 0, kind: 'spark' });
          molecules.splice(i, 1);
        } else {
          m.y = sy - r;
          m.vy = -Math.abs(m.vy) * RESTITUTION;
          m.vx += gauss() * 20;
        }
      }
    }

    for (var a = molecules.length - 1; a >= 1; a--) {
      if (a >= molecules.length) continue;
      var ma = molecules[a];
      var ra = SPECIES[ma.kind].radius;
      var massA = SPECIES[ma.kind].mass;
      for (var b = a - 1; b >= 0; b--) {
        var mb = molecules[b];
        var rb = SPECIES[mb.kind].radius;
        var massB = SPECIES[mb.kind].mass;
        var dx = mb.x - ma.x, dy = mb.y - ma.y;
        var rsum = ra + rb;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rsum * rsum || d2 === 0) continue;

        var reactivePair =
          (ma.kind === Film.BLUE && mb.kind === Film.YELLOW) ||
          (ma.kind === Film.YELLOW && mb.kind === Film.BLUE);
        if (reactivePair) {
          var cx = (ma.x + mb.x) / 2, cy = (ma.y + mb.y) / 2;
          effects.push({ x: cx, y: cy, t: 0, kind: 'puff' });
          molecules.push(makeCvd(cx, cy,
            (massA * ma.vx + massB * mb.vx) / (massA + massB),
            (massA * ma.vy + massB * mb.vy) / (massA + massB)));
          molecules.splice(a, 1);
          molecules.splice(b, 1);
          break;
        }

        var d = Math.sqrt(d2);
        var nx = dx / d, ny = dy / d;
        var vn = (ma.vx - mb.vx) * nx + (ma.vy - mb.vy) * ny;
        if (vn > 0) {
          var j = 2 * vn / (massA + massB);
          ma.vx -= j * massB * nx;
          ma.vy -= j * massB * ny;
          mb.vx += j * massA * nx;
          mb.vy += j * massA * ny;
        }
        var push = (rsum - d) / 2 + 0.5;
        ma.x -= nx * push; ma.y -= ny * push;
        mb.x += nx * push; mb.y += ny * push;
      }
    }

    for (var e = effects.length - 1; e >= 0; e--) {
      effects[e].t += dt;
      if (effects[e].t > 0.4) effects.splice(e, 1);
    }

    if (playing && Film.maxHeight(film) * CELL_H >= H - SUBSTRATE_H - ceilY) {
      endRun('limit');
    }
  }

  function drawFilm() {
    filmCtx.clearRect(0, 0, W, H);
    for (var c = 0; c < film.cols; c++) {
      var h = Film.height(film, c);
      var x0 = Math.round(c * colW);
      var cw = Math.round((c + 1) * colW) - x0 - 1;
      for (var r = 0; r < h; r++) {
        var cell = Film.cellAt(film, c, r);
        filmCtx.fillStyle = cell === Film.DEFECT ? DEFECT_CELL : (r % 2 === 0 ? GREEN_A : GREEN_B);
        filmCtx.fillRect(x0, H - SUBSTRATE_H - (r + 1) * CELL_H, cw, CELL_H - 1);
      }
      filmCtx.fillStyle = Film.termination(film, c) === Film.BLUE ? BLUE : YELLOW;
      filmCtx.fillRect(x0, H - SUBSTRATE_H - h * CELL_H - CAP_H, cw, CAP_H);
    }
    filmDirty = false;
  }

  function drawMolecule(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.spin);
    if (m.kind === 'cvd') {
      ctx.fillStyle = CVD_COLOR;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, 4, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1, -6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(11,14,20,0.35)';
      ctx.beginPath(); ctx.arc(2, 1, 3, 0, Math.PI * 2); ctx.fill();
    } else if (m.kind === Film.BLUE) {
      ctx.fillStyle = BLUE;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(91,141,239,0.55)';
      for (var k = 0; k < 3; k++) {
        var ang = k * (Math.PI * 2 / 3);
        ctx.beginPath(); ctx.arc(Math.cos(ang) * 9, Math.sin(ang) * 9, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (m.kind === Film.YELLOW) {
      ctx.fillStyle = YELLOW;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(239,201,76,0.6)';
      ctx.beginPath(); ctx.arc(-6, -5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -5, 3.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = INERT;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1B212C';
    ctx.fillRect(0, H - SUBSTRATE_H, W, SUBSTRATE_H);
    ctx.fillStyle = '#2E3644';
    ctx.fillRect(0, H - SUBSTRATE_H, W, 1);
    if (filmDirty) drawFilm();
    ctx.drawImage(filmCanvas, 0, 0, W, H);
    if (playing) {
      var topY = H - SUBSTRATE_H - Film.maxHeight(film) * CELL_H;
      var danger = 1 - (topY - ceilY) / (4 * CELL_H);
      if (danger < 0) danger = 0;
      if (danger > 1) danger = 1;
      var pulse = danger > 0 ? 0.5 + 0.5 * Math.sin(clock * 6) : 0;
      var la = 0.16 + danger * (0.3 + 0.35 * pulse);
      var lr = Math.round(138 + (217 - 138) * danger);
      var lg = Math.round(148 + (142 - 148) * danger);
      var lb = Math.round(166 + (76 - 166) * danger);
      ctx.strokeStyle = 'rgba(' + lr + ',' + lg + ',' + lb + ',' + la + ')';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, ceilY + 0.5);
      ctx.lineTo(W, ceilY + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(' + lr + ',' + lg + ',' + lb + ',' + Math.min(0.9, la + 0.15) + ')';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('limit', W - 10, ceilY - 5);
      ctx.textAlign = 'left';
    }
    for (var i = 0; i < molecules.length; i++) drawMolecule(molecules[i]);
    for (var j = 0; j < effects.length; j++) {
      var e = effects[j];
      var k = e.t / 0.4;
      if (e.kind === 'zap') {
        ctx.strokeStyle = 'rgba(232,236,241,' + (1 - k) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6 + k * 22, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'ping') {
        ctx.strokeStyle = 'rgba(138,148,166,' + (0.5 * (1 - k)) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6 + k * 18, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'flash') {
        ctx.fillStyle = 'rgba(176,86,74,' + (0.5 * (1 - k)) + ')';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 + k * 12, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'puff') {
        ctx.fillStyle = 'rgba(138,148,166,' + (0.4 * (1 - k)) + ')';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6 + k * 16, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(61,163,93,' + (1 - k) + ')';
        for (var s = 0; s < 5; s++) {
          var ang2 = s * (Math.PI * 2 / 5) + k * 1.5;
          var rr = 3 + k * 12;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(ang2) * rr, e.y + Math.sin(ang2) * rr, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    draw();
    drawHudBar();
    hudAcc += dt;
    if (hudAcc > 0.15) { hudAcc = 0; updateHud(phase()); }
    requestAnimationFrame(loop);
  }

  function prefill() {
    var rowsToLimit = Math.max(4, Math.floor((H - SUBSTRATE_H - ceilY) / CELL_H));
    for (var c = 0; c < film.cols; c++) {
      var target = Math.round(rowsToLimit * (0.5 + 0.1 * Math.sin(c * 0.13)));
      for (var r = 0; r < target; r++) Film.react(film, c, r % 2 === 0 ? Film.BLUE : Film.YELLOW);
    }
    filmDirty = true;
  }

  sizeCanvas();
  ringFill.style.strokeDasharray = String(RING_C);
  ringSet(0);
  cardFoot.textContent = coarse ? 'swipe up for a fresh run' : 'drag up or press Enter for a fresh run';

  if (reduced) {
    prefill();
    draw();
    drawHudBar();
    updateHud(phase());
    hudHint.textContent = 'reduced motion is on, film shown at rest';
    window.addEventListener('resize', function () {
      sizeCanvas();
      draw();
      drawHudBar();
      updateHud(phase());
    });
    return;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (card.classList.contains('on')) hideCard();
    if (playing) {
      if (zapAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 52 : 32)) zaps += 1;
    } else {
      idlePing(e.clientX, e.clientY);
    }
    if (!gesture) {
      gesture = { id: e.pointerId, x0: e.clientX, y0: e.clientY, showing: false, done: false };
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!gesture || e.pointerId !== gesture.id || gesture.done) return;
    var dy = gesture.y0 - e.clientY;
    var dx = Math.abs(e.clientX - gesture.x0);
    if (dy < SWIPE_DEAD) {
      if (gesture.showing) { gesture.showing = false; ringHide(); }
      return;
    }
    if (dx > dy * 0.9 + 60) {
      gesture.done = true;
      if (gesture.showing) { gesture.showing = false; ringHide(); }
      return;
    }
    var range = Math.min(230, H * 0.32);
    var p = Math.min(1, (dy - SWIPE_DEAD) / range);
    if (!gesture.showing) {
      gesture.showing = true;
      ringShow(playing ? 'end run' : 'grow');
    }
    ringSet(p);
    if (p >= 1) {
      gesture.done = true;
      gesture.showing = false;
      ringPop();
      if (playing) endRun();
      else startRun();
    }
  });

  function releaseGesture(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    if (gesture.showing) ringHide();
    gesture = null;
  }
  canvas.addEventListener('pointerup', releaseGesture);
  canvas.addEventListener('pointercancel', releaseGesture);

  window.addEventListener('keydown', function (e) {
    if (e.target !== document.body) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!playing) startRun();
    } else if (e.code === 'Enter') {
      if (!playing) startRun();
    } else if (e.code === 'Escape') {
      if (playing) endRun();
    }
  });

  window.addEventListener('resize', sizeCanvas);

  hudHint.textContent = HINT_IDLE;
  updateHud(phase());
  requestAnimationFrame(function (t) {
    lastT = t;
    requestAnimationFrame(loop);
  });
})();
