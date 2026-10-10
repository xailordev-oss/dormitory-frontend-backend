# ກົດການຄວບຄຸມຄວາມຈຸຫ້ອງ

## ແນວຄິດຫຼັກ

**ນະໂຍບາຍຂອງຫໍ: 1 ຫ້ອງຢູ່ໄດ້ບໍ່ເກີນ 4 ຄົນ ເດັດຂາດ**

ຄວາມຈຸກຳນົດຕໍ່ຫ້ອງຜ່ານ `rooms.capacity` — ຕັ້ງໄດ້ລະຫວ່າງ **1 ຫາ 4** ເທົ່ານັ້ນ (ຄ່າມາດຕະຖານ **4** ຖ້າບໍ່ໄດ້ລະບຸ). ຕັ້ງ 5 ຂຶ້ນໄປຈະຖືກປະຕິເສດ `400 CAPACITY_LIMIT_EXCEEDED`.

ບັງຄັບໄວ້ **2 ຊັ້ນ**:
1. **ໃນ code** — `MAX_ROOM_CAPACITY = 4` ໃນ `src/utils/helpers.ts`
2. **ໃນຖານຂໍ້ມູນ** — `CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1 AND capacity <= 4)`
   ກັນການແກ້ຜ່ານ Workbench ຫຼື script ພາຍນອກທີ່ບໍ່ຜ່ານ API

ຈຳນວນຜູ້ພັກນັບຈາກ **`students.room_id`** ບ່ອນດຽວ — ບໍ່ແມ່ນຈາກຕາຕະລາງ `bookings`.

ເຫດຜົນ: ນັກສຶກສາເຂົ້າຫ້ອງໄດ້ 2 ທາງ
1. ຜ່ານການຈອງ — `POST /api/bookings`
2. admin ຜູກໃຫ້ໂດຍກົງ — `POST /api/students` ຫຼື `PUT /api/students/:id` ພ້ອມ `roomId`

ຖ້ານັບຈາກ `bookings` ຢ່າງດຽວ ທາງທີ 2 ຈະຂ້າມການກວດຄວາມຈຸໄປ. ດັ່ງນັ້ນທຸກຈຸດຈຶ່ງນັບຈາກແຫຼ່ງດຽວກັນ ແລະ `booking.controller` ເປັນຜູ້ຮັກສາໃຫ້ `students.room_id` ກົງກັບການຈອງສະເໝີ.

> ໝາຍເຫດ: ນັກສຶກສາທີ່ `status = 'inactive'` **ບໍ່ນັບ** ເປັນຜູ້ກິນບ່ອນ

---

## ຕົວຢ່າງ: ຫ້ອງກຳນົດ 4 ຄົນ

| ຈຳນວນຄົນ | `vacancy` | `isFull` | `label` | `statusText` | `rooms.status` | ຢູ່ໃນ `/rooms/available` |
|---|---|---|---|---|---|---|
| 0 | 4 | `false` | `0/4` | ຍັງຮັບໄດ້ອີກ 4 ຄົນ | `available` | ✅ |
| 1 | 3 | `false` | `1/4` | ຍັງຮັບໄດ້ອີກ 3 ຄົນ | `available` | ✅ |
| 2 | 2 | `false` | `2/4` | ຍັງຮັບໄດ້ອີກ 2 ຄົນ | `available` | ✅ |
| **3** | **1** | **`false`** | **`3/4`** | **ຍັງຮັບໄດ້ອີກ 1 ຄົນ** | `available` | ✅ |
| **4** | **0** | **`true`** | **`4/4`** | **ເຕັມແລ້ວ** | `occupied` | ❌ |
| ຄົນທີ 5 | — | — | — | ຖືກປະຕິເສດ **409 `ROOM_FULL`** | — | — |

`rooms.status` ປ່ຽນເປັນ `occupied` / `available` **ອັດຕະໂນມັດ** ທຸກເທື່ອທີ່ຈຳນວນຄົນປ່ຽນ — admin ບໍ່ຕ້ອງໄປຕັ້ງເອງ (ຍົກເວັ້ນ `maintenance` ທີ່ admin ຕັ້ງເອງ ແລະ ລະບົບຈະບໍ່ແຕະ)

---

## ຈຸດທີ່ມີການກວດ

| ການກະທຳ | Endpoint | ຜົນເມື່ອເຕັມ |
|---|---|---|
| ຈອງຫ້ອງ | `POST /api/bookings` | 409 `ROOM_FULL` |
| admin ເພີ່ມນັກສຶກສາເຂົ້າຫ້ອງ | `POST /api/students` | 409 `ROOM_FULL` |
| admin ຍ້າຍນັກສຶກສາເຂົ້າຫ້ອງ | `PUT /api/students/:id` | 409 `ROOM_FULL` |
| ເປີດ `inactive` → `active` ທີ່ຍັງຜູກກັບຫ້ອງເຕັມ | `PUT /api/students/:id` | 409 `ROOM_FULL` |
| ຫ້ອງຢູ່ສະຖານະສ້ອມແປງ | ທຸກທາງຂ້າງເທິງ | 409 `ROOM_UNDER_MAINTENANCE` |
| ຫຼຸດ `capacity` ຕ່ຳກວ່າຜູ້ພັກປັດຈຸບັນ | `PUT /api/rooms/:id` | 409 |
| ຕັ້ງ `capacity` ເກີນ 4 | `POST` / `PUT /api/rooms` | 400 `CAPACITY_LIMIT_EXCEEDED` |
| ລຶບຫ້ອງທີ່ຍັງມີຄົນຢູ່ | `DELETE /api/rooms/:id` | 409 |

