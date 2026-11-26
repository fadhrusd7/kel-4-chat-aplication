import mysql from "mysql2/promise";

const dbHost = process.env.DB_HOST || "localhost";

// TiDB Cloud Public Endpoint requires TLS.
// Local MySQL can continue using a non-TLS connection.
const useTls = process.env.DB_SSL
  ? process.env.DB_SSL === "true"
  : dbHost !== "localhost" && dbHost !== "127.0.0.1";

const pool = mysql.createPool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "chat",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "chat",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",

  ...(useTls && {
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  }),
});

// Keep database timestamps on UTC.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export default pool;
