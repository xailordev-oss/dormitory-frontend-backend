# ລະບົບຈັດການຫໍພັກ (Dormitory Management System) v2

Backend (Node.js + Express + TypeScript + MySQL) **ພ້ອມໜ້າເວັບ** ໃນໂຟນເດີ `public/` — ແລ່ນ server ດຽວ ເປີດ `http://localhost:3000` ໄດ້ເລີຍ.

**ເຮັດຫຍັງໄດ້:** ຈັດການຕຶກ/ຫ້ອງ/ນັກສຶກສາ · ຈອງຫ້ອງ (ມີອະນຸມັດ, ກັນຈອງເກີນຄວາມຈຸ) · ອອກໃບແຈ້ງໜີ້/ໃບຮັບເງິນ ແລະ ບິນລາຍເດືອນອັດຕະໂນມັດ · ແຈ້ງສ້ອມແປງ · ບັນທຶກຜູ້ມາຢ້ຽມ · ແຈ້ງການ (ໃນລະບົບ + ອີເມວ) · ລາຍງານ · ປະຫວັດການແກ້ໄຂ (audit log) · 3 ບົດບາດ: `admin`, `staff`, `student`.

---

## A. ຕິດຕັ້ງໃໝ່ (ຍັງບໍ່ມີຖານຂໍ້ມູນ)

ຕ້ອງມີ Node.js 20+ ແລະ MySQL 8 (ຫຼື MariaDB) ທີ່ເປີດຢູ່. ໃນ PowerShell, ຢູ່ໃນໂຟນເດີທີ່ມີ `package.json`:

```powershell
npm install
Copy-Item .env.example .env
```

