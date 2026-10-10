# ສິດທິຂອງແຕ່ລະ role

ລະບົບມີ 3 role (ເກັບຢູ່ `users.role`): **admin**, **staff**, **student**.

- ທຸກ request ກວດ token ແລະ **ກວດຖານຂໍ້ມູນ** ທຸກເທື່ອ: ບັນຊີທີ່ຖືກປິດ ຫຼື ປ່ຽນ role ມີຜົນທັນທີ (ບໍ່ຕ້ອງລໍ token ໝົດອາຍຸ)
- ສະໝັກເອງ (`/api/auth/register`) ໄດ້ role `student` ສະເໝີ — ສົ່ງ role ມາເອງບໍ່ໄດ້
- admin ສ້າງບັນຊີ staff/admin ຜ່ານ `POST /api/users` ຫຼື ປ່ຽນ role ຜ່ານ `PATCH /api/users/:id/role`; ຄົນທຳອິດໃຊ້ `npm run create-admin`
- ຕັ້ງ `ALLOW_REGISTRATION=false` ເພື່ອປິດການສະໝັກເອງ

## ສະຫຼຸບ

| ດ້ານ | admin | staff | student |
|---|---|---|---|
| ຜູ້ໃຊ້ (users) | ທຸກຢ່າງ (ສ້າງ, ປ່ຽນ role, ເປີດ/ປິດ, ຕັ້ງລະຫັດ, ລຶບ) | ✗ | ✗ |
| ນັກສຶກສາ | ເບິ່ງ, ເພີ່ມ, ແກ້ (ຜູກບັນຊີ), ລຶບ | ເບິ່ງ | ໂປຣໄຟລ໌ຕົນເອງ (ຊື່, ເບີໂທ, ຮູບ) |
| ຕຶກ / ຫ້ອງ | ເພີ່ມ, ແກ້, ລຶບ | ເບິ່ງ + ເບິ່ງຜູ້ພັກ | ເບິ່ງ (ຜູ້ພັກສະເພາະຫ້ອງຕົນ) |
| ການຈອງ | ທຸກຢ່າງ (ແກ້, ລຶບ) | ເບິ່ງທັງໝົດ, ຈອງແທນ, **ອະນຸມັດ**, **check-out**, ຍົກເລີກ | ຈອງໃນນາມຕົນ, ຍົກເລີກສະເພາະ pending ຂອງຕົນ |
| ການຊຳລະ | ທຸກຢ່າງ + ອອກບິນລາຍເດືອນ + ຄືນເງິນ + ສົ່ງແຈ້ງເຕືອນ | ເບິ່ງ, ອອກບິນ, ຮັບຊຳລະ (ຄືນເງິນບໍ່ໄດ້) | ເບິ່ງໃບແຈ້ງໜີ້/ໃບຮັບເງິນຂອງຕົນ |
| ແຈ້ງສ້ອມແປງ | ທຸກຢ່າງ (ລຶບໄດ້) | ເບິ່ງທັງໝົດ, ແຈ້ງແທນ, ປ່ຽນສະຖານະ | ແຈ້ງເອງ; ເບິ່ງທີ່ຕົນແຈ້ງ + ຂອງຫ້ອງຕົນ |
| ຜູ້ມາຢ້ຽມ | ທຸກຢ່າງ | ທຸກຢ່າງ | ✗ |
| ແຈ້ງການ | ສ້າງ, ເບິ່ງທັງໝົດ, ລຶບ | ສ້າງ, ເບິ່ງທັງໝົດ | ອ່ານຂອງຕົນ + ແຈ້ງລວມ (ສະຖານະອ່ານແລ້ວແຍກຕາມຄົນ) |
| Dashboard | ✓ | ✓ | ✗ |
| ລາຍງານ (ລາຍຮັບ, ເຂົ້າພັກ, ສ້ອມແປງ) | ✓ | ✗ | ✗ |
| ຮູບພາບ | ອັບໂຫຼດ, ຕັ້ງຮູບປົກ, ລຶບ | ເບິ່ງ | ເບິ່ງ + avatar ຕົນເອງ |
| Audit log | ເບິ່ງ | ✗ (ແຕ່ການກະທຳຂອງ staff ຖືກບັນທຶກ) | ✗ |

## ຂໍ້ຈຳກັດກັນລະບົບພັງ

