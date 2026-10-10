-- =========================================================
-- Migration: ແກ້ໄຂຂໍ້ມູນເພ້ຍ ແລະ ເພີ່ມ index ທີ່ຂາດ
-- ແລ່ນຫຼັງ schema.sql ແລະ migration_admin_features.sql
-- =========================================================
SET NAMES utf8mb4;
USE dormitory_db;

-- ---------------------------------------------------------
-- 1) ລ້າງອີເມວທີ່ມີຊ່ອງວ່າງ / ຕົວພິມໃຫຍ່ປົນ
--    ສາເຫດ: register ເກົ່າບໍ່ໄດ້ trim ແລະ ບໍ່ກວດຮູບແບບ
--    ຜົນ: ບັນຊີຢ່າງ " A test@example.com" login ບໍ່ໄດ້ຕະຫຼອດໄປ
-- ---------------------------------------------------------
UPDATE users    SET email = LOWER(TRIM(email));
UPDATE students SET email = LOWER(TRIM(email));

-- ເບິ່ງກ່ອນວ່າມີບັນຊີໃດຍັງຜິດຮູບແບບແດ່ (ຊ່ອງວ່າງກາງ / ບໍ່ມີ @ / ບໍ່ມີຈຸດ)
SELECT id, name, email, role, created_at
  FROM users
 WHERE email LIKE '% %' OR email NOT LIKE '%@%.%';

-- ⚠️ ຢ່າລຶບໄປເລີຍ! ກວດ role ກ່ອນ — ອາດມີບັນຊີ admin ປົນຢູ່
--
-- ທາງເລືອກ A (ແນະນຳ): ແກ້ອີເມວໃຫ້ຖືກ ບັນຊີຈະ login ໄດ້ຄືນ
--   ຕົວຢ່າງ: "a test@example.com" ເປັນໄປໄດ້ວ່າຕັ້ງໃຈພິມ "atest@example.com"
--   UPDATE users SET email = REPLACE(email, ' ', '') WHERE email LIKE '% %';
--
-- ທາງເລືອກ B: ລຶບຖິ້ມ ຖ້າແນ່ໃຈວ່າເປັນບັນຊີທົດສອບ ແລະ ບໍ່ແມ່ນ admin ຄົນສຸດທ້າຍ
--   DELETE FROM users WHERE (email LIKE '% %' OR email NOT LIKE '%@%.%') AND role <> 'admin';

-- ---------------------------------------------------------
-- 2) ລ້າງ refresh token ທີ່ໝົດອາຍຸແລ້ວ
-- ---------------------------------------------------------
DELETE FROM refresh_tokens WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- ---------------------------------------------------------
-- 3) ຊິ້ງ status ຂອງຫ້ອງໃຫ້ກົງກັບຈຳນວນການຈອງຈິງ
--    ສາເຫດ: code ເກົ່າສ້າງ/checkout booking ແລ້ວບໍ່ເຄີຍແຕະ rooms.status
--    ຜົນ: GET /api/rooms/available ໃຫ້ຄຳຕອບຜິດ
-- ---------------------------------------------------------
UPDATE rooms r
   SET r.status = CASE
     WHEN r.status = 'maintenance' THEN 'maintenance'
     WHEN (SELECT COUNT(*) FROM bookings b
            WHERE b.room_id = r.id AND b.status IN ('pending','active')) >= r.capacity
       THEN 'occupied'
     ELSE 'available'
   END;

-- ຊິ້ງ students.room_id ໃຫ້ກົງກັບ booking ທີ່ຍັງໃຊ້ງານຢູ່
UPDATE students s
   SET s.room_id = (
     SELECT b.room_id FROM bookings b
      WHERE b.student_id = s.id AND b.status IN ('pending','active')
      ORDER BY b.id DESC LIMIT 1
   )
 WHERE EXISTS (
   SELECT 1 FROM bookings b
    WHERE b.student_id = s.id AND b.status IN ('pending','active')
 );

-- ---------------------------------------------------------
-- 4) Index ທີ່ຂາດ — query ຕ່າງໆກັ່ນຕອງດ້ວຍ column ເຫຼົ່ານີ້ຕະຫຼອດ
--    ບໍ່ມີ index = full table scan ທຸກເທື່ອ
--
--    ໝາຍເຫດ: MySQL 8 ບໍ່ຮອງຮັບ "CREATE INDEX IF NOT EXISTS" (ມີແຕ່ MariaDB)
--    ຈຶ່ງໃຊ້ stored procedure ກວດ information_schema ກ່ອນ — ແລ່ນໄດ້ທັງສອງ
--    ແລະ ແລ່ນຊ້ຳໄດ້ຫຼາຍເທື່ອໂດຍບໍ່ error
-- ---------------------------------------------------------
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_cols  VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
     WHERE table_schema = DATABASE()
       AND table_name   = p_table
       AND index_name   = p_index
  ) THEN
    SET @ddl = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_cols, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_index_if_missing('bookings',             'idx_bookings_student', 'student_id');
CALL add_index_if_missing('bookings',             'idx_bookings_room',    'room_id');
CALL add_index_if_missing('bookings',             'idx_bookings_status',  'status');
CALL add_index_if_missing('payments',             'idx_payments_student', 'student_id');
CALL add_index_if_missing('payments',             'idx_payments_status',  'status');
CALL add_index_if_missing('payments',             'idx_payments_date',    'payment_date');
CALL add_index_if_missing('maintenance_requests', 'idx_maint_room',       'room_id');
CALL add_index_if_missing('maintenance_requests', 'idx_maint_status',     'status');
CALL add_index_if_missing('notifications',        'idx_notif_student',    'student_id');
CALL add_index_if_missing('visitor_logs',         'idx_visitor_status',   'status');
CALL add_index_if_missing('students',             'idx_students_room',    'room_id');
CALL add_index_if_missing('students',             'idx_students_status',  'status');
CALL add_index_if_missing('rooms',                'idx_rooms_building',   'building_id');

