// app.js (ES module)
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// Theme toggle
const themeBtn = qs('#themeBtn');
function applyTheme(t) {
  document.body.classList.toggle('light', t==='light');
  document.body.classList.toggle('dark', t!=='light');
  themeBtn.querySelector('.only').textContent = t==='light' ? '☀️' : '🌙';
}
let theme = localStorage.getItem('theme') || 'dark';
applyTheme(theme);
themeBtn.addEventListener('click', () => {
  theme = (theme==='dark' ? 'light' : 'dark');
  localStorage.setItem('theme', theme);
  applyTheme(theme);
});

// Simple modal wiring
document.addEventListener('click', (e)=>{
  const openId = e.target.getAttribute('data-open');
  if (openId) { qs(`#${openId}`)?.classList.add('open'); }
  const closeId = e.target.getAttribute('data-close');
  if (closeId) { qs(`#${closeId}`)?.classList.remove('open'); }
  if (e.target.classList.contains('backdrop')) {
    const id = e.target.getAttribute('data-close');
    if (id) qs(`#${id}`)?.classList.remove('open');
  }
});

// Keyboard lift via VisualViewport + VirtualKeyboard
(function keyboardLift(){
  function setKb(px){ document.documentElement.style.setProperty('--kb', Math.max(0, px) + 'px'); }
  if ('virtualKeyboard' in navigator) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener('geometrychange', (e)=> setKb(e.target.boundingRect.height||0) );
    } catch(e){}
  }
  if (window.visualViewport){
    const vv = window.visualViewport;
    const onVv = ()=> setKb( Math.max(0, (window.innerHeight - (vv.height||window.innerHeight))) );
    vv.addEventListener('resize', onVv);
    vv.addEventListener('scroll', onVv);
  }
})();

// Service worker register (shell now, richer logic next steps)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
