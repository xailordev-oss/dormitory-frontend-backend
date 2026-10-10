-- =========================================================
-- Migration: ຟີເຈີການຈັດການ admin ເພີ່ມເຕີມ
-- ຮັນໄຟລ໌ນີ້ ຖ້າ database ຂອງທ່ານສ້າງມາກ່ອນໜ້ານີ້ແລ້ວ (ຄື run schema.sql ໄປແລ້ວ)
-- ຖ້າເປັນການຕິດຕັ້ງໃໝ່ໝົດ ໃຫ້ໃຊ້ schema.sql ຫຼ້າສຸດ (ມີໃຫ້ຄົບແລ້ວ ບໍ່ຈຳເປັນຕ້ອງລັນໄຟລ໌ນີ້)
-- =========================================================

USE dormitory_db;

-- ---------------------------------------------------------
-- users.is_active : ໃຫ້ admin ປິດ/ເປີດການໃຊ້ງານບັນຊີ (ແທນການລຶບຖາວອນ)
-- ---------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER role;

-- ---------------------------------------------------------
-- audit_logs : ບັນທຶກການກະທຳຂອງ admin (ໃຜ, ເຮັດຫຍັງ, ເມື່ອໃດ)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  admin_email VARCHAR(150) NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(255) NOT NULL,
  status_code INT NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_admin
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_admin (admin_id),
  INDEX idx_audit_logs_created (created_at)
) ENGINE=InnoDB;