ເປີດ `.env` ແລ້ວແກ້: `JWT_SECRET`, `JWT_REFRESH_SECRET` (ສອງຄ່າຕ່າງກັນ — ສ້າງດ້ວຍ `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), ແລະ `DB_USER` / `DB_PASSWORD` / `DB_NAME` ໃຫ້ກົງກັບ MySQL ຂອງເຈົ້າ. ຈາກນັ້ນ:

```powershell
npm run db:init                      # ສ້າງຖານຂໍ້ມູນ + ຕາຕະລາງ (ເພີ່ມ  -- --seed  ຖ້າຢາກໄດ້ຂໍ້ມູນຕົວຢ່າງ)
npm run create-admin -- --email admin@example.com --password "ລະຫັດຂອງເຈົ້າ" --name "Admin"
npm run dev                          # ເປີດ http://localhost:3000
```

> `db:init` ໃຊ້ແທນ `mysql ... < schema.sql` ເພາະ PowerShell ບໍ່ຮອງຮັບເຄື່ອງໝາຍ `<`.

## B. ຍົກລະດັບຖານຂໍ້ມູນເກົ່າ (ມີຂໍ້ມູນຈິງຢູ່ແລ້ວ) ⚠️

ຖ້າ `dormitory_db` ຂອງເຈົ້າຖືກສ້າງຈາກເວີຊັນເກົ່າ (v1) ແລະມີຂໍ້ມູນຈິງ **ຢ່າແລ່ນ `db:init` ທັບ** — ໃຫ້ຍົກລະດັບດ້ວຍ `migrate`:

**1) ສຳຮອງຂໍ້ມູນກ່ອນ (ບັງຄັບ)** — ເລືອກອັນໃດອັນໜຶ່ງ:
- MySQL Workbench → ເມນູ **Server → Data Export** → ເລືອກ `dormitory_db` → **Export to Self-Contained File** → **Start Export**
- ຫຼື CMD: `mysqldump -u root -p dormitory_db > backup.sql`

**2) ຢຸດ server ເກົ່າ ແລ້ວແລ່ນ**
```powershell
npm install
npm run migrate
```
`migrate` ແລ່ນຊ້ຳໄດ້ ບໍ່ມີຜົນເສຍ. ມັນ **ເພີ່ມ** ສິ່ງທີ່ຂາດເທົ່ານັ້ນ ແລະ **ບໍ່ລຶບຂໍ້ມູນຂອງເຈົ້າ**:
- ເພີ່ມຕາຕະລາງ `password_resets`, `notification_reads`
- ເພີ່ມຄອລຳໃນ `payments` (`type`, `billing_month`, `due_date`, `invoice_no`, `receipt_no`, `paid_at`) ແລະ `audit_logs.role`; ເພີ່ມ role `staff` ໃນ `users.role`
- ຕື່ມເລກໃບແຈ້ງໜີ້/ໃບຮັບເງິນໃຫ້ລາຍການຊຳລະເກົ່າ
- ເພີ່ມ index ເພື່ອໃຫ້ຄົ້ນຫາໄວຂຶ້ນ
- ປັບອີເມວໃຫ້ເປັນຕົວນ້ອຍ + ຕັດຊ່ອງວ່າງ ແລະ ລຶບ token ທີ່ໝົດອາຍຸແລ້ວ (ສອງຢ່າງນີ້ແກ້ຂໍ້ມູນເດີມເລັກນ້ອຍ)

**3) ຖ້າມີບັນຫາ** — ກູ້ຄືນຈາກໄຟລ໌ສຳຮອງ (Workbench: **Server → Data Import**).

ບັນຊີ admin ເກົ່າຍັງໃຊ້ໄດ້ຄືເກົ່າ. ຖ້າຍັງບໍ່ມີ ໃຫ້ແລ່ນ `npm run create-admin` (ຖ້າອີເມວມີຢູ່ແລ້ວ ມັນຈະເລື່ອນບັນຊີນັ້ນເປັນ admin ໃຫ້).

**ໝາຍເຫດ:** ນັກສຶກສາທີ່ມີຢູ່ແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ຜູກກັບບັນຊີ login → ເປີດໜ້າ **ນັກສຶກສາ** → ຕິກ "ສະເພາະທີ່ຍັງບໍ່ຜູກບັນຊີ" → ແກ້ໄຂ → ເລືອກບັນຊີ.

## C. ໃຊ້ງານ

ເປີດ `http://localhost:3000` ແລ້ວເຂົ້າສູ່ລະບົບ.

| ບົດບາດ | ເຮັດຫຍັງໄດ້ |
|---|---|
| **admin** | ທຸກຢ່າງ: ຕຶກ/ຫ້ອງ, ນັກສຶກສາ, ຜູ້ໃຊ້, ອອກບິນລາຍເດືອນ, ຄືນເງິນ, ລາຍງານ, ປະຫວັດການແກ້ໄຂ |
| **staff** (ພະນັກງານໜ້າຫໍ) | ເບິ່ງນັກສຶກສາ, ອະນຸມັດ/check-out ການຈອງ, ຮັບຊຳລະ, ຈັດການສ້ອມແປງ, ຜູ້ມາຢ້ຽມ, ສົ່ງແຈ້ງການ |
| **student** | ຈອງຫ້ອງ, ເບິ່ງບິນ/ໃບຮັບເງິນຂອງຕົນ, ແຈ້ງສ້ອມແປງ, ອ່ານແຈ້ງການ, ແກ້ໂປຣໄຟລ໌ |

ລາຍລະອຽດສິດທັງໝົດ: [PERMISSIONS.md](PERMISSIONS.md).

**ຂັ້ນຕອນທຳມະດາ:** admin ເພີ່ມຕຶກ → ເພີ່ມຫ້ອງ → ນັກສຶກສາສະໝັກບັນຊີເອງ (ລະບົບສ້າງຂໍ້ມູນນັກສຶກສາໃຫ້) → ນັກສຶກສາຈອງຫ້ອງ → staff ອະນຸມັດ → ທຸກຕົ້ນເດືອນ admin ກົດ **ການຊຳລະ → ອອກບິນລາຍເດືອນ** → ນັກສຶກສາຈ່າຍ → staff ກົດ **ຮັບຊຳລະ** → ໄດ້ໃບຮັບເງິນ.

> ລາຄາຫ້ອງ (`price`) ຖືວ່າເປັນ **ຄ່າເຊົ່າຕໍ່ຄົນຕໍ່ເດືອນ**. ຖ້າຢາກໃຫ້ເປັນລາຄາທັງຫ້ອງ ໃຫ້ຕິກ "ແບ່ງຄ່າຫ້ອງຕາມຈຳນວນຄົນ" ຕອນອອກບິນ.

## D. ອີເມວ (ບໍ່ບັງຄັບ)

ຕັ້ງ `SMTP_HOST` ແລະຄ່າທີ່ກ່ຽວຂ້ອງໃນ `.env` ເພື່ອໃຫ້ສົ່ງອີເມວ (ລິ້ງລືມລະຫັດຜ່ານ, ແຈ້ງການ). ຖ້າບໍ່ຕັ້ງ ທຸກຢ່າງອື່ນໃຊ້ໄດ້ປົກກະຕິ; ຖ້ານັກສຶກສາລືມລະຫັດ ໃຫ້ admin ກົດ **ຜູ້ໃຊ້ → ຕັ້ງລະຫັດໃໝ່**. ບໍ່ມີການສົ່ງ SMS.

## E. ທົດສອບ

```powershell
npm test
```
ໃຊ້ຖານຂໍ້ມູນແຍກຊື່ `dormitory_test` (ສ້າງ/ລ້າງໃຫ້ເອງ ບໍ່ແຕະ `dormitory_db`). ຕ້ອງໃຫ້ `DB_USER` ໃນ `.env` ມີສິດສ້າງຖານຂໍ້ມູນ (`root` ໄດ້). ເຊັ່ນ: ທົດສອບຍິງຈອງພ້ອມກັນໃສ່ຫ້ອງທີ່ເຫຼືອບ່ອນດຽວ, ສິດແຕ່ລະ role, ບິນລາຍເດືອນ, reset ລະຫັດຜ່ານ, rate limit.

## F. Docker

```powershell
Copy-Item .env.example .env       # ແກ້ JWT_SECRET, JWT_REFRESH_SECRET, DB_PASSWORD, DB_NAME
docker compose up -d --build
docker compose exec app node dist/scripts/create-admin.js --email admin@example.com --password "ລະຫັດ" --name Admin
```
ໃນ production ຕັ້ງ `NODE_ENV=production`, `CORS_ORIGIN` (ຖ້າມີ frontend ແຍກ), `TRUST_PROXY=1` (ຫຼັງ nginx) ແລະໃຊ້ HTTPS.

## G. ສິ່ງທີ່ລະບົບນີ້ **ບໍ່ມີ**

- ບໍ່ເຊື່ອມ payment gateway/ທະນາຄານ — ການຊຳລະແມ່ນການ **ບັນທຶກ** ໂດຍພະນັກງານ (ຕ້ອງໃຊ້ບັນຊີ merchant ຂອງທະນາຄານ ຈຶ່ງເຮັດຕໍ່ໄດ້)
- ບໍ່ມີ SMS · ບໍ່ມີການຢືນຢັນອີເມວຕອນສະໝັກ · ໜ້າເວັບເປັນພາສາລາວພາສາດຽວ

## ໂຄງສ້າງໂຟນເດີ

```
src/            ໂຄດ server (controllers, routes, middlewares, scripts/)
public/         ໜ້າເວັບ (HTML/CSS/JS ລ້ວນ ບໍ່ຕ້ອງ build)
database/       schema.sql (ຕິດຕັ້ງໃໝ່), seed.sql (ຂໍ້ມູນຕົວຢ່າງ), legacy/ (migration ເກົ່າ v1)
tests/          automated tests (npm test)
uploads/        ຮູບທີ່ອັບໂຫຼດ (ສຳຮອງໂຟນເດີນີ້ນຳ)
```
