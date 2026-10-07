/* ==========================================================
   Kilalanin si Jasmin — app logic
   - Loads details from data.json (falls back to built-in copy)
   - Recite deck, fire meter, recall drill
   - Password-protected admin: add/edit/reorder/delete details,
     then publish to GitHub (data.json) so everyone sees it.
   ========================================================== */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  var HASH_SALT = 'jasmin-bfp::';
  var KEYS = {
    draft: 'jasmin.draft.v1',
    token: 'jasmin.ghtoken.v1',
    repo: 'jasmin.ghrepo.v1',
    session: 'jasmin.admin.v1'
  };
  var DEFAULT_REPO = { owner: 'N0rrtthh', repo: 'Jasmin-ann', path: 'data.json' };

  /* Built-in copy of data.json — used if data.json can't be loaded
     (e.g. opening index.html straight from your files). Keep in sync. */
  var DEFAULT_DATA = {
    version: 1,
    adminHash: 'ec80fb880bf79d8fcf5cacf913ae6dacccd41a6b188c95f58338695ec4992f1a',
    profile: {
      name: 'Jasmin Ann R. Revilla',
      nickname: 'Jasmin',
      tagline: 'Criminology Intern · Cavite State University',
      kicker: 'OJT Day 2 · BFP Alfonso Fire Station',
      closing: 'Salamat po, BFP Alfonso! Handang matuto at maglingkod. 🫡'
    },
    details: [
      { id: 'name', icon: '👤', label: 'Pangalan', value: 'Jasmin Ann R. Revilla', sub: 'Criminology Intern', recite: 'Siya si Jasmin Ann R. Revilla!', question: 'Ano ang buong pangalan ko?' },
      { id: 'age', icon: '🎂', label: 'Edad', value: '23 years old', sub: '', recite: '23 years old na siya!', question: 'Ilang taon na ako?' },
      { id: 'home', icon: '📍', label: 'Tirahan', value: 'Dasmariñas, Cavite', sub: '', recite: 'Taga-Dasmariñas, Cavite siya!', question: 'Taga-saan ako?' },
      { id: 'family', icon: '👨‍👩‍👧‍👦', label: 'Pamilya', value: '7 magkakapatid', sub: 'Pito kaming magkakapatid', recite: 'Pito silang magkakapatid!', question: 'Ilan kaming magkakapatid?' },
      { id: 'elem', icon: '🎒', label: 'Elementary', value: 'Graduated 2016', sub: 'Dasmariñas', recite: 'Elementary graduate, 2016 — Dasmariñas!', question: 'Anong taon ako nag-graduate ng elementary?' },
      { id: 'hs', icon: '🏫', label: 'High School', value: 'Graduated 2020', sub: 'Dasmariñas', recite: 'High school graduate, 2020 — Dasmariñas!', question: 'Anong taon ako nag-graduate ng high school?' },
      { id: 'shs', icon: '📚', label: 'Senior High School', value: 'Graduated 2022', sub: 'Dasmariñas', recite: 'Senior high graduate, 2022 — Dasmariñas!', question: 'Anong taon ako nag-graduate ng senior high?' },
      { id: 'college', icon: '🎓', label: 'College', value: 'CvSU · Criminology', sub: 'Na-admit sa CvSU noong 2022 — hindi na nakalaya 😅', recite: 'CvSU Criminology since 2022 — hindi na nakalaya!', question: 'Saan ako nag-aaral at anong course ko?' },
      { id: 'ojt', icon: '🚒', label: 'Ngayon', value: 'OJT sa BFP Alfonso', sub: 'Criminology Intern · Alfonso Fire Station', recite: 'OJT siya ngayon sa BFP Alfonso!', question: 'Saan ako nag-OJT ngayon?' }
    ]
  };

  /* ---------- Safe storage (never throws) ---------- */
  function makeStore(kind) {
    return {
      get: function (k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, v); return true; } catch (e) { return false; } },
      del: function (k) { try { window[kind].removeItem(k); } catch (e) { /* ignore */ } }
    };
  }
  var local = makeStore('localStorage');
  var session = makeStore('sessionStorage');

  /* ---------- Helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  /* ---------- SHA-256 (pure JS, UTF-8) ---------- */
  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function utf8Bytes(str) {
    if (window.TextEncoder) return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function sha256(str) {
    var bytes = utf8Bytes(str);
    var l = bytes.length;
    var total = (((l + 9) + 63) >> 6) << 6;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[l] = 0x80;
    var dv = new DataView(m.buffer);
    var bitLen = l * 8;
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
    dv.setUint32(total - 4, bitLen >>> 0);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    for (var off = 0; off < total; off += 64) {
      var t;
      for (t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
      for (t = 16; t < 64; t++) {
        var x = W[t - 15], y = W[t - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var hex = '';
    for (var i = 0; i < 8; i++) hex += ('00000000' + H[i].toString(16)).slice(-8);
    return hex;
  }
  function hashPassword(pw) { return sha256(HASH_SALT + pw); }

  /* ---------- Data model ---------- */
  function str(v, max) {
    var s = typeof v === 'string' ? v : (v == null ? '' : String(v));
    return s.trim().slice(0, max || 300);
  }
  function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function normalize(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.details)) return null;
    var p = d.profile && typeof d.profile === 'object' ? d.profile : {};
    var dp = DEFAULT_DATA.profile;
    var seen = {};
    var details = [];
    d.details.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var item = {
        id: str(x.id, 40) || newId(),
        icon: str(x.icon, 24) || '⭐',
        label: str(x.label, 60),
        value: str(x.value, 120),
        sub: str(x.sub, 200),
        recite: str(x.recite, 200),
        question: str(x.question, 200)
      };
      if (!item.value) return;
      if (seen[item.id]) item.id = newId();
      seen[item.id] = true;
      details.push(item);
    });
    return {
      version: 1,
      adminHash: /^[a-f0-9]{64}$/.test(d.adminHash) ? d.adminHash : DEFAULT_DATA.adminHash,
      profile: {
        name: str(p.name, 80) || dp.name,
        nickname: str(p.nickname, 30) || dp.nickname,
        tagline: str(p.tagline, 120),
        kicker: str(p.kicker, 80),
        closing: str(p.closing, 200)
      },
      details: details
    };
  }

  var published = normalize(DEFAULT_DATA);
  var data = clone(published);

  function loadDraft() {
    var raw = local.get(KEYS.draft);
    if (!raw) return null;
    try { return normalize(JSON.parse(raw)); } catch (e) { return null; }
  }
  function hasDraft() { return !!local.get(KEYS.draft); }
  function saveDraft() {
    if (!local.set(KEYS.draft, JSON.stringify(data))) {
      toast('Hindi ma-save sa phone na ito (storage blocked). Mag-Publish o mag-Download agad.', 4000);
    }
    renderAllViews();
  }
  function clearDraft() { local.del(KEYS.draft); }

  function loadPublished() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch('data.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { return normalize(j); })
      .catch(function () { return null; });
  }

  /* ---------- Embers background ---------- */
  var heat = 1;
  var embers = (function () {
    var canvas = $('#embers');
    var ctx = canvas.getContext && canvas.getContext('2d');
    var parts = [];
    var W = 0, H = 0, dpr = 1, running = false, raf = 0;
    var MAX = 42;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, initial) {
      p.x = Math.random() * W;
      p.y = initial ? Math.random() * H : H + 10;
      p.r = 0.8 + Math.random() * 2.2;
      p.vy = 0.35 + Math.random() * 1.1;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.life = 0;
      p.wob = Math.random() * Math.PI * 2;
      p.hue = 18 + Math.random() * 30;
      return p;
    }
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      var active = Math.round(MAX * heat);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (i >= active && p.y > H) continue;
        p.life += 1;
        p.wob += 0.03;
        p.x += p.vx + Math.sin(p.wob) * 0.35;
        p.y -= p.vy;
        if (p.y < -10) { if (i < active) spawn(p, false); else p.y = H + 20; }
        var fade = Math.max(0, Math.min(1, p.y / H));
        ctx.beginPath();
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,' + (55 + fade * 10) + '%,' + (0.15 + fade * 0.75) + ')';
        ctx.shadowColor = 'hsla(' + p.hue + ',100%,55%,0.9)';
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (!ctx || reduceMotion || running) return;
      running = true; raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    if (ctx && !reduceMotion) {
      resize();
      for (var i = 0; i < MAX; i++) parts.push(spawn({}, true));
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
      start();
    }
    return { start: start, stop: stop };
  })();

  function setHeat(h) {
    heat = Math.max(0, Math.min(1, h));
    document.documentElement.style.setProperty('--heat', heat.toFixed(2));
  }

  /* ---------- Screens & history ---------- */
  var current = 'intro';
  var SCREENS = ['intro', 'deck', 'end', 'all', 'drill', 'drillEnd'];

  function showScreen(name, push) {
    if (SCREENS.indexOf(name) === -1) name = 'intro';
    current = name;
    SCREENS.forEach(function (s) { $('#' + s).classList.toggle('is-active', s === name); });
    renderScreen(name);
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    try {
      if (push === 'replace') history.replaceState({ s: name }, '', '#' + name);
      else if (push !== false) history.pushState({ s: name }, '', '#' + name);
    } catch (e) { /* ignore */ }
  }

  function renderScreen(name) {
    if (name === 'intro') { renderIntro(); setHeat(1); }
    else if (name === 'deck') { renderCard(0); }
    else if (name === 'end') { renderEnd(); setHeat(0); }
    else if (name === 'all') { renderAll(); setHeat(0.5); }
    else if (name === 'drill') { renderDrill(); setHeat(0.6); }
    else if (name === 'drillEnd') { renderDrillEnd(); }
  }

  window.addEventListener('popstate', function (e) {
    var s = (e.state && e.state.s) || 'intro';
    if (!$('#admin').hidden) closeAdmin();
    showScreen(s, false);
  });

  function renderAllViews() {
    if (idx >= data.details.length) idx = Math.max(0, data.details.length - 1);
    renderScreen(current);
  }

  /* ---------- INTRO ---------- */
  function renderIntro() {
    var p = data.profile;
    $('#introKicker').textContent = p.kicker;
    $('#introKicker').hidden = !p.kicker;
    $('#introNick').textContent = p.nickname;
    $('#introName').textContent = p.name;
    $('#introTagline').textContent = p.tagline;
    $('#introTagline').hidden = !p.tagline;
    var n = data.details.length;
    $('#startBtn').disabled = n === 0;
    $('#introDrillBtn').disabled = n === 0;
    document.title = 'Kilalanin si ' + p.nickname;
  }

  /* ---------- DECK ---------- */
  var idx = 0;

  function startDeck() { idx = 0; showScreen('deck'); }

  function renderCard(dir) {
    var stage = $('#stage');
    var n = data.details.length;

    var olds = stage.querySelectorAll('.card, .empty');
    for (var i = 0; i < olds.length; i++) {
      var old = olds[i];
      if (dir && !reduceMotion && old.classList.contains('card') && !old.classList.contains('leaving')) {
        old.classList.add('leaving', dir > 0 ? 'to-left' : 'to-right');
        (function (o) { setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 420); })(old);
      } else if (!old.classList.contains('leaving')) {
        old.parentNode.removeChild(old);
      }
    }

    if (n === 0) {
      stage.appendChild(el('div', 'empty', 'Wala pang details. Mag-login sa Admin para magdagdag.'));
      updateMeter();
      $('#nextBtn').disabled = true; $('#prevBtn').disabled = true;
      $('#deckCount').textContent = '0/0';
      return;
    }
    if (idx > n - 1) idx = n - 1;
    var d = data.details[idx];

    var card = el('article', 'card ' + (dir > 0 ? 'from-right' : dir < 0 ? 'from-left' : 'pop'));
    card.setAttribute('aria-label', 'Detail ' + (idx + 1) + ' of ' + n + ': ' + (d.label || '') + ' ' + d.value);

    var top = el('div', 'card-top');
    top.appendChild(el('span', 'tag', 'Detail ' + pad2(idx + 1) + ' / ' + pad2(n)));
    top.appendChild(el('span', 'code', 'Recite!'));
    card.appendChild(top);

    var scroll = el('div', 'card-scroll');
    var body = el('div', 'card-body');
    body.appendChild(el('div', 'card-icon', d.icon));
    if (d.label) body.appendChild(el('p', 'card-label', d.label));
    body.appendChild(el('h2', 'card-value', d.value));
    if (d.sub) body.appendChild(el('p', 'card-sub', d.sub));
    scroll.appendChild(body);
    card.appendChild(scroll);

    card.appendChild(el('div', 'reflect'));

    var rec = el('div', 'recite');
    rec.appendChild(el('span', 'recite-label', '📢 Sabay-sabay:'));
    rec.appendChild(el('span', 'recite-line', '“' + (d.recite || d.value) + '”'));
    card.appendChild(rec);

    stage.appendChild(card);

    $('#deckCount').textContent = (idx + 1) + '/' + n;
    $('#prevBtn').disabled = idx === 0;
    $('#nextBtn').disabled = false;
    $('#nextLabel').textContent = idx === n - 1 ? 'Na-recite! Fire out' : 'Na-recite! Next';
    updateMeter();
  }

  function updateMeter() {
    var n = data.details.length;
    var pct = n ? Math.round(100 * (1 - idx / n)) : 0;
    $('#meterFill').style.width = pct + '%';
    $('#meterPct').textContent = pct + '%';
    $('#meterIcon').textContent = pct > 0 ? '🔥' : '🧯';
    $('#meter').setAttribute('aria-valuenow', String(pct));
    setHeat(pct / 100);
  }

  function nextCard() {
    var n = data.details.length;
    if (!n) return;
    splash($('#nextBtn'));
    if (idx < n - 1) {
      idx++;
      renderCard(1);
    } else {
      idx = n; updateMeter();
      setTimeout(function () { showScreen('end'); }, reduceMotion ? 0 : 260);
    }
  }
  function prevCard() {
    if (idx > 0) { idx--; renderCard(-1); }
  }

  /* Water splash from a button */
  function splash(from) {
    if (reduceMotion || !from) return;
    var layer = $('#splash');
    var r = from.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 16; i++) {
      var d = el('span', 'drop');
      var ang = (-Math.PI / 2) + (Math.random() - 0.5) * 1.6;
      var dist = 120 + Math.random() * 220;
      d.style.left = (cx - 5 + (Math.random() - 0.5) * r.width * 0.5) + 'px';
      d.style.top = (cy - 7) + 'px';
      d.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      d.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
      d.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
      layer.appendChild(d);
      (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1000); })(d);
    }
  }

  /* Swipe on the stage */
  (function () {
    var stage = $('#stage');
    var sx = 0, sy = 0, tracking = false;
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) nextCard(); else prevCard();
      }
    }, { passive: true });
  })();

  /* ---------- END ---------- */
  function fillRecap(list) {
    list.textContent = '';
    data.details.forEach(function (d) {
      var li = el('li');
      li.appendChild(el('span', 'ri', d.icon));
      var t = el('span');
      if (d.label) t.appendChild(el('span', 'rl', d.label));
      t.appendChild(el('span', 'rv', d.value));
      li.appendChild(t);
      list.appendChild(li);
    });
  }
  function renderEnd() {
    $('#endClosing').textContent = data.profile.closing;
    fillRecap($('#recapList'));
    $('#endDrillBtn').disabled = data.details.length === 0;
  }

  /* ---------- ALL ---------- */
  function renderAll() {
    var list = $('#allList');
    list.textContent = '';
    data.details.forEach(function (d) {
      var li = el('li');
      li.appendChild(el('span', 'ai', d.icon));
      var t = el('div');
      if (d.label) t.appendChild(el('div', 'al', d.label));
      t.appendChild(el('div', 'av', d.value));
      if (d.sub) t.appendChild(el('div', 'as', d.sub));
      li.appendChild(t);
      list.appendChild(li);
    });
    $('#allCount').textContent = String(data.details.length);
    $('#allStartBtn').disabled = data.details.length === 0;
  }

  /* ---------- RECALL DRILL ---------- */
  var drill = { order: [], i: 0, score: 0, revealed: false };

  function startDrill() {
    var order = data.details.map(function (_, i) { return i; });
    drill = { order: shuffle(order), i: 0, score: 0, revealed: false };
    showScreen('drill');
  }

  function renderDrill() {
    if (!drill.order.length || drill.order.some(function (k) { return k >= data.details.length; })) {
      drill = { order: shuffle(data.details.map(function (_, i) { return i; })), i: 0, score: 0, revealed: false };
    }
    var total = drill.order.length;
    if (!total) { showScreen('intro', false); return; }
    if (drill.i >= total) { drill = { order: [], i: 0, score: 0, revealed: false }; renderDrill(); return; }
    var d = data.details[drill.order[drill.i]];
    $('#drillCount').textContent = (drill.i + 1) + '/' + total;
    $('#drillTag').textContent = 'Tanong #' + (drill.i + 1);
    $('#drillQ').textContent = d.question || ((d.label || 'Detail') + '?');
    $('#ansIcon').textContent = d.icon;
    $('#ansValue').textContent = d.value;
    $('#ansSub').textContent = d.sub || '';
    $('#drillScore').textContent = String(drill.score);
    $('#revealBtn').hidden = drill.revealed;
    $('#answer').hidden = !drill.revealed;
    $('#judge').hidden = !drill.revealed;
  }

  function revealAnswer() {
    drill.revealed = true;
    renderDrill();
    $('#gotBtn').focus({ preventScroll: true });
  }
  function judge(correct) {
    if (!drill.revealed) return;
    if (correct) { drill.score++; splash($('#gotBtn')); }
    drill.i++;
    drill.revealed = false;
    if (drill.i >= drill.order.length) showScreen('drillEnd', 'replace');
    else renderDrill();
  }

  function renderDrillEnd() {
    var total = drill.order.length || data.details.length;
    var s = drill.score;
    var r = total ? s / total : 0;
    $('#resultScore').textContent = String(s);
    $('#resultTotal').textContent = String(total);
    var title, msg;
    if (r === 1) { title = 'Perfect!'; msg = 'Fire out agad sa unang tawag. Kilalang-kilala n\'yo na ako! 🚒'; }
    else if (r >= 0.7) { title = 'Under Control!'; msg = 'Halos perfect — konting mop-up na lang. 💪'; }
    else if (r >= 0.4) { title = 'Need Backup!'; msg = 'May ilang nakalimutan. Ulitin natin? 🧯'; }
    else { title = 'General Alarm!'; msg = 'Hala, ulitin natin ang recite! 😅'; }
    $('#resultTitle').textContent = title;
    $('#resultMsg').textContent = msg;
    setHeat(1 - r);
  }

  /* ---------- Button wiring ---------- */
  function on(id, fn) { $(id).addEventListener('click', fn); }
  on('#startBtn', startDeck);
  on('#introDrillBtn', startDrill);
  on('#introAllBtn', function () { showScreen('all'); });
  on('#deckHome', function () { showScreen('intro'); });
  on('#nextBtn', nextCard);
  on('#prevBtn', prevCard);
  on('#endDrillBtn', startDrill);
  on('#endRestartBtn', startDeck);
  on('#endHomeBtn', function () { showScreen('intro'); });
  on('#allHome', function () { showScreen('intro'); });
  on('#allStartBtn', startDeck);
  on('#drillHome', function () { showScreen('intro'); });
  on('#revealBtn', revealAnswer);
  on('#gotBtn', function () { judge(true); });
  on('#missBtn', function () { judge(false); });
  on('#drillAgainBtn', startDrill);
  on('#resultRestartBtn', startDeck);
  on('#resultHomeBtn', function () { showScreen('intro'); });

  document.addEventListener('keydown', function (e) {
    if (!$('#admin').hidden) { if (e.key === 'Escape') closeAdmin(); return; }
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (current === 'deck') {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if (tag === 'BUTTON' && e.key !== 'ArrowRight') return; // let focused buttons act normally
        e.preventDefault(); nextCard();
      } else if (e.key === 'ArrowLeft') { e.preventDefault(); prevCard(); }
    }
  });

  /* ==========================================================
     ADMIN
     ========================================================== */
  var adminView = 'main';   // 'main' | 'form'
  var editingId = null;
  var failCount = 0, lockUntil = 0;

  function isAuthed() { return session.get(KEYS.session) === data.adminHash; }

  function openAdmin() {
    $('#admin').hidden = false;
    document.body.style.overflow = 'hidden';
    adminView = 'main'; editingId = null;
    renderAdmin();
  }
  function closeAdmin() {
    $('#admin').hidden = true;
    document.body.style.overflow = '';
    $('#adminOpen').focus({ preventScroll: true });
  }
  on('#adminOpen', openAdmin);
  on('#adminClose', closeAdmin);
  $('#admin').addEventListener('click', function (e) { if (e.target === this) closeAdmin(); });

  function renderAdmin() {
    var body = $('#adminBody');
    body.textContent = '';
    if (!isAuthed()) { renderLogin(body); return; }
    if (adminView === 'form') renderForm(body);
    else renderEditor(body);
    body.scrollTop = 0;
  }

  function field(labelText, input, hint) {
    var w = el('label', 'field');
    w.appendChild(el('span', null, labelText));
    w.appendChild(input);
    if (hint) w.appendChild(el('small', null, hint));
    return w;
  }
  function input(type, value, attrs) {
    var i = el(type === 'textarea' ? 'textarea' : 'input', 'input');
    if (type !== 'textarea') i.type = type;
    i.value = value || '';
    i.setAttribute('autocapitalize', 'off');
    i.setAttribute('autocorrect', 'off');
    i.setAttribute('spellcheck', 'false');
    if (attrs) Object.keys(attrs).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    return i;
  }
  function button(cls, text, fn, type) {
    var b = el('button', cls, text);
    b.type = type || 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function section(title) {
    var s = el('section', 'adm-sec');
    if (title) s.appendChild(el('h3', null, title));
    return s;
  }

  /* --- Login --- */
  function renderLogin(body) {
    var form = el('form');
    form.setAttribute('autocomplete', 'off');
    var sec = section('Login');
    sec.appendChild(el('p', 'adm-note', 'Para kay Jasmin lang ito — dito nagdadagdag o nag-e-edit ng details.'));
    var pw = input('password', '', { autocomplete: 'current-password', inputmode: 'text', 'aria-label': 'Password' });
    sec.appendChild(field('Password', pw));
    var err = el('p', 'err-msg');
    sec.appendChild(err);
    sec.appendChild(button('btn btn-fire', 'Login', null, 'submit'));
    form.appendChild(sec);
    body.appendChild(form);
    setTimeout(function () { pw.focus(); }, 60);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var now = Date.now();
      if (now < lockUntil) {
        err.textContent = 'Masyadong maraming mali. Subukan ulit after ' + Math.ceil((lockUntil - now) / 1000) + 's.';
        return;
      }
      if (hashPassword(pw.value) === data.adminHash) {
        failCount = 0;
        session.set(KEYS.session, data.adminHash);
        adminView = 'main';
        renderAdmin();
        toast('Welcome, ' + data.profile.nickname + '! 🔓');
      } else {
        failCount++;
        if (failCount >= 5) { lockUntil = Date.now() + 30000; failCount = 0; }
        err.textContent = 'Mali ang password.';
        pw.value = '';
        sec.classList.remove('shake'); void sec.offsetWidth; sec.classList.add('shake');
        pw.focus();
      }
    });
  }

  /* --- Main editor --- */
  function renderEditor(body) {
    // Status
    var st = el('div', 'status ' + (hasDraft() ? 'warn' : 'ok'));
    st.appendChild(el('span', null, hasDraft() ? '⚠️' : '✅'));
    st.appendChild(el('span', null, hasDraft()
      ? 'May changes na sa phone na ito lang. I-Publish para makita ng lahat.'
      : 'Lahat ng nakikita mo ay naka-publish na.'));
    body.appendChild(st);

    // Details
    var sec = section('Details (' + data.details.length + ')');
    var list = el('ul', 'det-list');
    data.details.forEach(function (d, i) {
      var li = el('li', 'det-item');
      li.appendChild(el('span', 'di', d.icon));
      var t = el('div', 'dt');
      t.appendChild(el('div', 'dl', (i + 1) + '. ' + (d.label || 'Detail')));
      t.appendChild(el('div', 'dv', d.value));
      li.appendChild(t);
      var tools = el('div', 'det-tools');
      var up = button('mini', '↑', function () { move(i, -1); }); up.disabled = i === 0; up.setAttribute('aria-label', 'Itaas');
      var dn = button('mini', '↓', function () { move(i, 1); }); dn.disabled = i === data.details.length - 1; dn.setAttribute('aria-label', 'Ibaba');
      var ed = button('mini', '✎', function () { adminView = 'form'; editingId = d.id; renderAdmin(); }); ed.setAttribute('aria-label', 'I-edit');
      var del = button('mini danger', '🗑', null); del.setAttribute('aria-label', 'Burahin');
      del.addEventListener('click', function () {
        if (!del.classList.contains('armed')) {
          del.classList.add('armed'); del.textContent = '?';
          toast('I-tap ulit para burahin ang "' + d.value + '"');
          setTimeout(function () { if (del.isConnected) { del.classList.remove('armed'); del.textContent = '🗑'; } }, 3000);
          return;
        }
        data.details.splice(i, 1);
        saveDraft(); renderAdmin(); toast('Nabura.');
      });
      tools.appendChild(up); tools.appendChild(dn); tools.appendChild(ed); tools.appendChild(del);
      li.appendChild(tools);
      list.appendChild(li);
    });
    sec.appendChild(list);
    sec.appendChild(button('btn btn-fire', '＋ Magdagdag ng detail', function () { adminView = 'form'; editingId = null; renderAdmin(); }));
    body.appendChild(sec);

    // Profile
    var ps = section('Profile');
    var p = data.profile;
    var fName = input('text', p.name, { maxlength: '80' });
    var fNick = input('text', p.nickname, { maxlength: '30' });
    var fTag = input('text', p.tagline, { maxlength: '120' });
    var fKick = input('text', p.kicker, { maxlength: '80' });
    var fClose = input('textarea', p.closing, { maxlength: '200', rows: '2' });
    ps.appendChild(field('Buong pangalan', fName));
    ps.appendChild(field('Palayaw (malaking text sa simula)', fNick));
    ps.appendChild(field('Tagline', fTag));
    ps.appendChild(field('Kicker (maliit na text sa taas)', fKick));
    ps.appendChild(field('Closing message (sa Fire Out screen)', fClose));
    ps.appendChild(button('btn btn-ghost', 'I-save ang profile', function () {
      data.profile.name = str(fName.value, 80) || data.profile.name;
      data.profile.nickname = str(fNick.value, 30) || data.profile.nickname;
      data.profile.tagline = str(fTag.value, 120);
      data.profile.kicker = str(fKick.value, 80);
      data.profile.closing = str(fClose.value, 200);
      saveDraft(); renderAdmin(); toast('Na-save ang profile.');
    }));
    body.appendChild(ps);

    // Publish
    var pub = section('Publish para makita ng lahat');
    var note = el('div', 'adm-note');
    note.appendChild(document.createTextNode('Kailangan ng GitHub token (isang beses lang i-setup, naka-save lang sa phone na ito):'));
    var ol = el('ol');
    var li1 = el('li'); li1.appendChild(document.createTextNode('Buksan ang '));
    var a = el('a', null, 'GitHub → Fine-grained tokens');
    a.href = 'https://github.com/settings/personal-access-tokens/new'; a.target = '_blank'; a.rel = 'noopener';
    li1.appendChild(a); ol.appendChild(li1);
    ol.appendChild(el('li', null, 'Repository access: "Only select repositories" → piliin ang ' + DEFAULT_REPO.repo + '.'));
    ol.appendChild(el('li', null, 'Permissions → Contents: "Read and write". Generate, tapos i-paste dito.'));
    note.appendChild(ol);
    pub.appendChild(note);

    var repoCfg = getRepoCfg();
    var fOwner = input('text', repoCfg.owner, { maxlength: '100' });
    var fRepo = input('text', repoCfg.repo, { maxlength: '100' });
    var fTok = input('password', local.get(KEYS.token) || '', { placeholder: 'github_pat_…', autocomplete: 'off' });
    var r2 = el('div', 'row2');
    r2.style.gridTemplateColumns = '1fr 1fr';
    r2.appendChild(field('GitHub user', fOwner));
    r2.appendChild(field('Repo', fRepo));
    pub.appendChild(r2);
    pub.appendChild(field('Token', fTok));
    var pubMsg = el('p', 'err-msg');
    pub.appendChild(pubMsg);
    var acts = el('div', 'adm-actions');
    var pubBtn = button('btn btn-water', '🚀 Publish', null);
    pubBtn.addEventListener('click', function () {
      var cfg = { owner: str(fOwner.value, 100), repo: str(fRepo.value, 100), path: DEFAULT_REPO.path };
      var tok = str(fTok.value, 400);
      if (!cfg.owner || !cfg.repo) { pubMsg.textContent = 'Ilagay ang GitHub user at repo.'; return; }
      if (!tok) { pubMsg.textContent = 'Ilagay muna ang token.'; fTok.focus(); return; }
      local.set(KEYS.repo, JSON.stringify(cfg));
      local.set(KEYS.token, tok);
      pubMsg.textContent = '';
      pubBtn.disabled = true; pubBtn.textContent = 'Publishing…';
      publish(cfg, tok).then(function () {
        published = clone(data);
        clearDraft();
        toast('✅ Na-publish! Lalabas sa lahat in about 1–2 minutes.', 4500);
        renderAdmin();
      }).catch(function (err) {
        pubBtn.disabled = false; pubBtn.textContent = '🚀 Publish';
        pubMsg.textContent = err && err.message ? err.message : 'Hindi na-publish. Subukan ulit.';
      });
    });
    acts.appendChild(pubBtn);
    acts.appendChild(button('btn btn-ghost', '⬇ Download data.json', downloadJson));
    if (hasDraft()) {
      var disc = button('btn btn-ghost', 'Itapon ang unpublished changes', null);
      disc.addEventListener('click', function () {
        if (!disc.dataset.armed) { disc.dataset.armed = '1'; disc.textContent = 'Sigurado? I-tap ulit'; return; }
        clearDraft();
        data = clone(published);
        renderAllViews();
        if (!isAuthed()) { closeAdmin(); return; }
        renderAdmin(); toast('Bumalik sa naka-publish na version.');
      });
      acts.appendChild(disc);
    }
    if (local.get(KEYS.token)) {
      acts.appendChild(button('btn btn-ghost', 'Burahin ang token sa phone na ito', function () {
        local.del(KEYS.token); renderAdmin(); toast('Nabura ang token.');
      }));
    }
    pub.appendChild(acts);
    body.appendChild(pub);

    // Password
    var sec2 = section('Palitan ang password');
    var np = input('password', '', { autocomplete: 'new-password' });
    var np2 = input('password', '', { autocomplete: 'new-password' });
    sec2.appendChild(field('Bagong password', np, 'At least 6 characters.'));
    sec2.appendChild(field('Ulitin ang bagong password', np2));
    var pwMsg = el('p', 'err-msg');
    sec2.appendChild(pwMsg);
    sec2.appendChild(button('btn btn-ghost', 'Palitan', function () {
      if (np.value.length < 6) { pwMsg.textContent = 'Masyadong maikli (min 6).'; return; }
      if (np.value !== np2.value) { pwMsg.textContent = 'Hindi magkapareho.'; return; }
      data.adminHash = hashPassword(np.value);
      session.set(KEYS.session, data.adminHash);
      saveDraft(); renderAdmin();
      toast('Napalitan! I-Publish para gumana sa lahat ng phone.', 4000);
    }));
    body.appendChild(sec2);

    body.appendChild(button('btn btn-ghost', 'Logout', function () {
      session.del(KEYS.session); renderAdmin(); toast('Naka-logout na.');
    }));
  }

  function move(i, delta) {
    var j = i + delta;
    if (j < 0 || j >= data.details.length) return;
    var t = data.details[i]; data.details[i] = data.details[j]; data.details[j] = t;
    saveDraft(); renderAdmin();
  }

  /* --- Add / edit form --- */
  function renderForm(body) {
    var existing = null;
    for (var i = 0; i < data.details.length; i++) if (data.details[i].id === editingId) existing = data.details[i];
    var d = existing || { icon: '⭐', label: '', value: '', sub: '', recite: '', question: '' };

    var form = el('form');
    var sec = section(existing ? 'I-edit ang detail' : 'Bagong detail');
    var fIcon = input('text', d.icon, { maxlength: '24', 'aria-label': 'Icon' });
    var fLabel = input('text', d.label, { maxlength: '60', placeholder: 'hal. Hobby' });
    var r = el('div', 'row2');
    r.appendChild(field('Icon', fIcon));
    r.appendChild(field('Label *', fLabel));
    sec.appendChild(r);
    var fValue = input('text', d.value, { maxlength: '120', placeholder: 'hal. Mahilig mag-volleyball' });
    sec.appendChild(field('Detail (malaking text) *', fValue));
    var fSub = input('text', d.sub, { maxlength: '200', placeholder: 'optional' });
    sec.appendChild(field('Dagdag na paliwanag', fSub));
    var fRecite = input('textarea', d.recite, { maxlength: '200', rows: '2', placeholder: 'hal. Mahilig siyang mag-volleyball!' });
    sec.appendChild(field('Ire-recite nila', fRecite, 'Kung blangko, ang Detail ang ire-recite.'));
    var fQ = input('textarea', d.question, { maxlength: '200', rows: '2', placeholder: 'hal. Ano ang hilig kong sport?' });
    sec.appendChild(field('Tanong para sa Recall Drill', fQ));
    var msg = el('p', 'err-msg');
    sec.appendChild(msg);

    var acts = el('div', 'adm-actions');
    acts.appendChild(button('btn btn-fire', existing ? 'I-save' : '＋ Idagdag', null, 'submit'));
    acts.appendChild(button('btn btn-ghost', 'Cancel', function () { adminView = 'main'; renderAdmin(); }));
    sec.appendChild(acts);
    form.appendChild(sec);
    body.appendChild(form);
    setTimeout(function () { (existing ? fValue : fLabel).focus(); }, 60);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = {
        id: existing ? existing.id : newId(),
        icon: str(fIcon.value, 24) || '⭐',
        label: str(fLabel.value, 60),
        value: str(fValue.value, 120),
        sub: str(fSub.value, 200),
        recite: str(fRecite.value, 200),
        question: str(fQ.value, 200)
      };
      if (!item.label) { msg.textContent = 'Lagyan ng Label.'; fLabel.focus(); return; }
      if (!item.value) { msg.textContent = 'Lagyan ng Detail.'; fValue.focus(); return; }
      if (existing) {
        for (var k = 0; k < data.details.length; k++) if (data.details[k].id === existing.id) data.details[k] = item;
      } else {
        data.details.push(item);
      }
      saveDraft();
      adminView = 'main';
      renderAdmin();
      toast(existing ? 'Na-update!' : 'Naidagdag! Huwag kalimutang i-Publish.', 3200);
    });
  }

  /* --- Export --- */
  function downloadJson() {
    try {
      var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = el('a');
      a.href = url; a.download = 'data.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('I-upload ang data.json sa repo para mapalitan ang luma.', 4000);
    } catch (e) {
      toast('Hindi ma-download sa browser na ito.');
    }
  }

  /* --- GitHub publish --- */
  function getRepoCfg() {
    try {
      var c = JSON.parse(local.get(KEYS.repo) || 'null');
      if (c && c.owner && c.repo) return { owner: c.owner, repo: c.repo, path: DEFAULT_REPO.path };
    } catch (e) { /* ignore */ }
    return clone(DEFAULT_REPO);
  }

  function b64utf8(s) {
    var bytes = utf8Bytes(s);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function gh(token, method, path, body) {
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: method, headers: headers, cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (txt) {
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* ignore */ }
        return { status: r.status, ok: r.ok, json: j };
      });
    }, function () {
      throw new Error('Walang internet o na-block ang request. Subukan ulit.');
    });
  }

  function ghError(res, what) {
    var s = res.status;
    if (s === 401) return new Error('Mali o expired na ang token. Gumawa ng bago.');
    if (s === 403) return new Error('Walang permission ang token. Siguraduhing "Contents: Read and write" at kasama ang repo.');
    if (s === 404) return new Error('Hindi makita ang ' + what + '. I-check ang GitHub user/repo, at kung kasama ang repo sa token.');
    if (s === 409 || s === 422) return new Error('May conflict sa GitHub. Pindutin ulit ang Publish.');
    return new Error('GitHub error ' + s + (res.json && res.json.message ? ': ' + res.json.message : '') + '.');
  }

  function publish(cfg, token) {
    var base = '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
    var branch;
    return gh(token, 'GET', base).then(function (res) {
      if (!res.ok) throw ghError(res, 'repo');
      branch = (res.json && res.json.default_branch) || 'main';
      return gh(token, 'GET', base + '/contents/' + cfg.path + '?ref=' + encodeURIComponent(branch));
    }).then(function (res) {
      var sha = null;
      if (res.ok && res.json && res.json.sha) sha = res.json.sha;
      else if (res.status !== 404) throw ghError(res, 'data.json');
      var body = {
        message: 'Update details via admin panel',
        content: b64utf8(JSON.stringify(data, null, 2) + '\n'),
        branch: branch
      };
      if (sha) body.sha = sha;
      return gh(token, 'PUT', base + '/contents/' + cfg.path, body);
    }).then(function (res) {
      if (!res.ok) throw ghError(res, 'data.json');
      return true;
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    var draft = loadDraft();
    if (draft) data = draft;
    try { history.replaceState({ s: 'intro' }, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    showScreen('intro', false);

    loadPublished().then(function (pub) {
      if (!pub) return;
      published = pub;
      if (!hasDraft()) {
        data = clone(pub);
        renderAllViews();
        if (!$('#admin').hidden) renderAdmin();
      }
    });
  }

  // Expose for self-tests only (harmless)
  window.__jasmin = { sha256: sha256, hashPassword: hashPassword };

  boot();
})();
