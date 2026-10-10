import "dotenv/config";
// ຕັ້ງ environment ສຳລັບ test ກ່ອນທີ່ app ຈະຖືກ import
// (ແທນທີ່ຈະອ່ານ .env ຈິງ — ກັນບໍ່ໃຫ້ test ໄປແຕະຖານຂໍ້ມູນຈິງ)
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-test-jwt-secret-test-jwt-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret-xx";
process.env.DB_NAME = process.env.TEST_DB_NAME || "dormitory_test";
process.env.DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.TEST_DB_USER || process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "";
process.env.RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED || "false";
process.env.SMTP_HOST = "";
process.env.SERVE_FRONTEND = "false";
