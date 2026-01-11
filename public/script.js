const taskList = document.getElementById('task-list');

// ドラッグ＆ドロップ
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

// テーマ切り替え
document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

// タスク表示
function renderTasks(tasks) {
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.id = task.task_id;
        li.innerHTML = `
            <div>
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} onchange="toggleTask(${task.task_id}, this.checked)">
                <span>${task.title}</span> <small>(${task.category})</small>
            </div>
            <button onclick="deleteTask(${task.task_id})" style="width:auto;height:auto;padding:5px 10px;">×</button>
        `;
        taskList.appendChild(li);
    });
}
// ※ 他の fetchTasks や toggleTask 関数は既存のままでOKです。