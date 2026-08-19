const P = {
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  folder:'<path d="M3.5 7.2c0-1 .8-1.9 1.9-1.9h3.4l1.9 2.1h8.4c1 0 1.9.8 1.9 1.9v7.4c0 1-.8 1.9-1.9 1.9H5.4c-1 0-1.9-.8-1.9-1.9Z"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  checkCircle:'<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.4l2.5 2.5 5.1-5.6"/>',
  check:'<path d="M5.5 12.5l4.3 4.3L18.5 7.5"/>',
  box:'<path d="M12 3.2 20.6 7.4v9.2L12 20.8 3.4 16.6V7.4Z"/><path d="M3.4 7.4 12 11.6l8.6-4.2M12 11.6v9.2"/>',
  bulb:'<path d="M12 3.5a5.8 5.8 0 0 1 3.4 10.5c-.6.5-.9 1.2-.9 2h-5c0-.8-.3-1.5-.9-2A5.8 5.8 0 0 1 12 3.5Z"/><path d="M9.8 19.2h4.4M10.6 21.4h2.8"/>',
  doc:'<path d="M6.5 3.5h7l4 4v13h-11Z"/><path d="M13.2 3.8V7.8h4"/><path d="M9.3 12.4h5.4M9.3 15.6h5.4"/>',
  banknote:'<rect x="3" y="7" width="18" height="10" rx="2.2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 10v4M17.5 10v4"/>',
  tag:'<path d="M3.5 3.5h7l10 10-7 7-10-10Z"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
  sparkle:'<path d="M12 3.5c.7 4.3 2.2 5.8 6.5 6.5-4.3.7-5.8 2.2-6.5 6.5-.7-4.3-2.2-5.8-6.5-6.5 4.3-.7 5.8-2.2 6.5-6.5Z"/>',
  chevron:'<path d="M9.2 5.2 16 12l-6.8 6.8"/>',
  back:'<path d="M14.8 5.2 8 12l6.8 6.8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  pencil:'<path d="M4.5 19.5h4L19.8 8.2a2.2 2.2 0 0 0-4-4L4.5 15.5Z"/><path d="M13.5 6.5l4 4"/>',
  arrowUpRight:'<path d="M7 17 17 7M9.5 7H17v7.5"/>',
  alert:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4v5.4"/><circle cx="12" cy="16.5" r="1.05" fill="currentColor" stroke="none"/>',
  pauseCircle:'<circle cx="12" cy="12" r="8.5"/><path d="M9.7 8.8v6.4M14.3 8.8v6.4"/>',
  pause:'<path d="M9.5 7.5v9M14.5 7.5v9"/>',
  circle:'<circle cx="12" cy="12" r="8.5"/>',
  play:'<path d="M8.5 6.8v10.4L17.8 12Z"/>',
  search:'<circle cx="11" cy="11" r="6.2"/><path d="M15.8 15.8 20 20"/>',
  list:'<path d="M9.4 6h10.6M9.4 12h10.6M9.4 18h10.6"/><circle cx="4.7" cy="6" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.7" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.7" cy="18" r="1.15" fill="currentColor" stroke="none"/>',
  person:'<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2"/>',
  moon:'<path d="M19.5 14.4A8 8 0 1 1 9.6 4.5a6.6 6.6 0 0 0 9.9 9.9Z"/>',
  share:'<path d="M12 15.5V4M8.2 7.6 12 3.8l3.8 3.8"/><path d="M5 12.5v7h14v-7"/>',
  archive:'<rect x="3.5" y="4" width="17" height="4.4" rx="1.2"/><path d="M5 8.4v10.1h14V8.4M9.8 12.2h4.4"/>',
  bell:'<path d="M12 4a5.5 5.5 0 0 1 5.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0 1 12 4Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  cloud:'<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 11a3.8 3.8 0 0 1-.7 7.5Z"/>'
};
let gear = '<circle cx="12" cy="12" r="3.1"/>';
for (let i = 0; i < 8; i++) gear += '<rect x="11.15" y="2.5" width="1.7" height="4.4" rx=".85" transform="rotate(' + (i*45) + ' 12 12)"/>';
gear += '<circle cx="12" cy="12" r="7.4"/>';
P.gear = gear;

