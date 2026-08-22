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
  pin:'<path d="M9 3.8h6"/><path d="M10 3.8 9.2 9.6 6.8 12v1.6h10.4V12L14.8 9.6 14 3.8"/><path d="M12 13.6v6.6"/>',
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

/* ================= goal labels ================= */
const LABEL_COLORS = { Health:'green', Work:'amber', Growth:'blue', Finance:'red', Language:'gray' };
function lbl(name, editable) {
  const c = LABEL_COLORS[name] || 'gray';
  return '<span class="lbl ' + c + '" data-label="' + name + '"><i></i>' + name +
    (editable ? '<b class="lbl-x" data-label-del>×</b>' : '') + '</span>';
}
function lblRow(labels) {
  return '<div class="gd-labels" data-labels>' +
    labels.map(n => lbl(n, true)).join('') +
    '<button class="lbl-add" data-label-add>' + ic('plus', 11) + 'Add</button>' +
    '<button class="lbl-edit" data-label-edit>' + ic('pencil', 11) + '<span>Edit</span></button>' +
  '</div>';
}

/* ================= page map (screen id -> file) ================= */
const PAGE_MAP = {
  'dashboard':      '../dashboard/dashboard.html',
  'attention-pin':  '../dashboard/attention-pin.html',
  'library':        '../library/library.html',
  'goals':          '../goals/goals.html',
  'goal-detail':    '../goals/goal-detail.html',
  'project-detail': '../goals/project-detail.html',
  'tasks':          '../tasks/tasks.html',
  'task-detail':    '../tasks/task-detail.html',
  'add-plan-item':  '../goals/add-plan-item.html',
  'select-span':    '../goals/select-span.html',
  'allocate-resource': '../goals/allocate-resource.html',
  'ideas':          '../ideas/ideas.html',
  'idea-detail':    '../ideas/idea-detail.html',
  'notes':          '../notes/notes.html',
  'note-detail':    '../notes/note-detail.html',
  'setting':        '../setting/setting.html',
};

/* ================= create from idea ================= */
function ideaSourceTitle(trigger) {
  return trigger.dataset.ideaTitle || 'Auto-generate a weekly review';
}

function deriveChoices(title) {
  return '<div class="idea-sheet-head"><span class="idea-sheet-spacer"></span><h2>Create from idea</h2><button class="idea-sheet-icon" data-sheet-close>' + ic('minus', 18) + '</button></div>' +
    '<div class="idea-sheet-source">' + title + '</div>' +
    '<button class="derive-choice" data-create-type="goal" data-idea-title="' + title + '"><span class="chip">' + ic('target', 19) + '</span><span class="derive-choice-main"><span class="derive-choice-title">Goal</span><span class="derive-choice-sub">Turn the idea into a target to achieve</span></span>' + CHEV + '</button>' +
    '<button class="derive-choice" data-create-type="task" data-idea-title="' + title + '"><span class="chip">' + ic('checkCircle', 19) + '</span><span class="derive-choice-main"><span class="derive-choice-title">Task</span><span class="derive-choice-sub">Add an action to an existing project</span></span>' + CHEV + '</button>' +
    '<button class="derive-choice" data-create-type="note" data-idea-title="' + title + '"><span class="chip">' + ic('doc', 19) + '</span><span class="derive-choice-main"><span class="derive-choice-title">Note</span><span class="derive-choice-sub">Keep the thought as reusable knowledge</span></span>' + CHEV + '</button>';
}

