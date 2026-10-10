import { connectDb, DB_NAME, explainConnectError, runMigrations } from "./dbtools";

/**
 * npm run migrate → ຍົກລະດັບຖານຂໍ້ມູນເກົ່າ (v1) ໃຫ້ເປັນ v2 ໂດຍບໍ່ລຶບຂໍ້ມູນ
 * ແລ່ນຊ້ຳໄດ້ ບໍ່ມີຜົນເສຍ (ຂ້າມສິ່ງທີ່ມີຢູ່ແລ້ວ)
 */
const main = async () => {
  console.log(`\n🔧 Migration ຖານຂໍ້ມູນ "${DB_NAME}" ...`);
  const conn = await connectDb();
  try {
    await runMigrations(conn);
    console.log("✅ ຖານຂໍ້ມູນເປັນເວີຊັນຫຼ້າສຸດແລ້ວ\n");
  } finally {
    await conn.end();
  }
};

main().catch((error) => {
  console.error("\n❌ migrate ບໍ່ສຳເລັດ:", explainConnectError(error), "\n");
  process.exit(1);
});
