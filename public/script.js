// --- 初期設定と画面切り替え ---
let currentFilter = 'all';
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const taskList = document.getElementById('task-list');

function showApp(username) {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    document.getElementById('display-name').textContent = username;
    fetchTasks();
}

function showAuth() {
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
}

// --- ドラッグ＆ドロップ設定 ---
new Sortable(taskList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
        const ids = Array.from(taskList.querySelectorAll('.task-item')).map(el => el.dataset.id);
        await fetch('/api/tasks/reorder', {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids })
        });
    }
});

// --- テーマ切り替え ---
document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

// --- 認証処理 ---
async function checkLogin() {
    const res = await fetch('/api/user');
    const data = await res.json();
    if (data.loggedIn) showApp(data.username);
    else showAuth();
}

document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) showApp(username);
    else alert(data.message);
});

document.getElementById('reg-btn').addEventListener('click', async () => {
    const username = document.getElementById('reg-user').value;
    const password = document.getElementById('reg-pass').value;
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    alert(data.message);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showAuth();
});

// --- タスク操作 ---
async function fetchTasks() {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    renderTasks(tasks);
}

function renderTasks(tasks) {
    // ゲージ等の更新ロジック（省略）

    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    tasks.forEach(task => {
        const dateStr = task.due_date ? new Date(task.due_date).toLocaleDateString() : '';

        // ★★★ 【重要】この1行を追加してください ★★★
        // 編集ボタンを押した時にタスクの情報を正しく渡すために必要です
        const taskData = JSON.stringify(task).replace(/"/g, '&quot;'); 
        
        const li = document.createElement('li');
        li.className = `task-item ${task.status === 'completed' ? 'completed' : ''}`;
        li.dataset.id = task.task_id;
        
        li.innerHTML = `
        <div class="task-top-row" style="display: flex; align-items: center; flex: 1; overflow: hidden;">
            <input type="checkbox" style="width:20px;height:20px;margin:0;" 
                ${task.status === 'completed' ? 'checked' : ''} 
            onchange="toggleTask(${task.task_id}, this.checked)">
            <span class="task-title">${task.title}</span>
            <span class="task-meta">${task.category || ''} ${dateStr}</span>
        </div>
        <div class="task-bottom-row">
            <button class="edit-btn" onclick="openEditModal(${taskData})">編集</button>
            <button class="delete-btn" onclick="deleteTask(${task.task_id})">×</button>
        </div>
        `;
        taskList.appendChild(li);
    });
}
document.getElementById('add-task-btn').addEventListener('click', async () => {
    const title = document.getElementById('new-task-title').value;
    const date = document.getElementById('new-task-date').value;
    const category = document.getElementById('new-task-category').value;
    if (!title) return;
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date: date, category })
    });
    document.getElementById('new-task-title').value = '';
    fetchTasks();
});

window.toggleTask = async (id, isChecked) => {
    const status = isChecked ? 'completed' : 'pending';
    await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    fetchTasks();
};

window.deleteTask = async (id) => {
    if (!confirm('削除しますか？')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
};

window.openEditModal = (task) => {
    document.getElementById('edit-task-id').value = task.task_id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-date').value = task.due_date ? task.due_date.split('T')[0] : '';
    document.getElementById('edit-task-category').value = task.category;
    document.getElementById('edit-modal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('edit-modal').classList.add('hidden');

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const id = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value;
    const due_date = document.getElementById('edit-task-date').value;
    const category = document.getElementById('edit-task-category').value;
    await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date, category })
    });
    closeModal();
    fetchTasks();
});

checkLogin();