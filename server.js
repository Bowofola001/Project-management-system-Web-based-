const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Planned',
      dueDate TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      title TEXT NOT NULL,
      assignee TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'To Do',
      dueDate TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await allQuery(
      `SELECT p.*, COUNT(t.id) AS taskCount,
       SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS completedTasks
       FROM projects p
       LEFT JOIN tasks t ON t.projectId = p.id
       GROUP BY p.id
       ORDER BY p.createdAt DESC`
    );
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch projects.' });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, description = '', status = 'Planned', dueDate = '' } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  try {
    const createdAt = new Date().toISOString();
    const result = await runQuery(
      'INSERT INTO projects (name, description, status, dueDate, createdAt) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), description.trim(), status, dueDate, createdAt]
    );

    const project = await getQuery('SELECT * FROM projects WHERE id = ?', [result.id]);
    return res.status(201).json(project);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create project.' });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description = '', status = 'Planned', dueDate = '' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  try {
    const existing = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    await runQuery(
      'UPDATE projects SET name = ?, description = ?, status = ?, dueDate = ? WHERE id = ?',
      [name.trim(), description.trim(), status, dueDate, id]
    );

    const updated = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update project.' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM tasks WHERE projectId = ?', [id]);
    const result = await runQuery('DELETE FROM projects WHERE id = ?', [id]);
    if (!result.changes) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete project.' });
  }
});

app.get('/api/projects/:projectId/tasks', async (req, res) => {
  const { projectId } = req.params;

  try {
    const tasks = await allQuery(
      'SELECT * FROM tasks WHERE projectId = ? ORDER BY createdAt DESC',
      [projectId]
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch tasks.' });
  }
});

app.post('/api/projects/:projectId/tasks', async (req, res) => {
  const { projectId } = req.params;
  const {
    title,
    assignee = '',
    priority = 'Medium',
    status = 'To Do',
    dueDate = ''
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required.' });
  }

  try {
    const project = await getQuery('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const createdAt = new Date().toISOString();
    const result = await runQuery(
      'INSERT INTO tasks (projectId, title, assignee, priority, status, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [projectId, title.trim(), assignee.trim(), priority, status, dueDate, createdAt]
    );

    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [result.id]);
    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create task.' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title,
    assignee = '',
    priority = 'Medium',
    status = 'To Do',
    dueDate = ''
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required.' });
  }

  try {
    const existing = await getQuery('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    await runQuery(
      'UPDATE tasks SET title = ?, assignee = ?, priority = ?, status = ?, dueDate = ? WHERE id = ?',
      [title.trim(), assignee.trim(), priority, status, dueDate, id]
    );

    const updated = await getQuery('SELECT * FROM tasks WHERE id = ?', [id]);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update task.' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runQuery('DELETE FROM tasks WHERE id = ?', [id]);
    if (!result.changes) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete task.' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
