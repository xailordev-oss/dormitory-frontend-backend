-- =========================================================
-- ຂໍ້ມູນຕົວຢ່າງ (Optional) - Run ຫຼັງຈາກ schema.sql
-- =========================================================
SET NAMES utf8mb4;
USE dormitory_db;

INSERT INTO buildings (name, address, total_floors) VALUES
  ('ຕຶກ A', 'ຖະໜົນທົ່ງກາງ, ນະຄອນຫຼວງວຽງຈັນ', 5),
  ('ຕຶກ B', 'ຖະໜົນທົ່ງກາງ, ນະຄອນຫຼວງວຽງຈັນ', 4);

INSERT INTO rooms (room_number, building_id, capacity, price, status) VALUES
  ('A101', 1, 2, 500000, 'available'),
  ('A102', 1, 2, 500000, 'available'),
  ('B201', 2, 3, 650000, 'available');

INSERT INTO students (name, email, phone, room_id, status) VALUES
  ('ສົມສີ ວົງສະຫວັນ', 'somsy@example.com', '02055512345', 1, 'active'),
  ('ນາງ ພອນສະຫວັນ', 'phonsavanh@example.com', '02055567890', NULL, 'active');
