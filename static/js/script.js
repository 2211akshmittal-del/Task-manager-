// ============= STATE =============
let allTasks = [];
let currentView = 'dashboard';
let currentCategory = null;
let currentFilter = 'all';
let currentSort = 'created';
let searchTerm = '';
let editingId = null;
let tempSubtasks = [];

// ============= DOM =============
const $ = (id) => document.getElementById(id);
const sidebar = $('sidebar');
const sidebarOverlay = $('sidebarOverlay');
const mobileMenuBtn = $('mobileMenuBtn');
const taskModal = $('taskModal');
const taskForm = $('taskForm');
const tasksContainer = $('tasksContainer');
const emptyState = $('emptyState');
const confirmModal = $('confirmModal');
const toastContainer = $('toastContainer');

// ============= INIT =============
document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
    fetchStats();
    setupEventListeners();
    setDefaultDate();
});

// ============= SETUP =============
function setupEventListeners() {
    // Mobile menu
    mobileMenuBtn.onclick = () => {
        sidebar.classList.toggle('show');
        sidebarOverlay.classList.toggle('show');
    };
    sidebarOverlay.onclick = () => {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.remove('show');
    };

    // Nav items
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentView = item.dataset.view;
            currentCategory = null;
            switchView();
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
        });
    });

    // Category nav
    document.querySelectorAll('.nav-item[data-category]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentView = 'category';
            currentCategory = item.dataset.category;
            switchView();
        });
    });

    // New task
    $('newTaskBtn').onclick = () => openTaskModal();
    $('emptyStateBtn')?.addEventListener('click', () => openTaskModal());

    // Quick actions
    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.onclick = () => {
            openTaskModal();
            $('category').value = btn.dataset.category;
        };
    });

    // Modal close
    $('modalClose').onclick = closeTaskModal;
    $('cancelBtn').onclick = closeTaskModal;
    taskModal.onclick = (e) => { if (e.target === taskModal) closeTaskModal(); };

    // Form
    taskForm.onsubmit = handleFormSubmit;
    $('addSubtaskBtn').onclick = addSubtask;

    // Search
    $('globalSearch').oninput = (e) => {
        searchTerm = e.target.value;
        renderTasks();
    };

    // Filters
    document.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.priority;
            renderTasks();
        };
    });

    // Sort
    $('sortSelect').onchange = (e) => {
        currentSort = e.target.value;
        renderTasks();
    };

    // View switcher
    $('listBtn').onclick = () => switchListView('list');
    $('gridBtn').onclick = () => switchListView('grid');
    $('kanbanBtn').onclick = () => switchListView('kanban');

    // Theme toggle
    $('themeToggle').onclick = () => {
        document.body.classList.toggle('light-theme');
        const icon = $('themeToggle').querySelector('i');
        icon.className = document.body.classList.contains('light-theme')
            ? 'fas fa-sun' : 'fas fa-moon';
        showToast('Theme switched!', 'success');
    };

    // Confirm modal
    $('confirmCancel').onclick = () => confirmModal.classList.remove('show');
    confirmModal.onclick = (e) => { if (e.target === confirmModal) confirmModal.classList.remove('show'); };
}

function setDefaultDate() {
    $('due_date').value = new Date().toISOString().split('T')[0];
}

// ============= VIEWS =============
function switchView() {
    const titles = {
        dashboard: ['Dashboard', "Welcome back! Here's your productivity overview"],
        inbox: ['Inbox', 'All your active tasks'],
        today: ['Today', "Tasks scheduled for today"],
        upcoming: ['Upcoming', 'Tasks due in the next 7 days'],
        overdue: ['Overdue', 'Tasks past their due date'],
        todo: ['To Do', 'Tasks yet to be started'],
        in_progress: ['In Progress', 'Tasks currently being worked on'],
        review: ['In Review', 'Tasks awaiting review'],
        done: ['Completed', 'Finished tasks'],
        pinned: ['Pinned', 'Your important tasks'],
        archived: ['Archived', 'Archived tasks'],
        category: [currentCategory, `Tasks in ${currentCategory}`]
    };

    const [title, subtitle] = titles[currentView] || ['Tasks', ''];
    $('viewTitle').textContent = title;
    $('viewSubtitle').textContent = subtitle;

    // Show appropriate view
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    if (currentView === 'dashboard') {
        $('dashboardView').classList.remove('hidden');
    } else {
        $('tasksView').classList.remove('hidden');
        renderTasks();
    }
}

function switchListView(type) {
    document.querySelectorAll('.topbar-btn').forEach(b => b.classList.remove('active'));

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    if (type === 'kanban') {
        $('kanbanBtn').classList.add('active');
        $('kanbanView').classList.remove('hidden');
        renderKanban();
    } else {
        $('listBtn').classList.add('active');
        $('tasksView').classList.remove('hidden');
        tasksContainer.className = type === 'grid' ? 'tasks-container grid-view' : 'tasks-container';
        renderTasks();
    }
}

