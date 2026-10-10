import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

/**
 * ກ່ອນແລ່ນ test: ລ້າງ ແລະ ສ້າງຖານຂໍ້ມູນ test ໃໝ່ຈາກ database/schema.sql
 * (ໃຊ້ຊື່ຖານຂໍ້ມູນ dormitory_test ເທົ່ານັ້ນ — ບໍ່ແຕະຖານຂໍ້ມູນຫຼັກ)
 */
export default async function setup() {
  const dbName = process.env.TEST_DB_NAME || "dormitory_test";
  if (!/^[A-Za-z0-9_]+$/.test(dbName) || !dbName.includes("test")) {
    throw new Error(`TEST_DB_NAME ("${dbName}") ຕ້ອງມີຄຳວ່າ "test" ເພື່ອກັນລຶບຖານຂໍ້ມູນຈິງ`);
  }

  const conn = await mysql.createConnection({
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || "localhost",
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT) || 3306,
    user: process.env.TEST_DB_USER || process.env.DB_USER || "root",
    password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    multipleStatements: true,
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    const schema = fs
      .readFileSync(path.join(process.cwd(), "database", "schema.sql"), "utf8")
      .replace(/dormitory_db/g, dbName);
    await conn.query(schema);
  } finally {
    await conn.end();
  }
}
