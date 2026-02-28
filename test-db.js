require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

connection.connect((err) => {
    if (err) {
    console.error('接続失敗...原因：' + err.stack);
    return;
    }
    console.log('おめでとうございます！データベース接続に成功しました！');
    connection.end();
});