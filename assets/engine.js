/* Learn Meta Ads: shared canvas engine and site chrome.
   A lesson loads this file, then registers its scenes with LMA.scene(sectionId, {W, H, dur, loop, rest, draw}).
   draw(ctx, t, s) must be a pure function of t on a logical canvas W wide (400 by default) and H tall. */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const TAU = Math.PI * 2;
const C = {};
const TOKENS = {bg:'bg', surface:'surface', ink:'ink', muted:'muted', line:'line', faint:'faint', you:'you', yousoft:'you-soft', onyou:'on-you', alt:'alt', altsoft:'alt-soft', win:'win', onwin:'on-win', loss:'loss', losssoft:'loss-soft'};
function readColors(){ const cs = getComputedStyle(root); for (const k in TOKENS) C[k] = cs.getPropertyValue('--' + TOKENS[k]).trim(); }
readColors();

const FONT = 'Recursive, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, x) => a + (b - a) * x;
function rng(seed){ return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rrect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function txt(ctx, s, x, y, o = {}){
  ctx.save();
  ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.font = `${o.w ?? 600} ${o.size ?? 13}px ${FONT}`;
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(ctx, s, size = 13, w = 600){ ctx.save(); ctx.font = `${w} ${size}px ${FONT}`; const m = ctx.measureText(s).width; ctx.restore(); return m; }
function shape(ctx, type, x, y, r){
  ctx.beginPath();
  if (type === 0) ctx.arc(x, y, r, 0, TAU);
  else if (type === 1) ctx.rect(x - r * .88, y - r * .88, r * 1.76, r * 1.76);
  else if (type === 2){ ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.08, y + r * .82); ctx.lineTo(x - r * 1.08, y + r * .82); ctx.closePath(); }
  else { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.08, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.08, y); ctx.closePath(); }
}
function star(ctx, x, y, r){
  ctx.beginPath();
  for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function arrow(ctx, x1, y1, x2, y2, o = {}){
  const col = o.color ?? C.muted, w = o.w ?? 1.5, hd = o.head ?? 6, a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hd * .6, y2 - Math.sin(a) * hd * .6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - .45) * hd, y2 - Math.sin(a - .45) * hd); ctx.lineTo(x2 - Math.cos(a + .45) * hd, y2 - Math.sin(a + .45) * hd); ctx.closePath(); ctx.fill();
  ctx.restore();
}
const money = (x, d = 0) => (x < 0 ? '−$' : '$') + Math.abs(x).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
const num = (x, d = 0) => x.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});

/* ---------- scene runner ---------- */
const scenes = [];
let raf = 0, lastNow = 0;
function kick(){ if (!raf){ lastNow = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(now){
  const dt = Math.min(.05, (now - lastNow) / 1000); lastNow = now;
  let any = false;
  for (const s of scenes){
    if (!s.playing) continue;
    if (s.loop && !s.visible) continue;
    s.t += dt;
    if (!s.loop && s.t >= s.dur){ s.t = s.dur; s.playing = false; }
    s.render(); any = true;
  }
  raf = any ? requestAnimationFrame(frame) : 0;
}
const io = new IntersectionObserver(es => {
  for (const e of es){
    const s = e.target.__scene; s.visible = e.isIntersecting;
    if (!e.isIntersecting) continue;
    if (!s.seen){ s.seen = true; if (s.autoplay) s.play(0); }
    else if (s.loop && s.playing) kick();
  }
}, {threshold:.35});
const ro = new ResizeObserver(es => es.forEach(e => e.target.__scene.size()));

function scene(id, o){
  const sec = document.getElementById(id);
  const cv = o.canvas ? sec.querySelector(o.canvas) : sec.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const s = Object.assign({W:400, H:300, dur:5, loop:false, autoplay:true}, o, {sec, cv, ctx, playing:false, seen:false, visible:false, k:1});
  s.t = s.rest ?? s.dur;
  cv.style.aspectRatio = `${s.W} / ${s.H}`;
  s.render = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s.k, 0, 0, s.k, 0, 0);
    s.draw(ctx, s.t, s);
  };
  s.size = () => {
    const w = cv.clientWidth || s.W, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * s.H / s.W * dpr);
    s.k = cv.width / s.W; s.render();
  };
  s.play = (from = 0) => {
    if (reduce){ s.t = s.rest ?? s.dur; s.playing = false; s.render(); return; }
    s.t = from; s.playing = true; kick();
  };
  s.still = () => { s.playing = false; s.t = s.rest ?? s.dur; s.render(); };
  s.toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * s.W / r.width, (e.clientY - r.top) * s.H / r.height]; };
  sec.querySelectorAll('[data-replay]').forEach(b => b.addEventListener('click', () => s.play(0)));
  cv.__scene = s;
  scenes.push(s);
  /* wait until the lesson script has finished defining its state, then size, draw and observe */
  queueMicrotask(() => { io.observe(cv); ro.observe(cv); s.size(); });
  return s;
}

function retheme(){ readColors(); scenes.forEach(s => s.render()); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
new MutationObserver(retheme).observe(root, {attributes:true, attributeFilter:['data-theme']});
if (document.fonts) document.fonts.ready.then(() => scenes.forEach(s => s.render()));

/* ---------- theme button: auto → light → dark ---------- */
const ORDER = ['auto', 'light', 'dark'];
function current(){ return root.dataset.theme === 'light' || root.dataset.theme === 'dark' ? root.dataset.theme : 'auto'; }
function paintBtn(b){ const m = current(); b.textContent = 'Theme: ' + m; b.setAttribute('aria-label', 'Colour theme: ' + m + '. Change theme'); }
document.querySelectorAll('[data-theme-btn]').forEach(b => {
  paintBtn(b);
  b.addEventListener('click', () => {
    const next = ORDER[(ORDER.indexOf(current()) + 1) % 3];
    if (next === 'auto') delete root.dataset.theme; else root.dataset.theme = next;
    try { if (next === 'auto') localStorage.removeItem('lma-theme'); else localStorage.setItem('lma-theme', next); } catch (e) {}
    document.querySelectorAll('[data-theme-btn]').forEach(paintBtn);
  });
});

window.LMA = {C, TAU, FONT, reduce, clamp, seg, easeIO, easeOut, lerp, rng, shuffle, rrect, txt, measure, shape, star, arrow, money, num, scene, scenes};
})();
