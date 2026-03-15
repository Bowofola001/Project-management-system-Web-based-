const projectForm = document.getElementById('project-form');
const projectList = document.getElementById('project-list');
const projectReset = document.getElementById('project-reset');

const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const taskReset = document.getElementById('task-reset');
const selectedProjectLabel = document.getElementById('selected-project-label');

let projects = [];
let selectedProjectId = null;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'No due date');

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Something went wrong.');
  }

  if (response.status === 204) return null;
  return response.json();
}

function resetProjectForm() {
  projectForm.reset();
  document.getElementById('project-id').value = '';
}

function resetTaskForm() {
  taskForm.reset();
  document.getElementById('task-id').value = '';
}

function fillProjectForm(project) {
  document.getElementById('project-id').value = project.id;
  document.getElementById('project-name').value = project.name;
  document.getElementById('project-description').value = project.description || '';
  document.getElementById('project-status').value = project.status;
  document.getElementById('project-dueDate').value = project.dueDate || '';
}

function fillTaskForm(task) {
  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-assignee').value = task.assignee || '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-status').value = task.status;
  document.getElementById('task-dueDate').value = task.dueDate || '';
}

function renderProjects() {
  projectList.innerHTML = '';

  if (!projects.length) {
    projectList.innerHTML = '<p class="meta">No projects yet. Create your first project.</p>';
    selectedProjectId = null;
    taskForm.hidden = true;
    selectedProjectLabel.textContent = 'Select a project to view tasks.';
    taskList.innerHTML = '';
    return;
  }

  projects.forEach((project) => {
    const card = document.createElement('article');
    card.className = `card ${project.id === selectedProjectId ? 'active' : ''}`;
    card.innerHTML = `
      <h3>${project.name}</h3>
      <p class="meta">${project.status} • Due: ${formatDate(project.dueDate)}</p>
      <p>${project.description || 'No description'}</p>
      <p class="meta">Tasks: ${project.completedTasks || 0}/${project.taskCount || 0} done</p>
      <div class="card-actions">
        <button data-action="select">Open Tasks</button>
        <button data-action="edit" class="ghost">Edit</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="select"]').addEventListener('click', () => {
      selectedProjectId = project.id;
      selectedProjectLabel.textContent = `Project: ${project.name}`;
      taskForm.hidden = false;
      resetTaskForm();
      renderProjects();
      loadTasks();
    });

    card.querySelector('[data-action="edit"]').addEventListener('click', () => fillProjectForm(project));

    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const confirmed = confirm(`Delete project "${project.name}" and all tasks?`);
      if (!confirmed) return;

      try {
        await request(`/api/projects/${project.id}`, { method: 'DELETE' });
        if (selectedProjectId === project.id) {
          selectedProjectId = null;
          selectedProjectLabel.textContent = 'Select a project to view tasks.';
          taskForm.hidden = true;
          taskList.innerHTML = '';
        }
        await loadProjects();
      } catch (error) {
        alert(error.message);
      }
    });

    projectList.appendChild(card);
  });
}

async function loadProjects() {
  try {
    projects = await request('/api/projects');
    renderProjects();
  } catch (error) {
    projectList.innerHTML = `<p class="meta">${error.message}</p>`;
  }
}

async function loadTasks() {
  if (!selectedProjectId) {
    taskList.innerHTML = '';
    return;
  }

  try {
    const tasks = await request(`/api/projects/${selectedProjectId}/tasks`);
    taskList.innerHTML = '';

    if (!tasks.length) {
      taskList.innerHTML = '<p class="meta">No tasks for this project yet.</p>';
      return;
    }

    tasks.forEach((task) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h3>${task.title}</h3>
        <p class="meta">${task.status} • Priority: ${task.priority} • Due: ${formatDate(task.dueDate)}</p>
        <p>${task.assignee ? `Assignee: ${task.assignee}` : 'Unassigned'}</p>
        <div class="card-actions">
          <button data-action="edit" class="ghost">Edit</button>
          <button data-action="delete" class="danger">Delete</button>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => fillTaskForm(task));
      card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const confirmed = confirm(`Delete task "${task.title}"?`);
        if (!confirmed) return;

        try {
          await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
          await loadTasks();
          await loadProjects();
        } catch (error) {
          alert(error.message);
        }
      });

      taskList.appendChild(card);
    });
  } catch (error) {
    taskList.innerHTML = `<p class="meta">${error.message}</p>`;
  }
}

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('project-name').value,
    description: document.getElementById('project-description').value,
    status: document.getElementById('project-status').value,
    dueDate: document.getElementById('project-dueDate').value
  };

  const projectId = document.getElementById('project-id').value;

  try {
    if (projectId) {
      await request(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await request('/api/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    resetProjectForm();
    await loadProjects();
    if (selectedProjectId) await loadTasks();
  } catch (error) {
    alert(error.message);
  }
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedProjectId) {
    alert('Please select a project first.');
    return;
  }

  const payload = {
    title: document.getElementById('task-title').value,
    assignee: document.getElementById('task-assignee').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    dueDate: document.getElementById('task-dueDate').value
  };

  const taskId = document.getElementById('task-id').value;

  try {
    if (taskId) {
      await request(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await request(`/api/projects/${selectedProjectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    resetTaskForm();
    await loadTasks();
    await loadProjects();
  } catch (error) {
    alert(error.message);
  }
});

projectReset.addEventListener('click', resetProjectForm);
taskReset.addEventListener('click', resetTaskForm);

loadProjects();
