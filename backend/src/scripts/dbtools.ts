import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql, { Connection } from "mysql2/promise";

/* =========================================================
   ເຄື່ອງມືຖານຂໍ້ມູນ ທີ່ໃຊ້ຮ່ວມກັນໃນ db:init / migrate / create-admin
   ໃຊ້ໄດ້ທັງ MySQL 8 ແລະ MariaDB (ບໍ່ໃຊ້ syntax ສະເພາະຂອງຝ່າຍໃດຝ່າຍໜຶ່ງ)
   ========================================================= */

export const DB_NAME = (process.env.DB_NAME || "dormitory_db").trim();

if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  console.error(`❌ DB_NAME "${DB_NAME}" ບໍ່ຖືກຕ້ອງ (ໃຊ້ໄດ້ສະເພາະ a-z A-Z 0-9 _)`);
  process.exit(1);
}

const baseConfig = () => ({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  charset: "utf8mb4",
  multipleStatements: true,
});

export const explainConnectError = (error: any): string => {
  switch (error?.code) {
    case "ECONNREFUSED":
      return "ເຊື່ອມຕໍ່ MySQL ບໍ່ໄດ້ — ກວດວ່າ MySQL ເປີດຢູ່ ແລະ DB_HOST/DB_PORT ໃນ .env ຖືກຕ້ອງ";
    case "ER_ACCESS_DENIED_ERROR":
      return "DB_USER ຫຼື DB_PASSWORD ໃນ .env ບໍ່ຖືກຕ້ອງ";
    case "ER_BAD_DB_ERROR":
      return `ບໍ່ພົບຖານຂໍ້ມູນ "${DB_NAME}" — ແລ່ນ: npm run db:init`;
    default:
      return error?.message || String(error);
  }
};

/** ເຊື່ອມຕໍ່ໂດຍບໍ່ເລືອກຖານຂໍ້ມູນ (ໃຊ້ຕອນສ້າງຖານຂໍ້ມູນ) */
export const connectServer = async (): Promise<Connection> => mysql.createConnection(baseConfig());

/** ເຊື່ອມຕໍ່ເຂົ້າຖານຂໍ້ມູນ DB_NAME */
export const connectDb = async (): Promise<Connection> =>
  mysql.createConnection({ ...baseConfig(), database: DB_NAME });

/** ອ່ານ SQL ຈາກ database/ ແລ້ວປ່ຽນຊື່ dormitory_db → DB_NAME */
export const readSqlFile = (file: string): string => {
  const full = path.join(process.cwd(), "database", file);
  if (!fs.existsSync(full)) {
    throw new Error(`ບໍ່ພົບໄຟລ໌ ${full} (ຕ້ອງແລ່ນຈາກໂຟນເດີ root ຂອງໂປຣເຈັກ)`);
  }
  return fs.readFileSync(full, "utf8").replace(/dormitory_db/g, DB_NAME);
};

/* ---------- helpers ກວດໂຄງສ້າງ (ໃຫ້ migration ແລ່ນຊ້ຳໄດ້ປອດໄພ) ---------- */
const scalar = async (conn: Connection, sql: string, params: any[]): Promise<any> => {
  const [rows] = await conn.query(sql, params);
  const row = (rows as any[])[0];
  return row ? Object.values(row)[0] : undefined;
};

export const tableExists = async (conn: Connection, table: string) =>
  Number(
    await scalar(
      conn,
      "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [DB_NAME, table]
    )
  ) > 0;

export const columnExists = async (conn: Connection, table: string, column: string) =>
  Number(
    await scalar(
      conn,
      "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [DB_NAME, table, column]
    )
  ) > 0;

export const columnType = async (conn: Connection, table: string, column: string): Promise<string> =>
  String(
    (await scalar(
      conn,
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [DB_NAME, table, column]
    )) ?? ""
  );

export const indexExists = async (conn: Connection, table: string, index: string) =>
  Number(
    await scalar(
      conn,
      "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?",
      [DB_NAME, table, index]
    )
  ) > 0;

const ident = (name: string) => `\`${name.replace(/`/g, "")}\``;

/* =========================================================
   Migration — ຍົກລະດັບຖານຂໍ້ມູນເກົ່າ (v1) ໃຫ້ເປັນ v2
   ແລ່ນຊ້ຳກີ່ເທື່ອກໍໄດ້ (idempotent)
   ========================================================= */
