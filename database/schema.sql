-- =========================================================
-- Dormitory Management System - Schema (v2)
-- ໃຊ້ໄດ້ທັງ MySQL 8 ແລະ MariaDB 10.x
--
-- ວິທີໃຊ້ (ເລືອກອັນໃດອັນໜຶ່ງ):
--   1) npm run db:init            ← ແນະນຳ (ໃຊ້ໄດ້ໃນ Windows PowerShell ບໍ່ຕ້ອງມີ mysql CLI)
--   2) MySQL Workbench: File → Open SQL Script → ກົດ ⚡ Run
--   3) mysql -u root -p < database/schema.sql   (ໃຊ້ໄດ້ໃນ CMD/Git Bash, ບໍ່ໃຊ້ PowerShell)
--
-- ຖ້າມີຖານຂໍ້ມູນເກົ່າຢູ່ແລ້ວ → ຢ່າແລ່ນໄຟລ໌ນີ້ຊ້ຳ ໃຫ້ໃຊ້: npm run migrate
-- =========================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS dormitory_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dormitory_db;

-- ---------------------------------------------------------
-- users : ບັນຊີ login   role = admin | staff | student
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','staff','student') NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- refresh_tokens
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_token (token(255)),
  INDEX idx_refresh_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- password_resets : token ສຳລັບ "ລືມລະຫັດຜ່ານ" (ເກັບແຕ່ hash, ບໍ່ເກັບ token ຈິງ)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_password_reset_hash (token_hash),
  INDEX idx_password_reset_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- buildings
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS buildings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NULL,
  total_floors INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- rooms  (1 ຫ້ອງ ຢູ່ໄດ້ 1–4 ຄົນ)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(50) NOT NULL,
  building_id INT NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  price DECIMAL(12,2) NOT NULL,
  status ENUM('available','occupied','maintenance') NOT NULL DEFAULT 'available',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_building
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_room_per_building (building_id, room_number),
  CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1 AND capacity <= 4)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- students
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  avatar_url VARCHAR(500) NULL,
  room_id INT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_room
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  CONSTRAINT fk_students_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_students_room (room_id),
  INDEX idx_students_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- bookings   pending → active → checked_out   (ຫຼື cancelled)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  room_id INT NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATETIME NULL,
  status ENUM('pending','active','checked_out','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_room
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_student (student_id),
  INDEX idx_bookings_room (room_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- payments
--   invoice_no  = ເລກໃບແຈ້ງໜີ້  (ສ້າງທຸກລາຍການ)      ເຊັ່ນ INV-202610-000012
--   receipt_no  = ເລກໃບຮັບເງິນ (ສ້າງຕອນຈ່າຍແລ້ວ)     ເຊັ່ນ RC-202610-000012
--   billing_month = ເດືອນທີ່ເກັບ (YYYY-MM) ໃຊ້ກັນອອກບິນຊ້ຳ
--   unique (student_id, billing_month, type) → ອອກບິນລາຍເດືອນຊ້ຳບໍ່ໄດ້
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash','bank_transfer','card','mobile_banking') NOT NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  type ENUM('rent','deposit','utility','other') NOT NULL DEFAULT 'other',
  description VARCHAR(255) NULL,
  billing_month CHAR(7) NULL,
  due_date DATE NULL,
  invoice_no VARCHAR(30) NULL,
  receipt_no VARCHAR(30) NULL,
  paid_at DATETIME NULL,
  payment_date DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uq_payment_invoice (invoice_no),
  UNIQUE KEY uq_payment_receipt (receipt_no),
  UNIQUE KEY uq_payment_month (student_id, billing_month, type),
  INDEX idx_payments_status (status),
  INDEX idx_payments_student (student_id),
  INDEX idx_payments_due (due_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  reported_by INT NULL,
  issue VARCHAR(500) NOT NULL,
  priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status ENUM('pending','in_progress','resolved','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_room
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_student
    FOREIGN KEY (reported_by) REFERENCES students(id) ON DELETE SET NULL,
  INDEX idx_maintenance_status (status),
  INDEX idx_maintenance_room (room_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- notifications   student_id = NULL → ແຈ້ງການລວມ (ທຸກຄົນເຫັນ)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  type ENUM('info','warning','urgent','payment','maintenance') NOT NULL DEFAULT 'info',
  student_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_notifications_student (student_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- notification_reads : ສະຖານະ "ອ່ານແລ້ວ" ຂອງແຈ້ງການລວມ ແຍກຕາມນັກສຶກສາແຕ່ລະຄົນ
--   (ກ່ອນນີ້ນັກສຶກສາຄົນໜຶ່ງກົດອ່ານ ທຸກຄົນກໍກາຍເປັນອ່ານແລ້ວ)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INT NOT NULL,
  student_id INT NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, student_id),
  CONSTRAINT fk_nr_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_nr_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- visitor_logs
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitor_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visitor_name VARCHAR(150) NOT NULL,
  id_card_number VARCHAR(50) NULL,
  phone VARCHAR(30) NULL,
  purpose VARCHAR(255) NULL,
  student_id INT NULL,
  room_id INT NULL,
  check_in_time DATETIME NOT NULL,
  check_out_time DATETIME NULL,
  status ENUM('checked_in','checked_out') NOT NULL DEFAULT 'checked_in',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_visitor_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_visitor_room
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_visitor_status (status),
  INDEX idx_visitor_idcard (id_card_number)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- images
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('room','building','student') NOT NULL,
  entity_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_images_entity (entity_type, entity_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- audit_logs : ປະຫວັດການແກ້ໄຂຂໍ້ມູນຂອງ admin / staff
--   (ຊື່ column admin_id / admin_email ຄົງໄວ້ເພື່ອບໍ່ໃຫ້ຖານຂໍ້ມູນເກົ່າພັງ
--    ຕອນນີ້ເກັບທັງ admin ແລະ staff — ເບິ່ງ column role)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  admin_email VARCHAR(150) NULL,
  role VARCHAR(20) NULL,
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
