import mysql from "mysql2/promise";

// ສ້າງ connection pool ໄປຫາ MySQL (ໃຊ້ຄ່າຈາກ .env)
// ດັ່ງທີ່ຕັ້ງໄວ້ໃນ MySQL Workbench: host, port, user, password, database
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dormitory_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: "utf8mb4",
});

// ທົດສອບການເຊື່ອມຕໍ່ຕອນ server start
export const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ ເຊື່ອມຕໍ່ MySQL ສຳເລັດ");
    conn.release();
  } catch (error) {
    console.error("❌ ເຊື່ອມຕໍ່ MySQL ບໍ່ສຳເລັດ:", error);
  }
};

export default pool;
