import "dotenv/config";
import { env } from "./config/env"; // ກວດ env ກ່ອນສິ່ງອື່ນທັງໝົດ
import app from "./app";
import pool, { testConnection } from "./config/db";
import { isMailEnabled } from "./config/env";

const server = app.listen(env.PORT, async () => {
  console.log(`🚀 Server ແລ່ນຢູ່ http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  console.log(isMailEnabled() ? "✉️  ເປີດການສົ່ງອີເມວ (SMTP)" : "✉️  ບໍ່ໄດ້ຕັ້ງ SMTP — ບໍ່ສົ່ງອີເມວ (ລະບົບອື່ນໃຊ້ໄດ້ປົກກະຕິ)");
  await testConnection();
});

/* ---------------------------------------------------------
   Graceful shutdown — ປິດ connection pool ໃຫ້ຮຽບຮ້ອຍກ່ອນອອກ
   ກັນ connection ຄ້າງຢູ່ MySQL ເວລາ restart ຫຼື deploy
   --------------------------------------------------------- */
const shutdown = (signal: string) => {
  console.log(`\n${signal} — ກຳລັງປິດ server...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    console.log("✅ ປິດຮຽບຮ້ອຍ");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ກັນ process ຕາຍງຽບໆໂດຍບໍ່ຮູ້ສາເຫດ
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

export default app;
