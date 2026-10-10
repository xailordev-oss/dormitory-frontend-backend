import { defineConfig } from "vitest/config";

// Automated test ໃຊ້ຖານຂໍ້ມູນແຍກ (DB_NAME=dormitory_test) — ບໍ່ແຕະຂໍ້ມູນຈິງຂອງເຈົ້າ
// ຖານຂໍ້ມູນ test ຖືກສ້າງ/ລ້າງໃຫ້ອັດຕະໂນມັດໂດຍ tests/global-setup.ts
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/env-setup.ts"],
    // ທຸກໄຟລ໌ໃຊ້ຖານຂໍ້ມູນດຽວກັນ → ແລ່ນທີລະໄຟລ໌ ບໍ່ໃຫ້ຊົນກັນ
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
