const API_BASE = '';
const STORAGE_KEY = 'nexora-super-todo.tasks';

const els = {
  addForm: document.getElementById('addForm'),
  title: document.getElementById('title'),
  notes: document.getElementById('notes'),
  dueDate: document.getElementById('dueDate'),
  priority: document.getElementById('priority'),

  taskList: document.getElementById('taskList'),
  empty: document.getElementById('empty'),

  search: document.getElementById('search'),
  sortBy: document.getElementById('sortBy'),

  filterButtons: Array.from(document.querySelectorAll('.seg')),
  clearCompleted: document.getElementById('clearCompleted'),

  statTotal: document.getElementById('statTotal'),
  statActive: document.getElementById('statActive'),
  statDone: document.getElementById('statDone'),

  modal: document.getElementById('modal'),
  closeModal: document.getElementById('closeModal'),
  editForm: document.getElementById('editForm'),
  modalTitle: document.getElementById('modalTitle'),
  modalToast: document.getElementById('modalToast'),
  editId: document.getElementById('editId'),
  editTitle: document.getElementById('editTitle'),
  editNotes: document.getElementById('editNotes'),
  editDueDate: document.getElementById('editDueDate'),
  editPriority: document.getElementById('editPriority'),
  deleteBtn: document.getElementById('deleteBtn')
};

let state = {
  tasks: [],
  filter: 'all',
  query: '',
  sortBy: 'createdDesc',
  modalTaskId: null,
  useLocalStore: location.hostname.endsWith('github.io')
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function readLocalTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function toast(message) {
  els.modalToast.hidden = false;
  els.modalToast.textContent = message;
  setTimeout(() => {
    els.modalToast.hidden = true;
  }, 1600);
}

function fmtDue(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return null;
  }
}

function priorityRank(p) {
  if (p === 'high') return 2;
  if (p === 'normal') return 1;
  return 0;
}

function filteredSortedTasks() {
  const q = state.query.trim().toLowerCase();
  let tasks = state.tasks.slice();

  if (state.filter === 'active') tasks = tasks.filter(t => !t.completed);
  if (state.filter === 'completed') tasks = tasks.filter(t => t.completed);
  if (q) tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(q));

  switch (state.sortBy) {
    case 'dueAsc':
      tasks.sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
      break;
    case 'priorityDesc':
      tasks.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
      break;
    case 'createdDesc':
    default:
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return tasks;
}

function renderStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.completed).length;
  const active = total - done;

  els.statTotal.textContent = String(total);
  els.statActive.textContent = String(active);
  els.statDone.textContent = String(done);
}

function render() {
  renderStats();

  const tasks = filteredSortedTasks();
  els.taskList.innerHTML = '';

  if (tasks.length === 0) {
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;

  const frag = document.createDocumentFragment();
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = `task ${t.completed ? 'is-done' : ''}`;
    li.innerHTML = `
      <div class="task-left">
        <button class="check" type="button" aria-label="Toggle complete">
          <span class="tick" aria-hidden="true">✓</span>
        </button>
        <div class="task-main">
          <p class="task-title">
            <span class="title-text">${escapeHtml(t.title)}</span>
            ${renderPriorityPill(t.priority)}
          </p>
          <div class="task-meta">
            <span class="pill">Created: ${new Date(t.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</span>
            ${t.dueDate ? `<span class="pill">Due: ${fmtDue(t.dueDate) ?? t.dueDate}</span>` : ''}
          </div>
          ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
        </div>
      </div>
      <div class="task-right">
        <div class="icon-row">
          <button class="icon-btn edit" type="button" aria-label="Edit">Edit</button>
          <button class="icon-btn del" type="button" aria-label="Delete">Del</button>
        </div>
      </div>
    `;

    li.querySelector('.check').addEventListener('click', () => toggleComplete(t.id));
    li.querySelector('.edit').addEventListener('click', () => openModal(t.id));
    li.querySelector('.del').addEventListener('click', () => deleteTask(t.id));

    frag.appendChild(li);
  }

  els.taskList.appendChild(frag);
}