**ການຈອງໃຊ້ transaction + `SELECT ... FOR UPDATE`** ລັອກແຖວຫ້ອງໄວ້ ເພື່ອກັນກໍລະນີສອງຄົນກົດຈອງບ່ອນສຸດທ້າຍພ້ອມກັນແລ້ວເຂົ້າໄດ້ທັງສອງ (race condition)

---

## ສິ່ງທີ່ API ສົ່ງກັບມາ

ທຸກ endpoint ທີ່ກ່ຽວກັບຫ້ອງສົ່ງ field ເຫຼົ່ານີ້ມາພ້ອມ — frontend ບໍ່ຕ້ອງຄຳນວນເອງ:

```jsonc
{
  "id": 6,
  "room_number": "A101",
  "building_name": "ຕຶກ A",
  "capacity": 4,
  "occupants": 3,          // ມີຄົນຢູ່ 3 ຄົນ
  "vacancy": 1,            // ຮັບໄດ້ອີກ 1 ຄົນ
  "isFull": false,
  "isAvailable": true,     // ບໍ່ເຕັມ ແລະ ບໍ່ໄດ້ສ້ອມແປງ → ຈອງໄດ້
  "label": "3/4",          // ເອົາໄປສະແດງໄດ້ເລີຍ
  "statusText": "ຍັງຮັບໄດ້ອີກ 1 ຄົນ",
  "status": "available"
}
```

`POST /api/bookings`, `POST /api/students`, `PUT /api/students/:id` ກໍສົ່ງ `room` ສະຫຼຸບກັບມານຳ ເພື່ອໃຫ້ອັບເດດໜ້າຈໍໄດ້ທັນທີໂດຍບໍ່ຕ້ອງຍິງ API ຊ້ຳ:

```jsonc
{
  "message": "ຈອງຫ້ອງສຳເລັດ",
  "data": { /* booking */ },
  "room": { "id": 6, "capacity": 4, "occupants": 4, "vacancy": 0, "isFull": true, "label": "4/4", "statusText": "ເຕັມແລ້ວ" }
}
```

---

## Endpoint ທີ່ກ່ຽວຂ້ອງ

| Method | Endpoint | ໃຊ້ເຮັດຫຍັງ |
|---|---|---|
| GET | `/api/rooms` | ທຸກຫ້ອງ + `summary` ລວມ (`totalBeds`, `totalOccupants`, `totalVacancy`, `fullRooms`) |
| GET | `/api/rooms?hasVacancy=true` | ສະເພາະຫ້ອງທີ່ຍັງຮັບໄດ້ |
| GET | `/api/rooms/available` | ຫ້ອງທີ່ຈອງໄດ້ + `totalVacancy` |
| GET | `/api/rooms/:id` | ຫ້ອງດຽວ ພ້ອມຂໍ້ມູນຄວາມຈຸ |
| GET | `/api/rooms/:id/occupants` | **ໃໝ່** — ລາຍຊື່ຜູ້ທີ່ພັກຢູ່ຫ້ອງນີ້ (student ເບິ່ງໄດ້ສະເພາະຫ້ອງຕົນ) |

## ຕົວຢ່າງໃຊ້ຢູ່ frontend

```jsx
{rooms.map((room) => (
  <div key={room.id} className={room.isFull ? "opacity-50" : ""}>
    <h3>{room.room_number} — {room.building_name}</h3>
    <span>{room.label}</span>
    <p>{room.statusText}</p>
    <button disabled={!room.isAvailable}>
      {room.isFull ? "ເຕັມແລ້ວ" : "ຈອງຫ້ອງນີ້"}
    </button>
  </div>
))}
```

ຈັດການ error ຕອນຈອງ:
```js
try {
  const { data } = await api.post("/api/bookings", { roomId, checkInDate });
  setRoom(data.room);           // ອັບເດດ 3/4 → 4/4 ທັນທີ
} catch (err) {
  const code = err.response?.data?.code;
  if (code === "ROOM_FULL") {
    // ມີຄົນຈອງຕັດໜ້າໄປ — ໂຫລດລາຍການຫ້ອງຄືນ
    alert(err.response.data.message);
    refreshRooms();
  }
}
```

---

## ທົດສອບ

```bash
node test-capacity.mjs
```
ທົດສອບ 20 ກໍລະນີ: ເພີ່ມຄົນທີ 1–4, ປະຕິເສດຄົນທີ 5 (ທັງທາງ student ແລະ booking), ຫ້ອງຫາຍຈາກ `/available`, ຍ້າຍຄົນອອກແລ້ວຮັບໄດ້ຄືນ, ຫຼຸດ `capacity`, ປະຕິເສດ `capacity` ເກີນ 4, ຫ້ອງສ້ອມແປງ
