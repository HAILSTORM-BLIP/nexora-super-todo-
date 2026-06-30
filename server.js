import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'tasks.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ tasks: [] }, null, 2));
}

function readStore() {
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.tasks) ? parsed : { tasks: [] };
  } catch {
    return { tasks: [] };
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// CRUD
app.get('/api/tasks', (_req, res) => {
  const store = readStore();
  res.json({ tasks: store.tasks });
});

app.post('/api/tasks', (req, res) => {
  const { title, notes = '', dueDate = null, priority = 'normal' } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }

  const store = readStore();
  const now = new Date().toISOString();

  const task = {
    id: uid(),
    title: title.trim(),
    notes: typeof notes === 'string' ? notes : '',
    dueDate: dueDate ? String(dueDate) : null,
    priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
    completed: false,
    createdAt: now,
    updatedAt: now
  };

  store.tasks.unshift(task);
  writeStore(store);

  res.status(201).json({ task });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const store = readStore();
  const idx = store.tasks.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'task not found' });

  const t = store.tasks[idx];
  const { title, notes, dueDate, priority, completed } = req.body || {};

  if (typeof title === 'string') t.title = title.trim();
  if (typeof notes === 'string') t.notes = notes;
  if (dueDate === null) t.dueDate = null;
  if (dueDate !== undefined && dueDate !== null) t.dueDate = String(dueDate);
  if (['low', 'normal', 'high'].includes(priority)) t.priority = priority;
  if (typeof completed === 'boolean') t.completed = completed;

  t.updatedAt = new Date().toISOString();
  store.tasks[idx] = t;

  writeStore(store);
  res.json({ task: t });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const store = readStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter(t => t.id !== id);
  const after = store.tasks.length;
  writeStore(store);

  if (before === after) return res.status(404).json({ error: 'task not found' });
  res.json({ deleted: true });
});

// Serve static
app.use(express.static(path.join(__dirname, 'public')));


app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Nexora Super To-Do running on http://localhost:${port}`);
});

