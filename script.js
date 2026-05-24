/* ═══════════════════════════════════════════════════════════════════
   BMW M440i — Single-Canvas Scroll-Film Engine
   
   Architecture:
   • ONE tall hero section  (#hero)
   • ONE sticky viewport    (.hero-sticky)
   • ONE canvas             (#heroCanvas)
   • 750 frames total across 3 sequences, played back-to-back
   • Page scrolls DOWN only after the last frame is reached
   • Canvas edges dissolve into black via canvas-drawn gradients
═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Frame sequences (played in order, back-to-back) ─────────────── */
const SEQUENCES = [
  {
    label:  '01 / 03',
    folder: 'image1/ezgif-17b9f71db7af9da4-png-split',
    prefix: 'ezgif-frame-',
    ext:    'png',
    count:  240,
  },
  {
    label:  '02 / 03',
    folder: 'images2/ezgif-1470478ad1435982-jpg',
    prefix: 'ezgif-frame-',
    ext:    'jpg',
    count:  240,
  },
  {
    label:  '03 / 03',
    folder: 'image3/ezgif-1214c73a075453b3-jpg',
    prefix: 'ezgif-frame-',
    ext:    'jpg',
    count:  270,
  },
];

/* ── Build flat frame list ────────────────────────────────────────── */
const FRAMES = [];          // { src, seqIndex }
SEQUENCES.forEach((seq, si) => {
  for (let i = 0; i < seq.count; i++) {
    const n = String(i + 1).padStart(3, '0');
    FRAMES.push({
      src:      `${seq.folder}/${seq.prefix}${n}.${seq.ext}`,
      seqIndex: si,
    });
  }
});
const TOTAL = FRAMES.length;   // 750

/* ── Scroll speed: px of scroll per frame ────────────────────────── */
const PX_PER_FRAME = 7;        // 750 × 7 = 5250px of scroll travel

/* ── Image cache ─────────────────────────────────────────────────── */
const images = new Array(TOTAL).fill(null);

/* ── DOM refs (grabbed after DOMContentLoaded) ───────────────────── */
let canvas, ctx, heroSection, heroSticky;
let progressFill, seqLabel, scrollHint;
let phase1, phase2, phase3;
let loaderEl, loaderBar, loaderPct;

/* ── State ───────────────────────────────────────────────────────── */
let loadedCount  = 0;
let currentFrame = 0;
let rafPending   = false;

/* ═══════════════════════════════════════════════════════════════════
   LOADER
═══════════════════════════════════════════════════════════════════ */
function onOneLoaded() {
  loadedCount++;
  const pct = Math.round((loadedCount / TOTAL) * 100);
  if (loaderBar) loaderBar.style.width = pct + '%';
  if (loaderPct) loaderPct.textContent = pct + '%';

  if (loadedCount >= TOTAL) {
    /* Small delay so the bar visually reaches 100% */
    setTimeout(onAllLoaded, 500);
  }
}

function onAllLoaded() {
  loaderEl.classList.add('hidden');
  initHero();
}

/* ═══════════════════════════════════════════════════════════════════
   PRELOAD
═══════════════════════════════════════════════════════════════════ */
function preloadAll() {
  FRAMES.forEach((f, i) => {
    const img = new Image();
    img.onload  = onOneLoaded;
    img.onerror = onOneLoaded;   // count errors so we never stall
    img.src     = f.src;
    images[i]   = img;
  });
}

