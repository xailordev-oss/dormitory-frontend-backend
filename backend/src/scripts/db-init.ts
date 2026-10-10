import { connectServer, connectDb, DB_NAME, explainConnectError, readSqlFile, runMigrations } from "./dbtools";

/**
 * npm run db:init            → ສ້າງຖານຂໍ້ມູນ + ຕາຕະລາງທັງໝົດ (ແລ່ນຊ້ຳໄດ້ ບໍ່ລຶບຂໍ້ມູນ)
 * npm run db:init -- --seed  → ພ້ອມເພີ່ມຂໍ້ມູນຕົວຢ່າງ (ຕຶກ, ຫ້ອງ, ນັກສຶກສາ)
 *
 * ໃຊ້ແທນ `mysql ... < schema.sql` ເຊິ່ງໃຊ້ໃນ Windows PowerShell ບໍ່ໄດ້ (PowerShell ບໍ່ຮອງຮັບ <)
 */
const main = async () => {
  const withSeed = process.argv.includes("--seed");

  console.log(`\n🛠  ກຳລັງສ້າງຖານຂໍ້ມູນ "${DB_NAME}" ...`);
  const server = await connectServer();
  try {
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await server.end();
  }

  const conn = await connectDb();
  try {
    await runMigrations(conn); // ສ້າງຕາຕະລາງທີ່ຂາດ + ຍົກລະດັບຖານຂໍ້ມູນເກົ່າ
    console.log("✅ ໂຄງສ້າງຖານຂໍ້ມູນພ້ອມແລ້ວ");

    if (withSeed) {
      const [rows] = await conn.query("SELECT COUNT(*) AS total FROM buildings");
      if (Number((rows as any[])[0].total) > 0) {
        console.log("ℹ️  ຂ້າມ seed ເພາະມີຂໍ້ມູນຕຶກຢູ່ແລ້ວ");
      } else {
        await conn.query(readSqlFile("seed.sql"));
        console.log("✅ ເພີ່ມຂໍ້ມູນຕົວຢ່າງແລ້ວ");
      }
    }
  } finally {
    await conn.end();
  }

  console.log("\nຂັ້ນຕໍ່ໄປ: ສ້າງບັນຊີ admin ຄົນທຳອິດ:");
  console.log('  npm run create-admin -- --email admin@example.com --password "ລະຫັດຂອງເຈົ້າ" --name "Admin"\n');
};

main().catch((error) => {
  console.error("\n❌ db:init ບໍ່ສຳເລັດ:", explainConnectError(error), "\n");
  process.exit(1);
});