function deriveForm(type, title) {
  const names = { goal: 'New goal', task: 'New task', note: 'New note' };
  const icons = { goal: 'target', task: 'checkCircle', note: 'doc' };
  let fields = '';
  if (type === 'goal') {
    fields = '<div class="derive-field"><label>Title</label><input value="' + title + '"></div>' +
      '<div class="derive-field"><label>Description</label><textarea>Summarize records and completed work every Sunday.</textarea></div>' +
      '<div class="derive-field"><label>Target date</label><input placeholder="Optional"></div>';
  } else if (type === 'task') {
    fields = '<div class="derive-field"><label>Title</label><input value="' + title + '"></div>' +
      '<div class="derive-field"><label>Project · required</label><div class="derive-picker"><span>Becoming MVP</span>' + CHEV + '</div></div>' +
      '<div class="derive-field"><label>Goal</label><div class="derive-picker"><span>Weekly reflection</span>' + CHEV + '</div></div>';
  } else {
    fields = '<div class="derive-field"><label>Content</label><textarea>' + title + '\n\nSummarize records and completed work every Sunday.</textarea></div>';
  }
  return '<div class="idea-sheet-head"><button class="idea-sheet-icon" data-sheet-back>' + ic('back', 13) + '</button><h2>' + names[type] + '</h2><button class="idea-sheet-icon" data-sheet-close>' + ic('minus', 18) + '</button></div>' +
    '<div class="idea-sheet-source"><span class="idea-state exploring">Derived from idea</span> · ' + title + '</div>' + fields +
    '<button class="derive-save" data-derive-save data-create-type="' + type + '">' + ic(icons[type], 14) + ' Create ' + type + '</button>' +
    '<div class="derive-hint">The idea is preserved, linked to the new ' + type + ', and moved to Handled.</div>';
}

function openDeriveSheet(trigger, selectedType) {
  const phone = trigger.closest('.phone');
  if (!phone) return;
  const title = ideaSourceTitle(trigger);
  const layer = document.createElement('div');
  layer.className = 'idea-sheet-layer';
  layer.dataset.ideaTitle = title;
  layer.innerHTML = '<button class="idea-sheet-dismiss" data-sheet-close aria-label="Close"></button><div class="idea-sheet"><div class="idea-sheet-handle"></div><div data-sheet-content>' + (selectedType ? deriveForm(selectedType, title) : deriveChoices(title)) + '</div></div>';
  phone.appendChild(layer);
}

