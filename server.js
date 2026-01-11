const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();

const port = process.env.PORT || 3000;

app.set('trust proxy', 1); 

app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_todo_app',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000,
        secure: true, 
        sameSite: 'lax'
    }
}));

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_db',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// --- 認証 API ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        connection.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], (err) => {
            if (err) return res.json({ success: false, message: 'その名前は使われています' });
            res.json({ success: true, message: '登録しました！' });
        });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    connection.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'ユーザーが見つかりません' });
        const match = await bcrypt.compare(password, results[0].password_hash);
        if (match) {
            req.session.userId = results[0].user_id;
            req.session.username = results[0].username;
            res.json({ success: true });
        } else { res.json({ success: false, message: 'パスワード不一致' }); }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/user', (req, res) => {
    res.json(req.session.userId ? { loggedIn: true, username: req.session.username } : { loggedIn: false });
});

// --- カテゴリ API ---
app.get('/api/categories', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    connection.query('SELECT * FROM categories WHERE user_id = ?', [req.session.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/categories', (req, res) => {
    const { category_name } = req.body;
    if (!req.session.userId || !category_name) return res.status(400).json({ message: '不正なリクエスト' });
    connection.query('INSERT INTO categories (user_id, category_name) VALUES (?, ?)', [req.session.userId, category_name], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, categoryId: result.insertId });
    });
});

// --- カテゴリ削除 API (詳細ログを追加) ---
app.delete('/api/categories/:id', (req, res) => {
    const categoryId = req.params.id;
    const userId = req.session.userId;

    if (!userId) {
        console.error('Delete Category Error: Unauthorized');
        return res.status(401).json({ message: '未ログイン' });
    }

    // 1. タスクの更新
    const updateTasksSql = 'UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?';
    connection.query(updateTasksSql, [categoryId, userId], (err) => {
        if (err) {
            console.error('DB Error (Update Tasks):', err); // Renderのログに表示されます
            return res.status(500).json({ message: 'タスクの更新に失敗しました', error: err });
        }

        // 2. カテゴリの削除
        const deleteCategorySql = 'DELETE FROM categories WHERE category_id = ? AND user_id = ?';
        connection.query(deleteCategorySql, [categoryId, userId], (err) => {
            if (err) {
                console.error('DB Error (Delete Category):', err); // Renderのログに表示されます
                return res.status(500).json({ message: 'カテゴリの削除に失敗しました', error: err });
            }
            res.json({ success: true });
        });
    });
});

// --- タスク API ---
app.get('/api/tasks', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    const sql = `SELECT t.*, c.category_name FROM tasks t LEFT JOIN categories c ON t.category_id = c.category_id WHERE t.user_id = ? ORDER BY (status = 'completed'), due_date IS NULL, due_date ASC, CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at DESC`;
    connection.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/tasks', (req, res) => {
    const { title, due_date, priority, category_id } = req.body; 
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    const dateValue = due_date || null;
    const catIdValue = category_id || null;
    const sql = 'INSERT INTO tasks (user_id, title, due_date, priority, category_id) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [req.session.userId, title, dateValue, priority, catIdValue], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, taskId: result.insertId });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    const { title, due_date, priority, category_id } = req.body;
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    const sql = `UPDATE tasks SET title = ?, due_date = ?, priority = ?, category_id = ? WHERE task_id = ? AND user_id = ?`;
    const dateValue = due_date || null;
    const catIdValue = category_id || null;
    connection.query(sql, [title, dateValue, priority, catIdValue, req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.patch('/api/tasks/:id', (req, res) => {
    const { status } = req.body;
    const sql = 'UPDATE tasks SET status = ? WHERE task_id = ? AND user_id = ?';
    connection.query(sql, [status, req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    const sql = 'DELETE FROM tasks WHERE task_id = ? AND user_id = ?';
    connection.query(sql, [req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));