function ic(name, size = 20) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + P[name] + '</svg>';
}

/* ================= shared chrome ================= */
function statusBar() {
  return '<div class="statusbar"><span>9:41</span><span class="sb-dots"><i></i><i></i><i></i></span></div>';
}
function tabbar(active) {
  // app tabs per design doc: Dashboard / Library / Setting
  const tabs = [['dashboard','grid','Dashboard'],['library','folder','Library'],['setting','gear','Setting']];
  return '<nav class="tabbar">' + tabs.map(t =>
    '<button class="tab' + (t[0] === active ? ' active' : '') + '" data-root="' + t[0] + '">' +
    '<span class="tab-ic">' + ic(t[1], 22) + '</span><span>' + t[2] + '</span></button>'
  ).join('') + '</nav>';
}
function inlineNav(title, rightIcon) {
  return '<div class="nav-inline">' +
    '<button class="nav-back press" data-back>' + ic('back', 12) + '</button>' +
    '<div class="nav-title">' + title + '</div>' +
    (rightIcon ? '<div class="nav-right"><button class="nav-btn press">' + ic(rightIcon, 19) + '</button></div>' : '') +
  '</div>';
}
function sec(title) {
  return '<div class="sec-head"><h2>' + title + '</h2></div>';
}
function activityPanel(rows) {
  return '<div class="panel">' + rows.map(r =>
    '<div class="row"><span class="chip">' + ic(r.i, 17) + '</span>' +
    '<div class="row-main"><div class="row-title">' + r.t + '</div><div class="row-sub">' + r.s + '</div></div>' +
    '<span class="row-meta">' + r.w + '</span></div>'
  ).join('') + '</div>';
}
const CHEV = '<span class="chev">' + ic('chevron', 9) + '</span>';

/* ================= page map (screen id -> file) ================= */
const PAGE_MAP = {
  'dashboard':      '../dashboard/dashboard.html',
  'attention-pin':  '../dashboard/attention-pin.html',
  'library':        '../library/library.html',
  'goals':          '../goals/goals.html',
  'goal-detail':    '../goals/goal-detail.html',
  'project-detail': '../goals/project-detail.html',
  'ideas':          '../ideas/ideas.html',
  'setting':        '../setting/setting.html',
};

/* ================= render this page's phone ================= */
// Each page file defines SCREEN (a function returning the screen HTML)
// and PAGE_TITLE before loading this script.
const wrap = document.createElement('figure');
wrap.className = 'phone-wrap';
const phone = document.createElement('div');
phone.className = 'phone';
phone.innerHTML =
  '<section class="screen active">' + SCREEN() + '</section>' +
  '<div class="island"></div><div class="home"></div>';
const cap = document.createElement('figcaption');
cap.textContent = PAGE_TITLE;
wrap.appendChild(phone);
wrap.appendChild(cap);
document.getElementById('board').appendChild(wrap);

/* ================= interactions ================= */
document.addEventListener('click', e => {
  const root = e.target.closest('[data-root]');
  if (root) { location.href = PAGE_MAP[root.dataset.root]; return; }
  const back = e.target.closest('[data-back]');
  if (back) { history.back(); return; }
  const segBtn = e.target.closest('[data-seg]');
  if (segBtn) {
    const segWrap = segBtn.closest('.segmented');
    segWrap.querySelectorAll('[data-seg]').forEach(b => b.classList.toggle('active', b === segBtn));
    const screen = segBtn.closest('.screen');
    screen.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== segBtn.dataset.seg));
    return;
  }
  const go = e.target.closest('[data-go]');
  if (go && PAGE_MAP[go.dataset.go]) location.href = PAGE_MAP[go.dataset.go];
});