function showPrototypeToast(phone, message) {
  phone.querySelector('.prototype-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'prototype-toast';
  toast.textContent = message;
  phone.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

/* ================= universal capture ================= */
const CAPTURE_KINDS = {
  inbox: {
    label: 'Decide later',
    icon: 'sparkle',
    placeholder: 'What’s on your mind?',
    action: 'Save to inbox',
    hint: 'Capture now. Organize later.',
    toast: 'Saved to inbox',
  },
  idea: {
    label: 'Idea',
    icon: 'bulb',
    placeholder: 'Describe the idea before it slips away…',
    action: 'Capture idea',
    hint: 'You can explore or derive it later.',
    toast: 'Idea captured',
  },
  task: {
    label: 'Task',
    icon: 'checkCircle',
    placeholder: 'What needs to be done?',
    action: 'Create task',
    hint: 'Choose the Project this task belongs to.',
    toast: 'Task created',
  },
  goal: {
    label: 'Goal',
    icon: 'target',
    placeholder: 'What would you like to become or achieve?',
    action: 'Create goal',
    hint: 'Start with the outcome. Plan it later.',
    toast: 'Goal created',
  },
  note: {
    label: 'Note',
    icon: 'doc',
    placeholder: 'Write something worth remembering…',
    action: 'Save note',
    hint: 'Links and labels can be added later.',
    toast: 'Note saved',
  },
};

function captureTaskContext() {
  return '<div class="capture-context" data-capture-context>' +
    '<label class="capture-project-label" for="capture-project">Project <span>Required</span></label>' +
    '<select class="capture-project" id="capture-project" data-capture-project>' +
      '<option value="">Select a project</option>' +
      '<option value="becoming-mvp" selected>Becoming MVP · Active</option>' +
      '<option value="weekly-reflection">Weekly reflection · Planning</option>' +
    '</select>' +
    '<div class="capture-project-help">No project yet? Create a project first, or <button data-capture-fallback>save this to Decide later</button>.</div>' +
  '</div>';
}

function updateCaptureSubmit(layer) {
  const content = layer.querySelector('[data-capture-input]').value.trim();
  const selected = layer.querySelector('[data-capture-kind].selected')?.dataset.captureKind;
  const project = layer.querySelector('[data-capture-project]');
  layer.querySelector('[data-capture-save]').disabled = content === '' ||
    (selected === 'task' && (!project || project.value === ''));
}

function captureButton() {
  return '<button class="capture-fab" data-capture-open aria-label="Capture anything"><span class="capture-fab-icon">' + ic('plus', 18) + '</span><span>Capture</span></button>';
}

function captureSheet() {
  return '<div class="capture-layer">' +
    '<button class="capture-dismiss" data-capture-close aria-label="Close capture"></button>' +
    '<section class="capture-sheet" aria-label="Capture anything">' +
      '<div class="capture-handle"></div>' +
      '<div class="capture-head"><div class="capture-head-copy"><h2>Capture anything</h2><p>Get it out now. Shape it whenever you’re ready.</p></div><button class="capture-close" data-capture-close aria-label="Close">' + ic('minus', 15) + '</button></div>' +
      '<textarea class="capture-input" data-capture-input placeholder="' + CAPTURE_KINDS.inbox.placeholder + '"></textarea>' +
      '<div class="capture-label">Make it a</div>' +
      '<div class="capture-kinds">' + Object.entries(CAPTURE_KINDS).map(([key, kind]) =>
        '<button class="capture-kind' + (key === 'inbox' ? ' selected' : '') + '" data-capture-kind="' + key + '">' + ic(kind.icon, 14) + '<span>' + kind.label + '</span></button>'
      ).join('') + '</div>' +
      '<div data-capture-context-slot></div>' +
      '<div class="capture-foot"><span class="capture-hint" data-capture-hint>' + CAPTURE_KINDS.inbox.hint + '</span><button class="capture-save" data-capture-save disabled><span>' + CAPTURE_KINDS.inbox.action + '</span>' + ic('arrowUpRight', 14) + '</button></div>' +
    '</section>' +
  '</div>';
}

function openCapture(phone) {
  phone.querySelector('.capture-layer')?.remove();
  phone.insertAdjacentHTML('beforeend', captureSheet());
  phone.querySelector('[data-capture-input]').focus();
}

function selectCaptureKind(button) {
  const layer = button.closest('.capture-layer');
  const key = button.dataset.captureKind;
  const kind = CAPTURE_KINDS[key];
  layer.querySelectorAll('[data-capture-kind]').forEach(option => option.classList.toggle('selected', option === button));
  layer.querySelector('[data-capture-input]').placeholder = kind.placeholder;
  layer.querySelector('[data-capture-hint]').textContent = kind.hint;
  layer.querySelector('[data-capture-save] span').textContent = kind.action;
  layer.querySelector('[data-capture-context-slot]').innerHTML = key === 'task' ? captureTaskContext() : '';
  updateCaptureSubmit(layer);
}

const IDEA_STATUS = {
  captured: { label: 'Captured', icon: 'circle', description: 'Saved and waiting to be processed' },
  exploring: { label: 'Exploring', icon: 'sparkle', description: 'Actively developing this idea' },
  paused: { label: 'Paused', icon: 'pauseCircle', description: 'Set aside for now' },
  handled: { label: 'Handled', icon: 'check', description: 'Processed into useful outcomes' },
};

function statusChoices(current) {
  return '<div class="idea-sheet-head"><span class="idea-sheet-spacer"></span><h2>Change status</h2><button class="idea-sheet-icon" data-sheet-close>' + ic('minus', 18) + '</button></div>' +
    '<div class="idea-sheet-source">Choose where this idea belongs in your thinking workflow.</div>' +
    Object.entries(IDEA_STATUS).map(([key, status]) =>
      '<button class="derive-choice" data-status-select="' + key + '"><span class="pill ' + key + '">' + ic(status.icon, 11) + status.label + '</span><span class="derive-choice-main"><span class="derive-choice-sub">' + status.description + '</span></span><span class="status-choice-mark">' + (key === current ? ic('check', 15) : '') + '</span></button>'
    ).join('');
}

function openStatusSheet(trigger) {
  const phone = trigger.closest('.phone');
  if (!phone) return;
  const layer = document.createElement('div');
  layer.className = 'idea-sheet-layer';
  layer.innerHTML = '<button class="idea-sheet-dismiss" data-sheet-close aria-label="Close"></button><div class="idea-sheet"><div class="idea-sheet-handle"></div><div data-sheet-content>' + statusChoices(trigger.dataset.statusCurrent) + '</div></div>';
  phone.appendChild(layer);
}

/* ================= render this page's phone ================= */
// Each page file defines SCREEN (a function returning the screen HTML)
// and PAGE_TITLE before loading this script.
const wrap = document.createElement('figure');
wrap.className = 'phone-wrap';
const phone = document.createElement('div');
phone.className = 'phone';
phone.innerHTML =
  '<section class="screen active">' + SCREEN() + '</section>' +
  captureButton() +
  '<div class="island"></div><div class="home"></div>';
phone.classList.toggle('has-tabbar', Boolean(phone.querySelector('.tabbar')));
const cap = document.createElement('figcaption');
cap.textContent = PAGE_TITLE;
wrap.appendChild(phone);
wrap.appendChild(cap);
document.getElementById('board').appendChild(wrap);

/* ================= interactions ================= */
document.addEventListener('click', e => {
  const captureOpen = e.target.closest('[data-capture-open]');
  if (captureOpen) { openCapture(captureOpen.closest('.phone')); return; }
  const captureClose = e.target.closest('[data-capture-close]');
  if (captureClose) { captureClose.closest('.capture-layer').remove(); return; }
  const captureKind = e.target.closest('[data-capture-kind]');
  if (captureKind) { selectCaptureKind(captureKind); return; }
  const captureFallback = e.target.closest('[data-capture-fallback]');
  if (captureFallback) {
    const layer = captureFallback.closest('.capture-layer');
    selectCaptureKind(layer.querySelector('[data-capture-kind="inbox"]'));
    layer.querySelector('[data-capture-input]').focus();
    return;
  }
  const captureSave = e.target.closest('[data-capture-save]');
  if (captureSave) {
    if (captureSave.disabled) return;
    const phone = captureSave.closest('.phone');
    const selected = captureSave.closest('.capture-layer').querySelector('[data-capture-kind].selected');
    const toast = CAPTURE_KINDS[selected.dataset.captureKind].toast;
    captureSave.closest('.capture-layer').remove();
    showPrototypeToast(phone, toast);
    return;
  }
  const statusOpen = e.target.closest('[data-status-open]');
  if (statusOpen) { openStatusSheet(statusOpen); return; }
  const statusSelect = e.target.closest('[data-status-select]');
  if (statusSelect) {
    const phone = statusSelect.closest('.phone');
    const key = statusSelect.dataset.statusSelect;
    const status = IDEA_STATUS[key];
    const control = phone.querySelector('[data-status-open]');
    control.dataset.statusCurrent = key;
    control.querySelector('[data-status-pill]').className = 'pill ' + key;
    control.querySelector('[data-status-pill]').innerHTML = ic(status.icon, 11) + status.label;
    statusSelect.closest('.idea-sheet-layer').remove();
    showPrototypeToast(phone, 'Idea moved to ' + status.label);
    return;
  }
  const deriveOpen = e.target.closest('[data-derive-open]');
  if (deriveOpen) { openDeriveSheet(deriveOpen); return; }
  const createType = e.target.closest('[data-create-type]');
  if (createType && !createType.matches('[data-derive-save]')) {
    const layer = createType.closest('.idea-sheet-layer');
    if (!layer) { openDeriveSheet(createType, createType.dataset.createType); return; }
    layer.querySelector('[data-sheet-content]').innerHTML = deriveForm(createType.dataset.createType, layer.dataset.ideaTitle);
    return;
  }
  const sheetBack = e.target.closest('[data-sheet-back]');
  if (sheetBack) {
    const layer = sheetBack.closest('.idea-sheet-layer');
    layer.querySelector('[data-sheet-content]').innerHTML = deriveChoices(layer.dataset.ideaTitle);
    return;
  }
  const sheetClose = e.target.closest('[data-sheet-close]');
  if (sheetClose) { sheetClose.closest('.idea-sheet-layer').remove(); return; }
  const deriveSave = e.target.closest('[data-derive-save]');
  if (deriveSave) {
    const phone = deriveSave.closest('.phone');
    const type = deriveSave.dataset.createType;
    deriveSave.closest('.idea-sheet-layer').remove();
    const statusControl = phone.querySelector('[data-status-open]');
    if (statusControl) {
      statusControl.dataset.statusCurrent = 'handled';
      statusControl.querySelector('[data-status-pill]').className = 'pill handled';
      statusControl.querySelector('[data-status-pill]').innerHTML = ic('check', 11) + 'Handled';
    }
    if (type === 'note' && PAGE_MAP['note-detail']) {
      location.href = PAGE_MAP['note-detail'];
      return;
    }
    showPrototypeToast(phone, type[0].toUpperCase() + type.slice(1) + ' created from idea');
    return;
  }
  const pinToggle = e.target.closest('[data-pin-toggle]');
  if (pinToggle) {
    const on = pinToggle.classList.toggle('on');
    showPrototypeToast(pinToggle.closest('.phone'), on ? 'Pinned to top of Notes' : 'Unpinned');
    return;
  }
  const noteArchive = e.target.closest('[data-note-archive]');
  if (noteArchive) {
    const title = noteArchive.querySelector('.row-title');
    const archiving = title.textContent.trim() === 'Archive note';
    title.textContent = archiving ? 'Unarchive note' : 'Archive note';
    showPrototypeToast(noteArchive.closest('.phone'), archiving ? 'Note archived' : 'Note restored');
    return;
  }
  const linkAdd = e.target.closest('[data-link-add]');
  if (linkAdd) {
    linkAdd.insertAdjacentHTML('beforebegin',
      '<div class="row press" data-go="project-detail"><span class="chip">' + ic('box', 17) + '</span><div class="row-main"><div class="row-title">Becoming MVP</div><div class="row-sub">Project · linked just now</div></div>' + CHEV + '</div>');
    showPrototypeToast(linkAdd.closest('.phone'), 'Linked to project');
    return;
  }
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
  const lbWrap = e.target.closest('[data-labels]');
  if (lbWrap) {
    const lbDel = e.target.closest('[data-label-del]');
    if (lbDel) { lbDel.closest('.lbl').remove(); return; }
    const lbAdd = e.target.closest('[data-label-add]');
    if (lbAdd) {
      const used = Array.from(lbWrap.querySelectorAll('.lbl')).map(x => x.dataset.label);
      const next = Object.keys(LABEL_COLORS).find(n => !used.includes(n));
      if (next) lbAdd.insertAdjacentHTML('beforebegin', lbl(next, true));
      return;
    }
    const lbEdit = e.target.closest('[data-label-edit]');
    if (lbEdit) {
      const on = lbWrap.classList.toggle('editing');
      lbEdit.querySelector('span').textContent = on ? 'Done' : 'Edit';
      return;
    }
  }
  const go = e.target.closest('[data-go]');
  if (go && PAGE_MAP[go.dataset.go]) location.href = PAGE_MAP[go.dataset.go];
});

document.addEventListener('input', e => {
  if (!e.target.matches('[data-capture-input]')) return;
  updateCaptureSubmit(e.target.closest('.capture-layer'));
});

document.addEventListener('change', e => {
  if (!e.target.matches('[data-capture-project]')) return;
  const layer = e.target.closest('.capture-layer');
  layer.querySelector('[data-capture-context]').classList.toggle('missing', e.target.value === '');
  updateCaptureSubmit(layer);
});