// ============= FETCH =============
async function fetchTasks() {
    try {
        const res = await fetch('/api/tasks');
        allTasks = await res.json();
        updateNavCounts();
        renderCurrentView();
    } catch (err) { console.error(err); }
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        $('statTotal').textContent = stats.total;
        $('statCompleted').textContent = stats.completed;
        $('statPending').textContent = stats.pending;
        $('statOverdue').textContent = stats.overdue;
        renderChart(stats.categories);
        renderTodayFocus();
    } catch (err) { console.error(err); }
}

function renderCurrentView() {
    if (currentView === 'dashboard') {
        fetchStats();
    } else if (currentView === 'kanban' || !$('kanbanView').classList.contains('hidden')) {
        renderKanban();
    } else {
        renderTasks();
    }
}

// ============= NAV COUNTS =============
function updateNavCounts() {
    const today = new Date().toISOString().split('T')[0];
    const counts = {
        inbox: allTasks.filter(t => !t.archived).length,
        today: allTasks.filter(t => !t.archived && t.due_date === today).length,
        upcoming: allTasks.filter(t => !t.archived && !t.completed && t.due_date > today).length,
        overdue: allTasks.filter(t => !t.archived && !t.completed && t.due_date && t.due_date < today).length,
        todo: allTasks.filter(t => !t.archived && t.status === 'todo').length,
        progress: allTasks.filter(t => !t.archived && t.status === 'in_progress').length,
        review: allTasks.filter(t => !t.archived && t.status === 'review').length,
        done: allTasks.filter(t => t.completed).length
    };

    $('inboxCount').textContent = counts.inbox;
    $('todayCount').textContent = counts.today;
    $('upcomingCount').textContent = counts.upcoming;
    $('overdueCount').textContent = counts.overdue;
    $('todoCount').textContent = counts.todo;
    $('progressCount').textContent = counts.progress;
    $('reviewCount').textContent = counts.review;
    $('doneCount').textContent = counts.done;
}

