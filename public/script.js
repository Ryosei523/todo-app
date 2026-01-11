// --- 1. グローバル変数と初期設定 ---
let currentFilter = 'all';

// ブラウザ通知の許可
if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const msg = document.getElementById('msg');
const displayName = document.getElementById('display-name');
const taskList = document.getElementById('task-list');

const newTaskInput = document.getElementById('new-task-title');
const newTaskDate = document.getElementById('new-task-date');
const newTaskPriority = document.getElementById('new-task-priority');
const newTaskCategory = document.getElementById('new-task-category');

const editModal = document.getElementById('edit-modal');
const editTaskId = document.getElementById('edit-task-id');
const editTaskTitle = document.getElementById('edit-task-title');
const editTaskDate = document.getElementById('edit-task-date');
const editTaskPriority = document.getElementById('edit-task-priority');
const editTaskCategory = document.getElementById('edit-task-category');

checkLogin();

// --- 2. 認証系ロジック ---
async function checkLogin() {
    const res = await fetch('/api/user');
    const data = await res.json();
    if (data.loggedIn) {
        showApp(data.username);
    } else {
        showAuth();
    }
}

function showApp(username) {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    displayName.textContent = username;
    fetchCategories(); 
    fetchTasks();
    checkReminders(); 
}

function showAuth() {
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
}

// 登録・ログイン・ログアウト
document.getElementById('reg-btn').addEventListener('click', async () => {
    const username = document.getElementById('reg-user').value;
    const password = document.getElementById('reg-pass').value;
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.style.color = data.success ? 'green' : 'red';
});

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
    else { msg.textContent = data.message; msg.style.color = 'red'; }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showAuth();
});

// --- 3. カテゴリ操作系 ---
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        if (!Array.isArray(categories)) return;

        const updateSelect = (selectEl) => {
            selectEl.innerHTML = '<option value="">カテゴリなし</option>';
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.category_id;
                opt.textContent = cat.category_name;
                selectEl.appendChild(opt);
            });
        };
        updateSelect(newTaskCategory);
        updateSelect(editTaskCategory);

        const categoryListContainer = document.getElementById('category-manage-list');
        if (categoryListContainer) {
            categoryListContainer.innerHTML = '';
            categories.forEach(cat => {
                const div = document.createElement('div');
                div.className = 'category-manage-item';
                div.innerHTML = `
                    <span>${cat.category_name}</span>
                    <button class="cat-delete-btn" onclick="deleteCategory(${cat.category_id})">削除</button>
                `;
                categoryListContainer.appendChild(div);
            });
        }
    } catch (error) {
        console.error('通信エラー:', error);
    }
}

window.deleteCategory = async (id) => {
    if (!confirm('このカテゴリを削除しますか？')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) { fetchCategories(); fetchTasks(); }
};

window.openCategoryModal = () => document.getElementById('category-modal').classList.remove('hidden');
window.closeCategoryModal = () => document.getElementById('category-modal').classList.add('hidden');

document.getElementById('save-category-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-category-name').value;
    if (!name) return;
    await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_name: name })
    });
    document.getElementById('new-category-name').value = '';
    closeCategoryModal();
    fetchCategories(); 
});

// --- 4. タスク操作系（2行構成のレンダリング） ---
async function fetchTasks() {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    renderTasks(tasks);
}

window.setFilter = (filter) => {
    currentFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter-${filter}`).classList.add('active');
    fetchTasks();
};

function renderTasks(tasks) {
    const total = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    document.getElementById('total-count').textContent = total;
    document.getElementById('completed-count').textContent = completedCount;
    
    // 進捗バーのアニメーション反映
    const percent = total > 0 ? (completedCount / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = percent + '%';

    let filteredTasks = tasks;
    if (currentFilter === 'pending') filteredTasks = tasks.filter(t => t.status === 'pending');
    if (currentFilter === 'completed') filteredTasks = tasks.filter(t => t.status === 'completed');

    taskList.innerHTML = '';
    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">表示するタスクがありません。</p>';
        return;
    }

    const now = new Date().setHours(0,0,0,0);

    filteredTasks.forEach(task => {
        const taskDate = task.due_date ? new Date(task.due_date).setHours(0,0,0,0) : null;
        const isOverdue = task.status === 'pending' && taskDate && taskDate < now;

        const li = document.createElement('li');
        li.className = `task-item ${task.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
        
        const dateStr = task.due_date ? new Date(task.due_date).toLocaleDateString() : '';
        const priorityLabel = getPriorityLabel(task.priority);
        const taskData = JSON.stringify(task).replace(/"/g, '&quot;');
        
        // ★ 二行構成のHTML構造 ★
        li.innerHTML = `
            <div class="task-top-row">
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} onchange="toggleTask(${task.task_id}, this.checked)">
                <span class="task-title">
                    ${task.title}
                    ${isOverdue ? '<span class="overdue-badge">期限切れ</span>' : ''}
                </span>
                <small class="task-meta">
                    ${priorityLabel}
                    ${dateStr ? ` ${dateStr}` : ''}
                    ${task.category_name ? ` <span class="cat-tag">${task.category_name}</span>` : ''}
                </small>
            </div>
            <div class="task-bottom-row">
                <button class="edit-btn" onclick="openEditModal(${taskData})">編集</button>
                <button class="delete-btn" onclick="deleteTask(${task.task_id})">×</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

function getPriorityLabel(p) {
    if (p === 'high') return '<span> 高</span>';
    if (p === 'medium') return '<span> 中</span>';
    return '<span> 低</span>';
}

// --- リマインダー・追加・更新・削除 ---
async function checkReminders() {
    if (Notification.permission !== "granted") return;
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    const todayStr = new Date().toLocaleDateString();
    const todayTasks = tasks.filter(t => t.status === 'pending' && t.due_date && new Date(t.due_date).toLocaleDateString() === todayStr);
    if (todayTasks.length > 0) {
        new Notification("タスクのリマインド", { body: `今日が期限のタスクが ${todayTasks.length} 件あります！` });
    }
}

document.getElementById('add-task-btn').addEventListener('click', async () => {
    const title = newTaskInput.value;
    const date = newTaskDate.value;
    const priority = newTaskPriority.value;
    const category_id = newTaskCategory.value;
    if (!title) return;
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date: date, priority, category_id })
    });
    newTaskInput.value = ''; newTaskDate.value = ''; fetchTasks();
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
    if (!confirm('削除してよろしいですか？')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
};

window.openEditModal = (task) => {
    editTaskId.value = task.task_id;
    editTaskTitle.value = task.title;
    editTaskDate.value = task.due_date ? task.due_date.split('T')[0] : '';
    editTaskPriority.value = task.priority;
    editTaskCategory.value = task.category_id || ''; 
    editModal.classList.remove('hidden');
};

window.closeModal = () => editModal.classList.add('hidden');

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const id = editTaskId.value;
    const title = editTaskTitle.value;
    const due_date = editTaskDate.value;
    const priority = editTaskPriority.value;
    const category_id = editTaskCategory.value;
    if (!title) return alert('タイトルは必須です');
    const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, due_date, priority, category_id })
    });
    if (res.ok) { closeModal(); fetchTasks(); }
});