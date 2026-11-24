import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "chat",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "chat",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
});

// Keep TIMESTAMP values and JavaScript Date parsing on the same UTC basis.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export default pool;