/* ═══════════════════════════════════════════════════════════════════
   INIT HERO — called once after all images loaded
═══════════════════════════════════════════════════════════════════ */
function initHero() {
  /* Force a compositing layer on the sticky element — fixes sticky
     in browsers that need an explicit hint */
  heroSticky.style.willChange = 'transform';

  /* Set section height:
     100vh  → the sticky viewport occupies the screen
     + scrollTravel → the extra scroll distance that drives the frames
     Together the sticky element stays pinned for the full animation,
     then the page naturally scrolls past it when travel is exhausted. */
  const scrollTravel = TOTAL * PX_PER_FRAME;
  heroSection.style.height = (window.innerHeight + scrollTravel) + 'px';

  /* Size canvas */
  resizeCanvas();

  /* Draw frame 0 */
  drawFrame(0);

  /* Show phase 1 text immediately */
  phase1.classList.add('active');
  if (seqLabel) seqLabel.textContent = SEQUENCES[0].label;

  /* Listeners */
  window.addEventListener('scroll', scheduleFrame, { passive: true });
  window.addEventListener('resize', onResize);

  /* Init rest-of-page interactions */
  initPageAnimations();
}

/* ═══════════════════════════════════════════════════════════════════
   CANVAS RESIZE
═══════════════════════════════════════════════════════════════════ */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;

  /* Physical pixels — prevents blurry canvas on HiDPI screens */
  canvas.width  = w * dpr;
  canvas.height = h * dpr;

  /* CSS size stays at logical pixels */
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  /* Scale context so all draw calls use logical coordinates */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawFrame(currentFrame);
}

function onResize() {
  const scrollTravel = TOTAL * PX_PER_FRAME;
  heroSection.style.height = (window.innerHeight + scrollTravel) + 'px';
  resizeCanvas();
}

/* ═══════════════════════════════════════════════════════════════════
   DRAW FRAME — cover-fit + canvas vignette blend
═══════════════════════════════════════════════════════════════════ */
function drawFrame(index) {
  const img = images[index];

  /* Use logical viewport size — ctx is already scaled by DPR */
  const cw = window.innerWidth;
  const ch = window.innerHeight;

  /* Always fill black first */
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);

  if (!img || !img.complete || img.naturalWidth === 0) return;

  /* Contain-fit: show the full frame, no cropping, no zoom.
     Black background fills any letterbox gaps (already cleared above). */
  const scaleX = cw / img.naturalWidth;
  const scaleY = ch / img.naturalHeight;
  const scale  = Math.min(scaleX, scaleY);   // contain — never upscale beyond 1:1
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  /* ── Thin edge fade — only the outermost 8% of each edge ── */
  // Top
  const gt = ctx.createLinearGradient(0, 0, 0, ch * 0.08);
  gt.addColorStop(0, 'rgba(0,0,0,1)');
  gt.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gt; ctx.fillRect(0, 0, cw, ch * 0.08);

  // Bottom
  const gb = ctx.createLinearGradient(0, ch, 0, ch * 0.92);
  gb.addColorStop(0, 'rgba(0,0,0,1)');
  gb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gb; ctx.fillRect(0, ch * 0.92, cw, ch * 0.08);

  // Left
  const gl = ctx.createLinearGradient(0, 0, cw * 0.05, 0);
  gl.addColorStop(0, 'rgba(0,0,0,0.85)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, cw * 0.05, ch);

  // Right
  const gr = ctx.createLinearGradient(cw, 0, cw * 0.95, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(cw * 0.95, 0, cw * 0.05, ch);
}

/* ═══════════════════════════════════════════════════════════════════
   SCROLL HANDLER — rAF-throttled
═══════════════════════════════════════════════════════════════════ */
function scheduleFrame() {
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(onScrollFrame);
  }
}