function renderPriorityPill(priority) {
  const p = priority || 'normal';
  return `<span class="pill ${p}">Priority: ${escapeHtml(p)}</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function loadTasks() {
  if (state.useLocalStore) {
    state.tasks = readLocalTasks();
    render();
    return;
  }

  try {
    const data = await apiFetch('/api/tasks');
    state.tasks = data.tasks || [];
  } catch (e) {
    console.info('API unavailable, using local browser storage.', e);
    state.useLocalStore = true;
    state.tasks = readLocalTasks();
  }
  render();
}

async function addTask(payload) {
  const now = new Date().toISOString();
  const task = {
    id: uid(),
    title: payload.title,
    notes: payload.notes || '',
    dueDate: payload.dueDate || null,
    priority: payload.priority || 'normal',
    completed: false,
    createdAt: now,
    updatedAt: now
  };

  if (state.useLocalStore) return task;

  const data = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data.task;
}

async function updateTask(id, patch) {
  if (state.useLocalStore) {
    const task = state.tasks.find(t => t.id === id);
    return { ...task, ...patch, updatedAt: new Date().toISOString() };
  }

  const data = await apiFetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return data.task;
}

async function deleteTask(id) {
  const prev = state.tasks.slice();
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.useLocalStore) writeLocalTasks();
  render();

  try {
    if (!state.useLocalStore) await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  } catch (e) {
    state.tasks = prev;
    render();
    console.error(e);
    alert('Failed to delete task: ' + e.message);
  }
}

async function toggleComplete(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const prev = state.tasks.slice();
  const nextCompleted = !task.completed;

  state.tasks = state.tasks.map(t => t.id === id ? { ...t, completed: nextCompleted } : t);
  if (state.useLocalStore) writeLocalTasks();
  render();

  try {
    const updated = await updateTask(id, { completed: nextCompleted });
    state.tasks = state.tasks.map(t => t.id === id ? updated : t);
    if (state.useLocalStore) writeLocalTasks();
    render();
  } catch (e) {
    state.tasks = prev;
    render();
    console.error(e);
    alert('Failed to update task: ' + e.message);
  }
}

function openModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  state.modalTaskId = id;

  els.modal.classList.add('show');
  els.modal.setAttribute('aria-hidden', 'false');
  els.modalTitle.textContent = 'Edit task';

  els.editId.value = id;
  els.editTitle.value = t.title || '';
  els.editNotes.value = t.notes || '';
  els.editDueDate.value = t.dueDate ? String(t.dueDate) : '';
  els.editPriority.value = t.priority || 'normal';

  toast('Editing');
}

function closeModal() {
  els.modal.classList.remove('show');
  els.modal.setAttribute('aria-hidden', 'true');
  state.modalTaskId = null;
}

els.closeModal.addEventListener('click', closeModal);
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});

els.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = els.editId.value;
  const title = els.editTitle.value.trim();
  const notes = els.editNotes.value;
  const dueDate = els.editDueDate.value || null;
  const priority = els.editPriority.value;

  if (!title) return;

  const prev = state.tasks.slice();
  state.tasks = state.tasks.map(t => t.id === id ? { ...t, title, notes, dueDate, priority } : t);
  if (state.useLocalStore) writeLocalTasks();
  render();

  try {
    const updated = await updateTask(id, { title, notes, dueDate, priority });
    state.tasks = state.tasks.map(t => t.id === id ? updated : t);
    if (state.useLocalStore) writeLocalTasks();
    render();
    closeModal();
  } catch (err) {
    state.tasks = prev;
    render();
    alert('Failed to save changes: ' + err.message);
  }
});

els.deleteBtn.addEventListener('click', async () => {
  const id = els.editId.value;
  await deleteTask(id);
  closeModal();
});

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  const notes = els.notes.value;
  const dueDate = els.dueDate.value || null;
  const priority = els.priority.value;

  if (!title) return;

  const prev = state.tasks.slice();
  const tempTask = {
    id: 'tmp_' + uid(),
    title,
    notes,
    dueDate,
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.tasks.unshift(tempTask);
  if (state.useLocalStore) writeLocalTasks();
  render();

  els.addForm.reset();

  try {
    const created = await addTask({ title, notes, dueDate, priority });
    state.tasks = state.tasks.map(t => t.id === tempTask.id ? created : t);
    if (state.useLocalStore) writeLocalTasks();
    render();
  } catch (err) {
    state.tasks = prev;
    render();
    alert('Failed to add task: ' + err.message);
  }
});

els.filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    els.filterButtons.forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');

    state.filter = btn.dataset.filter;
    render();
  });
});

els.search.addEventListener('input', () => {
  state.query = els.search.value;
  render();
});

els.sortBy.addEventListener('change', () => {
  state.sortBy = els.sortBy.value;
  render();
});

els.clearCompleted.addEventListener('click', async () => {
  const prev = state.tasks.slice();
  const completed = state.tasks.filter(t => t.completed);
  if (completed.length === 0) return;

  state.tasks = state.tasks.filter(t => !t.completed);
  if (state.useLocalStore) writeLocalTasks();
  render();

  try {
    if (!state.useLocalStore) {
      await Promise.all(completed.map(t => apiFetch(`/api/tasks/${t.id}`, { method: 'DELETE' })));
    }
  } catch (e) {
    state.tasks = prev;
    render();
    alert('Failed to clear completed tasks: ' + e.message);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== els.search) {
    e.preventDefault();
    els.search.focus();
  }
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    e.preventDefault();
    els.title.focus();
  }
  if (e.key === 'Escape' && els.modal.classList.contains('show')) closeModal();
});

loadTasks();