| ເຮັດບໍ່ໄດ້ | ລະຫັດ |
|---|---|
| admin ຫຼຸດ role / ປິດ / ລຶບ ບັນຊີຕົນເອງ | 400 |
| ຫຼຸດ/ປິດ/ລຶບ admin ຄົນສຸດທ້າຍ | 409 |
| ລຶບຕຶກທີ່ຍັງມີຫ້ອງ; ລຶບຫ້ອງທີ່ມີການຈອງ active | 409 |
| ລຶບຫ້ອງ/ນັກສຶກສາທີ່ມີປະຫວັດ (ຕ້ອງ `?force=true`) | 409 |
| ຈອງຊ້ຳ (ນັກສຶກສາ 1 ຄົນ ມີການຈອງ active ໄດ້ 1 ອັນ) / ຈອງຫ້ອງເຕັມ / ຫ້ອງກຳລັງສ້ອມ | 409 |
| ອອກບິນເດືອນ+ປະເພດດຽວກັນຊ້ຳ | 409 |
| ເປີດການຈອງທີ່ check-out/ຍົກເລີກແລ້ວກັບມາໃໝ່ | 409 |
| ຈ່າຍແລ້ວກັບໄປ pending; ຄືນເງິນແລ້ວປ່ຽນຕໍ່ | 409 |
| ອອກໃບຮັບເງິນຂອງບິນທີ່ຍັງບໍ່ໄດ້ຈ່າຍ | 409 |

## Endpoint ທັງໝົດ

ລາຍການແບບແບ່ງໜ້າຮັບ `?page=1&limit=50` (ສູງສຸດ 200) ແລະຕອບ `data, total, page, limit, totalPages`.

| Method | Endpoint | ສິດ |
|---|---|---|
| GET | `/health` | ເປີດ |
| POST | `/api/auth/register`, `/login`, `/refresh-token`, `/logout`, `/forgot-password`, `/reset-password` | ເປີດ |
| PUT | `/api/auth/change-password` | login |
| GET | `/api/auth/me` | login |
| GET/PUT | `/api/students/me/profile` · POST `/api/students/me/avatar` | login |
| GET | `/api/students`, `/api/students/:id` | admin, staff |
| POST/PUT/DELETE | `/api/students[/:id]` | admin |
| GET | `/api/buildings[/:id]` | login |
| POST/PUT/DELETE | `/api/buildings[/:id]` | admin |
| GET | `/api/rooms`, `/api/rooms/available`, `/api/rooms/:id` | login |
| GET | `/api/rooms/:id/occupants` | staff; student = ຫ້ອງຕົນ |
| POST/PUT/DELETE | `/api/rooms[/:id]` | admin |
| GET | `/api/bookings[/:id]` | login (student = ຂອງຕົນ) |
| POST | `/api/bookings` | login (student = ໃນນາມຕົນ) |
| PATCH | `/api/bookings/:id/cancel` | login (student = pending ຂອງຕົນ) |
| PATCH | `/api/bookings/:id/approve`, `/checkout` | admin, staff |
| PUT/DELETE | `/api/bookings/:id` | admin |
| GET | `/api/payments` | admin, staff |
| GET | `/api/payments/student/:studentId`, `/:id`, `/:id/invoice`, `/:id/receipt` | login (student = ຂອງຕົນ) |
| POST | `/api/payments` · PUT `/api/payments/:id/status` | admin, staff (`refunded` = admin) |
| POST | `/api/payments/generate-monthly`, `/send-reminders` | admin |
| GET/POST | `/api/maintenance` | login |
| PUT | `/api/maintenance/:id/status` | admin, staff |
| DELETE | `/api/maintenance/:id` | admin |
| POST | `/api/visitors/check-in`, `/check-out` · GET `/logs` | admin, staff |
| GET | `/api/notifications` · PATCH `/:id/read`, `/read-all` | login |
| POST | `/api/notifications` | admin, staff |
| DELETE | `/api/notifications/:id` | admin |
| GET | `/api/reports/dashboard` | admin, staff |
| GET | `/api/reports/occupancy`, `/revenue`, `/maintenance-summary` | admin |
| GET/POST/PATCH/DELETE | `/api/users[/:id[/role|/status|/password]]` | admin |
| GET/POST/PATCH/DELETE | `/api/images/...` | GET login; ອື່ນໆ admin |
| GET | `/api/audit-logs` | admin |