function onScrollFrame() {
  rafPending = false;

  const scrollY = window.scrollY;

  /* heroSection.offsetTop gives the absolute Y of the section from
     the document top — reliable even after layout changes */
  const sectionTop   = heroSection.offsetTop;
  const scrollTravel = TOTAL * PX_PER_FRAME;

  /* How many px we've scrolled INTO the animation zone */
  const scrolledIn = scrollY - sectionTop;

  /* Clamp to animation range */
  const clamped  = Math.max(0, Math.min(scrolledIn, scrollTravel));
  const progress = clamped / scrollTravel;                    // 0 → 1
  const frameIdx = Math.min(Math.floor(progress * TOTAL), TOTAL - 1);

  /* Only redraw if frame changed */
  if (frameIdx !== currentFrame) {
    currentFrame = frameIdx;
    drawFrame(frameIdx);
  }

  /* Progress bar */
  if (progressFill) progressFill.style.width = (progress * 100).toFixed(2) + '%';

  /* Sequence label */
  const seqIdx = FRAMES[frameIdx].seqIndex;
  if (seqLabel) seqLabel.textContent = SEQUENCES[seqIdx].label;

  /* Phase text visibility
     Each phase is visible from 8% into its own sequence to 88% */
  updatePhaseText(progress, seqIdx);

  /* Hide scroll hint once user starts scrolling */
  if (scrollHint && scrolledIn > 20) {
    scrollHint.style.opacity = '0';
  }
}

/* ── Which phase text to show ────────────────────────────────────── */
function updatePhaseText(globalProgress, seqIdx) {
  /* Compute progress within the current sequence */
  let seqStart = 0;
  for (let i = 0; i < seqIdx; i++) seqStart += SEQUENCES[i].count;
  const seqProgress = (currentFrame - seqStart) / SEQUENCES[seqIdx].count;

  const showPhase = (el, show) => {
    if (!el) return;
    if (show) el.classList.add('active');
    else      el.classList.remove('active');
  };

  const inWindow = seqProgress > 0.06 && seqProgress < 0.88;

  showPhase(phase1, seqIdx === 0 && inWindow);
  showPhase(phase2, seqIdx === 1 && inWindow);
  showPhase(phase3, seqIdx === 2 && inWindow);
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE ANIMATIONS (counters, reveal, swatches, navbar, tilt)
═══════════════════════════════════════════════════════════════════ */
function initPageAnimations() {

  /* Navbar */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const delay = parseInt(e.target.dataset.delay || 0);
        setTimeout(() => e.target.classList.add('visible'), delay);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObs.observe(el));

  /* Animated counters */
  function animateCounter(el, target, dur) {
    const dec   = String(target).includes('.');
    const start = performance.now();
    const tick  = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const v = (1 - Math.pow(1 - t, 3)) * target;
      el.textContent = dec ? v.toFixed(1) : Math.round(v);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const statObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const numEl  = e.target.querySelector('.stat-number');
        const fillEl = e.target.querySelector('.stat-fill');
        animateCounter(numEl, parseFloat(numEl.dataset.target), 1800);
        if (fillEl) setTimeout(() => fillEl.classList.add('animated'), 200);
        statObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.stat-card').forEach(c => statObs.observe(c));

  /* Colour swatches */
  const swatches   = document.querySelectorAll('.swatch');
  const swatchName = document.getElementById('swatchName');
  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      swatchName.style.opacity = '0';
      setTimeout(() => { swatchName.textContent = sw.dataset.name; swatchName.style.opacity = '1'; }, 200);
    });
  });

  /* Smooth anchor scroll */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  /* Card tilt */
  document.querySelectorAll('.stat-card, .design-card, .spec-group').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x*6}deg) rotateX(${-y*6}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  /* Grab all DOM refs */
  canvas       = document.getElementById('heroCanvas');
  ctx          = canvas.getContext('2d');
  heroSection  = document.getElementById('hero');
  heroSticky   = document.getElementById('heroSticky');
  progressFill = document.getElementById('heroProgress');
  seqLabel     = document.getElementById('seqLabel');
  scrollHint   = document.getElementById('scrollHint');
  phase1       = document.getElementById('phase1');
  phase2       = document.getElementById('phase2');
  phase3       = document.getElementById('phase3');
  loaderEl     = document.getElementById('loader');
  loaderBar    = document.getElementById('loaderBar');
  loaderPct    = document.getElementById('loaderPct');

  preloadAll();
});
