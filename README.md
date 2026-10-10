# Dormitory Frontend (Next.js + TypeScript)

ໜ້າເວັບສຳລັບ **ລະບົບຈັດການຫໍພັກ v2**. ມັນເຊື່ອມກັບ backend `dormitory-v2` ຜ່ານ API ທັງໝົດ (74 endpoint) ແລະ ມີ**ລະບົບແຈ້ງເຕືອນແບບ real-time** ຕາມ role.

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 · SWR (ດຶງຂໍ້ມູນ + cache) · Sonner (toast) · lucide-react (icon)
- ໜ້າເວັບພາສາລາວທັງໝົດ, ໃຊ້ໄດ້ທັງ desktop ແລະ ມືຖື

---

## 1. ຕິດຕັ້ງ ແລະ ແລ່ນ

ຕ້ອງມີ Node.js 20 ຂຶ້ນໄປ ແລະ **backend ຕ້ອງແລ່ນຢູ່ກ່ອນ** (ຄ່າເລີ່ມຕົ້ນ `http://localhost:3000`).

```powershell
cd dormitory-frontend
npm install
Copy-Item .env.example .env.local     # (Mac/Linux: cp .env.example .env.local)
npm run dev                           # ເປີດ http://localhost:3001
```

Build ສຳລັບ production:

```powershell
npm run build
npm start                             # http://localhost:3001
```

### ຕັ້ງຄ່າ `.env.local`