DROP PROCEDURE add_index_if_missing;

-- ---------------------------------------------------------
-- 4b) ບັງຄັບນະໂຍບາຍ "1 ຫ້ອງບໍ່ເກີນ 4 ຄົນ" ຢູ່ລະດັບຖານຂໍ້ມູນ
--     code ກວດໃຫ້ຢູ່ແລ້ວ ແຕ່ໃສ່ CHECK ໄວ້ນຳ ເພື່ອກັນການແກ້ຜ່ານ
--     Workbench / script ພາຍນອກທີ່ບໍ່ຜ່ານ API
-- ---------------------------------------------------------

-- ເບິ່ງກ່ອນວ່າມີຫ້ອງໃດຕັ້ງ capacity ເກີນ 4 ຢູ່ແລ້ວແດ່
SELECT r.id, r.room_number, b.name AS building, r.capacity,
       (SELECT COUNT(*) FROM students s
         WHERE s.room_id = r.id AND s.status = 'active') AS occupants
  FROM rooms r
  LEFT JOIN buildings b ON b.id = r.building_id
 WHERE r.capacity > 4;

-- ຫຼຸດຫ້ອງທີ່ເກີນລົງມາເປັນ 4 ອັດຕະໂນມັດ
-- (ຖ້າມີຫ້ອງໃດມີຄົນຢູ່ເກີນ 4 ແລ້ວ ຕ້ອງຍ້າຍຄົນອອກເອງກ່ອນ — ເບິ່ງຂໍ້ 6)
UPDATE rooms SET capacity = 4 WHERE capacity > 4;

-- ເພີ່ມ CHECK constraint ສະເພາະເມື່ອຂໍ້ມູນຜ່ານແລ້ວ
-- (ຮອງຮັບ MySQL 8.0.16+ ແລະ MariaDB 10.2+; ແລ່ນຊ້ຳໄດ້ບໍ່ error)
DROP PROCEDURE IF EXISTS add_capacity_check;

DELIMITER $$
CREATE PROCEDURE add_capacity_check()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE constraint_schema = DATABASE()
       AND table_name        = 'rooms'
       AND constraint_name   = 'chk_rooms_capacity'
  ) AND NOT EXISTS (
    SELECT 1 FROM rooms WHERE capacity > 4 OR capacity < 1
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1 AND capacity <= 4);
  END IF;
END$$
DELIMITER ;

CALL add_capacity_check();
DROP PROCEDURE add_capacity_check;

-- ---------------------------------------------------------
-- 5) ກວດຜົນ
-- ---------------------------------------------------------
SELECT 'users'    AS table_name, COUNT(*) AS rows_count FROM users
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'rooms',    COUNT(*) FROM rooms
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings;

-- ---------------------------------------------------------
-- 6) ແກ້ຂໍ້ມູນທີ່ເກີນຄວາມຈຸຫ້ອງ (ຖ້າມີ)
--    ກ່ອນແກ້ code ບໍ່ມີການກວດຄວາມຈຸ ຈຶ່ງອາດມີຫ້ອງທີ່ຄົນເກີນຢູ່ແລ້ວ
--    ແລ່ນ query ນີ້ເພື່ອເບິ່ງກ່ອນ:
-- ---------------------------------------------------------
SELECT r.id, r.room_number, b.name AS building, r.capacity,
       (SELECT COUNT(*) FROM students s
         WHERE s.room_id = r.id AND s.status = 'active') AS occupants
  FROM rooms r
  LEFT JOIN buildings b ON b.id = r.building_id
 HAVING occupants > r.capacity;
-- ຖ້າມີຜົນລັບ ໃຫ້ຍ້າຍນັກສຶກສາສ່ວນເກີນອອກໄປຫ້ອງອື່ນເອງ
-- (ຍ້ອນເພດານແມ່ນ 4 ຄົນ ຈຶ່ງເພີ່ມ capacity ແກ້ບໍ່ໄດ້ອີກຕໍ່ໄປ)
-- ຕົວຢ່າງ: UPDATE students SET room_id = NULL WHERE id IN (...);
-- ລະບົບຈະບໍ່ຍອມໃຫ້ເພີ່ມຄົນເຂົ້າຫ້ອງເຫຼົ່ານີ້ອີກຈົນກວ່າຈະແກ້

-- ---------------------------------------------------------
-- 7) ຊິ້ງ rooms.status ຄືນຈາກຈຳນວນຜູ້ພັກຈິງ (students.room_id)
--    ຕ້ອງແລ່ນທ້າຍສຸດ ຫຼັງຈາກ students.room_id ຖືກຊິ້ງແລ້ວ (ຂໍ້ 3)
-- ---------------------------------------------------------
UPDATE rooms r
   SET r.status = CASE
     WHEN r.status = 'maintenance' THEN 'maintenance'
     WHEN (SELECT COUNT(*) FROM students s
            WHERE s.room_id = r.id AND s.status = 'active') >= r.capacity
       THEN 'occupied'
     ELSE 'available'
   END;

SELECT r.id, r.room_number, r.capacity,
       (SELECT COUNT(*) FROM students s
         WHERE s.room_id = r.id AND s.status = 'active') AS occupants,
       r.status
  FROM rooms r ORDER BY r.id;
