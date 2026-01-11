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
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax'
    }
}));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false }
});

// --- データベース初期化（カラムの自動追加） ---
db.connect(err => {
    if (err) return console.error('DB接続失敗:', err);
    console.log('DB接続成功');

    // 並び順用のposition列を追加
    db.query("SHOW COLUMNS FROM tasks LIKE 'position'", (err, results) => {
        if (!err && results.length === 0) {
            db.query("ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0");
            console.log("position列を追加しました");
        }
    });

    // 固定カテゴリ保存用のcategory列（文字列）を追加
    db.query("SHOW COLUMNS FROM tasks LIKE 'category'", (err, results) => {
        if (!err && results.length === 0) {
            db.query("ALTER TABLE tasks ADD COLUMN category VARCHAR(50)");
            console.log("category列を追加しました");
        }
    });
});

// --- 認証 API ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], (err) => {
            if (err) return res.json({ success: false, message: 'その名前は使われています' });
            res.json({ success: true, message: '登録しました！' });
        });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
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

// --- タスク API (シンプル版) ---

// 並び順を考慮した取得
app.get('/api/tasks', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    const sql = 'SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC';
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// タスク追加（positionを最後尾に設定）
app.post('/api/tasks', (req, res) => {
    const { title, due_date, category } = req.body; 
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    
    // 現在の最大positionを取得して+1する
    db.query('SELECT MAX(position) as maxPos FROM tasks WHERE user_id = ?', [req.session.userId], (err, results) => {
        const nextPos = (results[0].maxPos || 0) + 1;
        const sql = 'INSERT INTO tasks (user_id, title, due_date, category, position) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [req.session.userId, title, due_date || null, category, nextPos], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true, taskId: result.insertId });
        });
    });
});

// 並び順の保存（ドラッグ＆ドロップ用）
app.patch('/api/tasks/reorder', (req, res) => {
    const { ids } = req.body; // フロントから届いたIDの配列
    if (!req.session.userId || !Array.isArray(ids)) return res.status(400).json({ success: false });

    // 各タスクのpositionを配列のインデックス順に更新
    let completed = 0;
    ids.forEach((id, index) => {
        db.query('UPDATE tasks SET position = ? WHERE task_id = ? AND user_id = ?', [index, id, req.session.userId], (err) => {
            completed++;
            if (completed === ids.length) {
                res.json({ success: true });
            }
        });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    const { title, due_date, category } = req.body;
    if (!req.session.userId) return res.status(401).json({ message: '未ログイン' });
    const sql = 'UPDATE tasks SET title = ?, due_date = ?, category = ? WHERE task_id = ? AND user_id = ?';
    db.query(sql, [title, due_date || null, category, req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.patch('/api/tasks/:id', (req, res) => {
    const { status } = req.body;
    const sql = 'UPDATE tasks SET status = ? WHERE task_id = ? AND user_id = ?';
    db.query(sql, [status, req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    const sql = 'DELETE FROM tasks WHERE task_id = ? AND user_id = ?';
    db.query(sql, [req.params.id, req.session.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));