export const runMigrations = async (conn: Connection, log: (msg: string) => void = console.log) => {
  const step = async (label: string, needed: () => Promise<boolean>, run: () => Promise<void>) => {
    if (await needed()) {
      await run();
      log(`  ✔ ${label}`);
    }
  };
  const addColumn = (table: string, column: string, ddl: string) =>
    step(
      `${table}.${column}`,
      async () => !(await columnExists(conn, table, column)),
      async () => void (await conn.query(`ALTER TABLE ${ident(table)} ADD COLUMN ${ddl}`))
    );
  const addIndex = (table: string, index: string, ddl: string) =>
    step(
      `index ${table}.${index}`,
      async () => !(await indexExists(conn, table, index)),
      async () => void (await conn.query(`ALTER TABLE ${ident(table)} ADD ${ddl}`))
    );

  // 0) ສ້າງຕາຕະລາງທີ່ຍັງບໍ່ມີ (schema.sql ທຸກ statement ເປັນ IF NOT EXISTS)
  await conn.query(readSqlFile("schema.sql"));

  // 1) users.role ຕ້ອງມີ 'staff'; users.is_active
  await step(
    "users.role ເພີ່ມ 'staff'",
    async () => !(await columnType(conn, "users", "role")).includes("staff"),
    async () => void (await conn.query(
      "ALTER TABLE users MODIFY role ENUM('admin','staff','student') NOT NULL DEFAULT 'student'"
    ))
  );
  await addColumn("users", "is_active", "is_active BOOLEAN NOT NULL DEFAULT TRUE");

  // 2) payments: ໃບແຈ້ງໜີ້ / ໃບຮັບເງິນ / ບິນລາຍເດືອນ
  await addColumn("payments", "type", "type ENUM('rent','deposit','utility','other') NOT NULL DEFAULT 'other'");
  await addColumn("payments", "billing_month", "billing_month CHAR(7) NULL");
  await addColumn("payments", "due_date", "due_date DATE NULL");
  await addColumn("payments", "invoice_no", "invoice_no VARCHAR(30) NULL");
  await addColumn("payments", "receipt_no", "receipt_no VARCHAR(30) NULL");
  await addColumn("payments", "paid_at", "paid_at DATETIME NULL");

  // ເຕີມເລກໃບແຈ້ງໜີ້/ໃບຮັບເງິນໃຫ້ລາຍການເກົ່າ ກ່ອນສ້າງ unique index
  const [n1] = await conn.query(
    `UPDATE payments SET invoice_no = CONCAT('INV-', DATE_FORMAT(created_at,'%Y%m'), '-', LPAD(id,6,'0'))
      WHERE invoice_no IS NULL`
  );
  const [n2] = await conn.query(
    `UPDATE payments SET receipt_no = CONCAT('RC-', DATE_FORMAT(payment_date,'%Y%m'), '-', LPAD(id,6,'0')),
                         paid_at = COALESCE(paid_at, payment_date)
      WHERE status IN ('paid','refunded') AND receipt_no IS NULL`
  );
  const filled = Number((n1 as any).affectedRows || 0) + Number((n2 as any).affectedRows || 0);
  if (filled > 0) log(`  ✔ ເຕີມເລກໃບແຈ້ງໜີ້/ໃບຮັບເງິນໃຫ້ລາຍການເກົ່າ (${filled} ແຖວ)`);

  await addIndex("payments", "uq_payment_invoice", "UNIQUE KEY uq_payment_invoice (invoice_no)");
  await addIndex("payments", "uq_payment_receipt", "UNIQUE KEY uq_payment_receipt (receipt_no)");
  await addIndex("payments", "uq_payment_month", "UNIQUE KEY uq_payment_month (student_id, billing_month, type)");
  await addIndex("payments", "idx_payments_due", "INDEX idx_payments_due (due_date)");
  await addIndex("payments", "idx_payments_status", "INDEX idx_payments_status (status)");
  await addIndex("payments", "idx_payments_student", "INDEX idx_payments_student (student_id)");

  // 3) audit_logs.role
  await addColumn("audit_logs", "role", "role VARCHAR(20) NULL AFTER admin_email");

  // 4) index ອື່ນໆທີ່ຊ່ວຍຄວາມໄວ
  await addIndex("students", "idx_students_room", "INDEX idx_students_room (room_id)");
  await addIndex("students", "idx_students_status", "INDEX idx_students_status (status)");
  await addIndex("bookings", "idx_bookings_status", "INDEX idx_bookings_status (status)");
  await addIndex("bookings", "idx_bookings_student", "INDEX idx_bookings_student (student_id)");
  await addIndex("bookings", "idx_bookings_room", "INDEX idx_bookings_room (room_id)");
  await addIndex("maintenance_requests", "idx_maintenance_status", "INDEX idx_maintenance_status (status)");
  await addIndex("maintenance_requests", "idx_maintenance_room", "INDEX idx_maintenance_room (room_id)");
  await addIndex("notifications", "idx_notifications_student", "INDEX idx_notifications_student (student_id)");
  await addIndex("visitor_logs", "idx_visitor_status", "INDEX idx_visitor_status (status)");
  await addIndex("visitor_logs", "idx_visitor_idcard", "INDEX idx_visitor_idcard (id_card_number)");
  await addIndex("refresh_tokens", "idx_refresh_user", "INDEX idx_refresh_user (user_id)");

  // 5) ລ້າງອີເມວທີ່ມີຊ່ອງວ່າງ/ຕົວພິມໃຫຍ່ (ເຄີຍເຮັດໃຫ້ login ບໍ່ໄດ້)
  await conn.query("UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))");
  await conn.query("UPDATE students SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))");

  // 6) ລ້າງ token ທີ່ໝົດອາຍຸ
  await conn.query("DELETE FROM refresh_tokens WHERE expires_at IS NOT NULL AND expires_at < NOW()");
  await conn.query("DELETE FROM password_resets WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
};