// ============= RENDER TASKS =============
function renderTasks() {
    let filtered = allTasks.filter(t => !t.archived);

    // View filter
    const today = new Date().toISOString().split('T')[0];
    switch (currentView) {
        case 'today': filtered = filtered.filter(t => t.due_date === today); break;
        case 'upcoming': filtered = filtered.filter(t => t.due_date > today); break;
        case 'overdue': filtered = filtered.filter(t => !t.completed && t.due_date && t.due_date < today); break;
        case 'todo': filtered = filtered.filter(t => t.status === 'todo' && !t.completed); break;
        case 'in_progress': filtered = filtered.filter(t => t.status === 'in_progress'); break;
        case 'review': filtered = filtered.filter(t => t.status === 'review'); break;
        case 'done': filtered = filtered.filter(t => t.completed); break;
        case 'pinned': filtered = filtered.filter(t => t.pinned); break;
        case 'archived': filtered = allTasks.filter(t => t.archived); break;
        case 'category': filtered = filtered.filter(t => t.category === currentCategory); break;
    }

    // Priority filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(t => t.priority === currentFilter);
    }

    // Search
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(s) ||
            (t.description || '').toLowerCase().includes(s) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(s))
        );
    }

    // Sort
    filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        if (currentSort === 'priority') {
            const pMap = {High: 3, Medium: 2, Low: 1};
            return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        }
        if (currentSort === 'title') return a.title.localeCompare(b.title);
        if (currentSort === 'due') return (a.due_date || 'zz').localeCompare(b.due_date || 'zz');
        return new Date(b.created_at) - new Date(a.created_at);
    });

    if (filtered.length === 0) {
        tasksContainer.innerHTML = '';
        emptyState.classList.add('show');
        return;
    }
    emptyState.classList.remove('show');

    tasksContainer.innerHTML = filtered.map(task => {
        const isOverdue = task.due_date && task.due_date < today && !task.completed;
        return `
        <div class="task-card priority-${task.priority} color-${task.color || 'blue'} ${task.completed ? 'completed' : ''}">
            <input type="checkbox" class="task-checkbox"
                   ${task.completed ? 'checked' : ''}
                   onchange="toggleTask(${task.id})">
            <div class="task-body">
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${task.pinned ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                </div>
                <div class="task-badges">
                    <span class="badge badge-priority-${task.priority}">
                        ${task.priority === 'High' ? '🔴' : task.priority === 'Medium' ? '🟡' : '🟢'} ${task.priority}
                    </span>
                    <span class="badge badge-category">${task.category}</span>
                    <span class="badge badge-status-${task.status}">${formatStatus(task.status)}</span>
                </div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    ${task.due_date ? `
                        <span class="task-meta-item ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-calendar"></i> ${formatDate(task.due_date)} ${isOverdue ? '(Overdue)' : ''}
                        </span>
                    ` : ''}
                    ${task.reminder ? `<span class="task-meta-item"><i class="fas fa-bell"></i> ${task.reminder}</span>` : ''}
                    ${task.estimated_time ? `<span class="task-meta-item"><i class="fas fa-hourglass-half"></i> ${task.estimated_time}min</span>` : ''}
                </div>
                ${task.subtasks && task.subtasks.length > 0 ? `
                    <div class="task-progress">
                        <div class="progress-bar" style="width: ${task.progress}%"></div>
                    </div>
                    <div class="task-meta" style="margin-top:5px;">
                        <span class="task-meta-item"><i class="fas fa-list-check"></i> ${task.subtasks.filter(s=>s.completed).length}/${task.subtasks.length} subtasks</span>
                    </div>
                ` : ''}
                ${task.tags && task.tags.length > 0 ? `
                    <div class="task-tags">
                        ${task.tags.map(tag => `<span class="task-tag">#${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="task-actions">
                <button class="icon-btn warning" onclick="togglePin(${task.id})" title="Pin">
                    <i class="fas fa-thumbtack"></i>
                </button>
                <button class="icon-btn" onclick="openEditModal(${task.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn" onclick="archiveTask(${task.id})" title="Archive">
                    <i class="fas fa-archive"></i>
                </button>
                <button class="icon-btn danger" onclick="confirmDelete(${task.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function renderKanban() {
    const statuses = ['todo', 'in_progress', 'review', 'done'];
    statuses.forEach(status => {
        const tasks = allTasks.filter(t => !t.archived && t.status === status);
        const el = $(`kanban${status === 'todo' ? 'Todo' : status === 'in_progress' ? 'Progress' : status === 'review' ? 'Review' : 'Done'}`);
        $(`kanban${status === 'todo' ? 'TodoCount' : status === 'in_progress' ? 'ProgressCount' : status === 'review' ? 'ReviewCount' : 'DoneCount'}`).textContent = tasks.length;

        el.innerHTML = tasks.map(task => `
            <div class="kanban-card color-${task.color || 'blue'}" ondblclick="openEditModal(${task.id})">
                <div class="task-title" style="font-size:0.9rem; margin-bottom:6px;">${escapeHtml(task.title)}</div>
                <div class="task-badges">
                    <span class="badge badge-priority-${task.priority}">${task.priority}</span>
                </div>
                ${task.due_date ? `<div class="task-meta-item" style="margin-top:6px;"><i class="fas fa-calendar"></i> ${task.due_date}</div>` : ''}
            </div>
        `).join('');
    });
}

function renderTodayFocus() {
    const today = new Date().toISOString().split('T')[0];
    const tasks = allTasks.filter(t => !t.archived && t.due_date === today && !t.completed).slice(0, 5);
    $('todayFocus').innerHTML = tasks.length ? tasks.map(t => `
        <div class="focus-item" onclick="openEditModal(${t.id})">
            <input type="checkbox" onchange="toggleTask(${t.id})" onclick="event.stopPropagation()">
            <span class="focus-item-title">${escapeHtml(t.title)}</span>
            <span class="badge badge-priority-${t.priority}">${t.priority}</span>
        </div>
    `).join('') : '<p style="color:var(--text-muted); text-align:center; padding:20px;">No tasks for today! 🎉</p>';
}

function renderChart(categories) {
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    const colors = ['#00d4ff', '#0080ff', '#1e3a8a', '#a855f7', '#00ff88', '#ffb800'];
    const ctx = $('categoryChart');

    if (total === 0) {
        ctx.getContext('2d').clearRect(0, 0, 200, 200);
        $('chartLegend').innerHTML = '<p style="color:var(--text-muted); text-align:center;">No data yet</p>';
        return;
    }

    let currentAngle = -Math.PI / 2;
    const c2 = ctx.getContext('2d');
    c2.clearRect(0, 0, 200, 200);

    const entries = Object.entries(categories);
    entries.forEach(([cat, count], i) => {
        const sliceAngle = (count / total) * 2 * Math.PI;
        c2.beginPath();
        c2.arc(100, 100, 80, currentAngle, currentAngle + sliceAngle);
        c2.lineTo(100, 100);
        c2.fillStyle = colors[i % colors.length];
        c2.fill();
        currentAngle += sliceAngle;
    });

    // Inner circle
    c2.beginPath();
    c2.arc(100, 100, 50, 0, 2 * Math.PI);
    c2.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-secondary');
    c2.fill();

    // Center text
    c2.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary');
    c2.font = 'bold 20px Inter';
    c2.textAlign = 'center';
    c2.fillText(total, 100, 105);

    $('chartLegend').innerHTML = entries.map(([cat, count], i) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
            <span>${cat}</span>
            <span class="legend-value">${count}</span>
        </div>
    `).join('');
}

// ============= TASK OPERATIONS =============
function openTaskModal(task = null) {
    editingId = task ? task.id : null;
    tempSubtasks = task ? [...(task.subtasks || [])] : [];
    $('modalTitle').innerHTML = task
        ? '<i class="fas fa-edit"></i> Edit Task'
        : '<i class="fas fa-plus-circle"></i> Create New Task';

    if (task) {
        $('taskId').value = task.id;
        $('title').value = task.title;
        $('description').value = task.description || '';
        $('category').value = task.category;
        $('priority').value = task.priority;
        $('status').value = task.status;
        $('due_date').value = task.due_date || '';
        $('reminder').value = task.reminder || '';
        $('tags').value = (task.tags || []).join(', ');
        $('notes').value = task.notes || '';
        $('estimated_time').value = task.estimated_time || '';
        $('pinned').checked = task.pinned || false;
        document.querySelector(`input[name="color"][value="${task.color || 'blue'}"]`).checked = true;
    } else {
        taskForm.reset();
        setDefaultDate();
        $('priority').value = 'Medium';
    }

    renderSubtasks();
    taskModal.classList.add('show');
}

function openEditModal(id) {
    const task = allTasks.find(t => t.id === id);
    if (task) openTaskModal(task);
}

function closeTaskModal() {
    taskModal.classList.remove('show');
    editingId = null;
    tempSubtasks = [];
}

function addSubtask() {
    const input = $('newSubtask');
    const val = input.value.trim();
    if (!val) return;
    tempSubtasks.push({ id: Date.now().toString(), title: val, completed: false });
    input.value = '';
    renderSubtasks();
}

function removeSubtask(id) {
    tempSubtasks = tempSubtasks.filter(s => s.id !== id);
    renderSubtasks();
}

function renderSubtasks() {
    $('subtasksList').innerHTML = tempSubtasks.map(s => `
        <div class="subtask-item ${s.completed ? 'completed' : ''}">
            <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="tempSubtasks.find(x=>x.id==='${s.id}').completed=this.checked; renderSubtasks();">
            <span>${escapeHtml(s.title)}</span>
            <button type="button" onclick="removeSubtask('${s.id}')"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const data = {
        title: $('title').value.trim(),
        description: $('description').value.trim(),
        category: $('category').value,
        priority: $('priority').value,
        status: $('status').value,
        due_date: $('due_date').value,
        reminder: $('reminder').value,
        tags: $('tags').value.split(',').map(t => t.trim()).filter(t => t),
        notes: $('notes').value,
        color: document.querySelector('input[name="color"]:checked').value,
        pinned: $('pinned').checked,
        estimated_time: parseInt($('estimated_time').value) || 0,
        subtasks: tempSubtasks
    };

    try {
        const url = editingId ? `/api/tasks/${editingId}` : '/api/tasks';
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast(editingId ? '✅ Task updated!' : '✨ Task created!', 'success');
            closeTaskModal();
            fetchTasks();
            fetchStats();
        }
    } catch (err) {
        showToast('❌ Error saving task', 'error');
    }
}

async function toggleTask(id) {
    await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
    fetchTasks();
    fetchStats();
    showToast('✅ Task updated!', 'success');
}

async function togglePin(id) {
    await fetch(`/api/tasks/${id}/pin`, { method: 'PATCH' });
    fetchTasks();
    showToast('📌 Task pinned!', 'success');
}

async function archiveTask(id) {
    await fetch(`/api/tasks/${id}/archive`, { method: 'PATCH' });
    fetchTasks();
    fetchStats();
    showToast('📦 Task archived!', 'success');
}

function confirmDelete(id) {
    $('confirmTitle').textContent = 'Delete this task?';
    $('confirmMessage').textContent = 'This action cannot be undone.';

    const okBtn = $('confirmOk');
    const newBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newBtn, okBtn);

    newBtn.onclick = async () => {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        confirmModal.classList.remove('show');
        fetchTasks();
        fetchStats();
        showToast('🗑️ Task deleted', 'success');
    };

    confirmModal.classList.add('show');
}

// ============= UTILITIES =============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStatus(status) {
    return {
        todo: '📋 To Do',
        in_progress: '⚡ In Progress',
        review: '👁️ In Review',
        done: '✅ Done'
    }[status] || status;
}

function showToast(message, type = 'info') {
    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-circle', info: 'info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