| ຕົວແປ | ຄ່າເລີ່ມຕົ້ນ | ໃຊ້ເຮັດຫຍັງ |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3000` | ທີ່ຢູ່ backend. Next.js ຈະ proxy `/api/*` ແລະ `/uploads/*` ໄປບ່ອນນີ້ |
| `NEXT_PUBLIC_POLL_INTERVAL` | `15000` | ກວດແຈ້ງເຕືອນໃໝ່ທຸກໆກີ່ມິນລິວິນາທີ (ຕ່ຳສຸດ 5000) |

ຍ້ອນ frontend ເອີ້ນ API ຜ່ານ proxy ຂອງ Next.js (domain ດຽວກັນ), **ບໍ່ຕ້ອງຕັ້ງ `CORS_ORIGIN` ຢູ່ backend**.

### ຕັ້ງຄ່າທີ່ແນະນຳຢູ່ backend (`dormitory-v2/.env`)

```env
APP_URL=http://localhost:3001     # ລິ້ງ "ຕັ້ງລະຫັດຜ່ານໃໝ່" ໃນອີເມວຈະຊີ້ມາ frontend ນີ້
SERVE_FRONTEND=false              # (ທາງເລືອກ) ປິດໜ້າເວັບເກົ່າໃນ public/
```

---

## 2. ລະບົບແຈ້ງເຕືອນ (Real-time)

ລະບົບກວດຂໍ້ມູນໃໝ່ທຸກ 15 ວິນາທີ, ທຸກເທື່ອທີ່ກັບມາເປີດ tab ແລະ ທັນທີຫຼັງຜູ້ໃຊ້ປ່ຽນຂໍ້ມູນເອງ. ເມື່ອມີລາຍການໃໝ່:

- 🔔 **Toast** ເດັ້ງຢູ່ມຸມຂວາເທິງ ພ້ອມປຸ່ມ "ເບິ່ງ" ທີ່ພາໄປໜ້າທີ່ກ່ຽວຂ້ອງ
- 🔊 **ສຽງ** ແຈ້ງເຕືອນ **ເປີດສະເໝີ** ແລະ ແຍກຕາມປະເພດ:
  - ການຈອງ: ດີງ-ດອງ-ດີງ (3 ໂນດ)
  - ແຈ້ງເຕືອນທົ່ວໄປ: ດີງ-ດອງ
  - ດ່ວນ ຫຼື ຜິດພາດ: ບີບ 4 ເທື່ອ
  - ກົດປຸ່ມສຳເລັດ (ຈອງ, ອະນຸມັດ, ຮັບເງິນ...): ສຽງສັ້ນ
  - ເປີດເວັບ/login ແລ້ວມີວຽກຄ້າງ ຫຼື ແຈ້ງການທີ່ຍັງບໍ່ໄດ້ອ່ານ: ດັງ 1 ເທື່ອ
- 💻 **Browser notification**: ແຈ້ງແມ້ຢູ່ tab ອື່ນ (ຕ້ອງກົດອະນຸຍາດກ່ອນ)
- 🔴 **ຕົວເລກ** ເທິງກະດິ່ງ, ເມນູດ້ານຂ້າງ ແລະ ຊື່ tab ເຊັ່ນ `(3) ລະບົບຈັດການຫໍພັກ`
- 🔄 ຂໍ້ມູນໃນໜ້າທີ່ກ່ຽວຂ້ອງ**ໂຫຼດໃໝ່ເອງ** ບໍ່ຕ້ອງກົດ refresh

| ເຫດການ | ໃຜໄດ້ຮັບແຈ້ງເຕືອນ | ດຶງຈາກ API |
|---|---|---|
| ນັກສຶກສາຈອງຫ້ອງໃໝ່ | Admin, Staff | `GET /api/bookings?status=pending` |
| ນັກສຶກສາແຈ້ງສ້ອມແປງ | Admin, Staff (ດ່ວນ = toast ສີແດງ) | `GET /api/maintenance?status=pending` |
| ມີບິນເກີນກຳນົດ | Admin, Staff (ໃນກະດິ່ງ) | `GET /api/payments?overdue=true` |
| ການຈອງຖືກອະນຸມັດ / ຍົກເລີກ / ຖືກຈອງແທນ | ນັກສຶກສາ | `GET /api/notifications` |
| ມີໃບແຈ້ງໜີ້ໃໝ່ / ຮັບເງິນແລ້ວ / ເຕືອນຄ້າງຈ່າຍ | ນັກສຶກສາ | `GET /api/notifications` |
| ສະຖານະແຈ້ງສ້ອມປ່ຽນ | ນັກສຶກສາຜູ້ແຈ້ງ | `GET /api/notifications` |
| ແຈ້ງການຈາກຫໍພັກ | ນັກສຶກສາ (ຄົນດຽວ ຫຼື ທຸກຄົນ) | `GET /api/notifications` |

Backend ສ້າງແຈ້ງການໃຫ້ນັກສຶກສາອັດຕະໂນມັດຢູ່ແລ້ວ. ສ່ວນ admin/staff, frontend ກວດວຽກທີ່ລໍຖ້າຈາກ API ທີ່ມີຢູ່. **ບໍ່ຕ້ອງແກ້ backend.** Code ຢູ່ `src/lib/notifications.tsx`.

---

## 3. ໜ້າເວັບ ແລະ API ທີ່ໃຊ້

| ໜ້າ | Role | API |
|---|---|---|
| `/login`, `/register` | ທຸກຄົນ | `POST /auth/login`, `/auth/register`, `GET /auth/me` |
| `/forgot-password`, `/reset-password` | ທຸກຄົນ | `POST /auth/forgot-password`, `/auth/reset-password` |
| `/dashboard` | ທຸກ role (ເນື້ອໃນຕ່າງກັນ) | `GET /reports/dashboard`, `/bookings`, `/maintenance`, `/payments/student/:id`, `/notifications` |
| `/rooms`, `/rooms/[id]` | ທຸກ role | `GET /rooms`, `/rooms/available`, `/rooms/:id`, `/rooms/:id/occupants` · admin: `POST/PUT/DELETE /rooms` |
| `/buildings` | ທຸກ role | `GET /buildings` · admin: `POST/PUT/DELETE /buildings` |
| `/bookings` | ທຸກ role | `GET/POST /bookings`, `PATCH /:id/approve`, `/cancel`, `/checkout`, `PUT/DELETE /:id` |
| `/payments` | ທຸກ role | `GET /payments`, `/payments/student/:id`, `POST /payments`, `PUT /:id/status`, `POST /generate-monthly`, `/send-reminders` |
| `/payments/[id]` | ທຸກ role | `GET /payments/:id/invoice`, `/receipt` (ພິມໄດ້) |
| `/maintenance` | ທຸກ role | `GET/POST /maintenance`, `PUT /:id/status`, `DELETE /:id` |
| `/notifications` | ທຸກ role | `GET /notifications`, `PATCH /:id/read`, `/read-all`, `POST`, `DELETE /:id` |
| `/students` | admin, staff | `GET /students`, `/students/:id` · admin: `POST/PUT/DELETE` |
| `/visitors` | admin, staff | `POST /visitors/check-in`, `/check-out`, `GET /visitors/logs` |
| `/reports` | admin | `GET /reports/occupancy`, `/revenue`, `/maintenance-summary` |
| `/users` | admin | `GET/POST /users`, `PATCH /:id/role`, `/status`, `/password`, `DELETE /:id` |
| `/audit-logs` | admin | `GET /audit-logs` |
| `/profile` | ທຸກ role | `GET/PUT /students/me/profile`, `POST /students/me/avatar`, `PUT /auth/change-password` |
| (ຮູບພາບ) | GET: ທຸກ role · ອື່ນໆ: admin | `GET/POST /images/:type/:id`, `PATCH /images/:id/cover`, `DELETE /images/:id` |
| (ແຖບດ້ານຂ້າງ) | ທຸກ role | `GET /health` (ຈຸດສີສະຖານະ server) |
| (ອັດຕະໂນມັດ) | ທຸກ role | `POST /auth/refresh-token` (ຕໍ່ອາຍຸ token), `POST /auth/logout` |

ເມນູ ແລະ ປຸ່ມຈະສະແດງຕາມສິດຂອງແຕ່ລະ role. Backend ກໍກວດສິດຊ້ຳອີກຊັ້ນ.

---

## 4. ໂຄງສ້າງໂຟນເດີ

```
src/
├── app/
│   ├── (auth)/          login, register, forgot-password, reset-password
│   ├── (app)/           ໜ້າທີ່ຕ້ອງ login (ມີ sidebar + ກະດິ່ງແຈ້ງເຕືອນ)
│   ├── layout.tsx       Providers (Auth, Notification, Confirm, Toaster)
│   └── globals.css      Tailwind + ຟອນລາວ + ຮູບແບບຕອນພິມ
├── components/
│   ├── AppShell.tsx     sidebar ຕາມ role, header, RoleGate
│   ├── NotificationBell.tsx
│   ├── ImageGallery.tsx ອັບໂຫລດ / ຕັ້ງຮູບປົກ / ລຶບຮູບ
│   ├── HeroSlider.tsx   ສະໄລ້ໂຊຮູບຈາກໂຟນເດີ images
│   ├── pickers.tsx      ເລືອກຕຶກ/ຫ້ອງ/ນັກສຶກສາ + ຟອມຈອງຫ້ອງ
│   ├── charts.tsx       ກຣາຟລາຍງານ
│   └── ui.tsx           Button, Modal, Table, Badge, ...
└── lib/
    ├── api.ts           ເອີ້ນ API + ແນບ token + refresh token ອັດຕະໂນມັດ
    ├── auth.tsx         ສະຖານະການ login
    ├── notifications.tsx  ລະບົບແຈ້ງເຕືອນ real-time
    ├── hooks.ts         useAction, useDelete, useFilters
    ├── labels.ts        ປ້າຍພາສາລາວ + ຈັດຮູບແບບເງິນ/ວັນທີ
    └── types.ts         ຊະນິດຂໍ້ມູນຈາກ backend
```

---

## 5. ບັນຫາທີ່ພົບເລື້ອຍ

| ອາການ | ວິທີແກ້ |
|---|---|
| "ເຊື່ອມຕໍ່ server ບໍ່ໄດ້" / ຈຸດສີແດງຢູ່ sidebar | ກວດວ່າ backend ແລ່ນຢູ່ ແລະ `BACKEND_URL` ຖືກຕ້ອງ (ແກ້ `.env.local` ແລ້ວ restart) |
| Login ແລ້ວເດັ້ງກັບມາໜ້າ login | ບັນຊີຖືກປິດ ຫຼື refresh token ໝົດອາຍຸ, ໃຫ້ login ໃໝ່ |
| ນັກສຶກສາຈອງຫ້ອງບໍ່ໄດ້ | ບັນຊີຍັງບໍ່ຜູກກັບຂໍ້ມູນນັກສຶກສາ: admin ໄປໜ້າ "ນັກສຶກສາ", ແກ້ໄຂ, ແລ້ວເລືອກ "ຜູກກັບບັນຊີຜູ້ໃຊ້" |
| ບໍ່ມີສຽງແຈ້ງເຕືອນ / ມີແຖບສີເຫຼືອງ "Browser ຍັງປິດສຽງຢູ່" | Browser ບລັອກສຽງຈົນກວ່າຈະກົດໜ້າເວັບ 1 ເທື່ອ (ເຊັ່ນ ຫຼັງກົດ F5). ກົດບ່ອນໃດກໍໄດ້ ແລ້ວສຽງຈະເປີດ. ກວດວ່າ tab ບໍ່ຖືກ mute ແລະ ລຳໂພງເປີດຢູ່ |
| ນັກສຶກສາຈອງແລ້ວຂຶ້ນ "studentId ຕ້ອງເປັນຈຳນວນເຕັມ..." | ເກີດໃນເວີຊັນເກົ່າ ເມື່ອ login ຫຼາຍບັນຊີໃນ browser ດຽວກັນ. ແກ້ແລ້ວ: ແຕ່ລະ tab ມີ login ຂອງຕົນເອງ. ກົດ F5 ແລ້ວ login ໃໝ່ໃນ tab ນັ້ນ |
| Port 3001 ຖືກໃຊ້ແລ້ວ | ແກ້ `-p 3001` ໃນ `package.json` |

---

## 6. ຮູບສະໄລ້ໂຊ (ໜ້າເຂົ້າສູ່ລະບົບ ແລະ ໜ້າຫຼັກ)

ວາງຮູບຫໍພັກໃນ **`public/images/`** (ຫຼື `images/` ຂ້າງ `package.json` ກໍໄດ້) ແລ້ວ refresh ໜ້າເວັບ. **ບໍ່ຕ້ອງ build ໃໝ່.**

- ຮູບປ່ຽນເອງທຸກ 6 ວິນາທີ, ຢຸດເມື່ອເອົາເມົ້າວາງ, ມີປຸ່ມ ◀ ⏸ ▶, ເລື່ອນດ້ວຍນິ້ວໃນມືຖື ແລະ ກົດ ← → ໄດ້
- ລຽງຕາມຊື່ໄຟລ໌ (`01.jpg`, `02.jpg`...) ຫຼື ກຳນົດລຳດັບ + ຂໍ້ຄວາມໃຕ້ຮູບໃນ `slides.json` (ເບິ່ງ `public/images/README.md`)
- ຖ້າບໍ່ມີຮູບ: ໜ້າເຂົ້າສູ່ລະບົບເປັນພື້ນສີຟ້າ, ໜ້າຫຼັກເປັນຫົວຂໍ້ທຳມະດາ
- Code: `src/components/HeroSlider.tsx`, `src/lib/slides.ts`, `src/app/slides/`
