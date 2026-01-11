const mysql = require('mysql2/promise');

// AivenのService URIをここに貼り付けてください
const uri = "mysql://avnadmin:AVNS_prPoaxAu6qtNZiKLDdo@mysql-13d15ef8-syuk...";

async function update() {
    try {
        const connection = await mysql.createConnection(uri);
        console.log("データベースに接続しました");

        // positionカラムを追加するSQL
        await connection.query("ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0");
        console.log("成功：positionカラムを追加しました！");

        await connection.end();
    } catch (err) {
        console.error("エラーが発生しました:", err.message);
    }
}

update();