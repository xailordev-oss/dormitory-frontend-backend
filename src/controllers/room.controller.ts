import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import {
  AppError,
  DEFAULT_ROOM_CAPACITY,
  MAX_ROOM_CAPACITY,
  OCCUPANTS_SUBQUERY,
  asyncHandler,
  ensureExists,
  getRoomOccupancy,
  isStaff,
  optionalEnum,
  paramId,
  parsePagination,
  requirePositiveInt,
  requirePositiveNumber,
  requireText,
  sendPage,
} from "../utils/helpers";

const ROOM_STATUSES = ["available", "occupied", "maintenance"] as const;

interface RoomRow extends RowDataPacket {
  id: number;
  room_number: string;
  building_id: number;
  capacity: number;
  price: number;
  status: (typeof ROOM_STATUSES)[number];
  occupants?: number;
}

// ທຸກ query ຂອງຫ້ອງຕິດຈຳນວນຜູ້ພັກປັດຈຸບັນມານຳສະເໝີ
const ROOM_SELECT = `
  SELECT r.*, b.name AS building_name,
         ${OCCUPANTS_SUBQUERY} AS occupants
    FROM rooms r
    LEFT JOIN buildings b ON b.id = r.building_id`;

/**
 * ເພີ່ມ field ທີ່ frontend ໃຊ້ສະແດງຜົນໄດ້ເລີຍ ໂດຍບໍ່ຕ້ອງຄຳນວນເອງ:
 *   occupants  = ມີຄົນຢູ່ເທົ່າໃດ
 *   vacancy    = ຍັງຮັບໄດ້ອີກເທົ່າໃດ
 *   isFull     = ເຕັມແລ້ວບໍ່
 *   isAvailable= ຍັງຈອງໄດ້ບໍ່ (ບໍ່ເຕັມ ແລະ ບໍ່ໄດ້ສ້ອມແປງ)
 *   label      = "3/4"
 *   statusText = ຂໍ້ຄວາມພາສາລາວພ້ອມສະແດງ
 */
const decorate = (rows: RoomRow[]) =>
  rows.map((r) => {
    const capacity = Number(r.capacity);
    const occupants = Number(r.occupants ?? 0);
    const vacancy = Math.max(0, capacity - occupants);
    const isFull = occupants >= capacity;
    const underMaintenance = r.status === "maintenance";

    return {
      ...r,
      capacity,
      occupants,
      vacancy,
      isFull,
      isAvailable: !isFull && !underMaintenance,
      label: `${occupants}/${capacity}`,
      statusText: underMaintenance
        ? "ກຳລັງສ້ອມແປງ"
        : isFull
        ? "ເຕັມແລ້ວ"
        : `ຍັງຮັບໄດ້ອີກ ${vacancy} ຄົນ`,
    };
  });

/* ---------------------------------------------------------
   GET /api/rooms
   ?buildingId= &status= &minPrice= &maxPrice= &hasVacancy=true &page= &limit=
   summary ຄຳນວນຈາກທຸກຫ້ອງທີ່ກົງເງື່ອນໄຂ (ບໍ່ແມ່ນສະເພາະໜ້າທີ່ສະແດງ)
   --------------------------------------------------------- */
export const getAllRooms = asyncHandler(async (req: Request, res: Response) => {
  const status = optionalEnum(req.query.status, ROOM_STATUSES, "status");
  const { buildingId, minPrice, maxPrice, hasVacancy } = req.query;
  const pg = parsePagination(req.query, { defaultLimit: 100, maxLimit: 500 });

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (buildingId) {
    where += " AND r.building_id = ?";
    params.push(requirePositiveInt(buildingId, "buildingId"));
  }
  if (status) {
    where += " AND r.status = ?";
    params.push(status);
  }
  if (minPrice) {
    where += " AND r.price >= ?";
    params.push(requirePositiveNumber(minPrice, "minPrice"));
  }
  if (maxPrice) {
    where += " AND r.price <= ?";
    params.push(requirePositiveNumber(maxPrice, "maxPrice"));
  }
  // ກັ່ນຕອງສະເພາະຫ້ອງທີ່ຍັງມີບ່ອນຫວ່າງ
  if (hasVacancy === "true") {
    where += ` AND r.status <> 'maintenance' AND ${OCCUPANTS_SUBQUERY} < r.capacity`;
  }

  const [[agg]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(t.capacity), 0) AS totalBeds,
            COALESCE(SUM(t.occupants), 0) AS totalOccupants,
            COALESCE(SUM(CASE WHEN t.status <> 'maintenance' THEN GREATEST(t.capacity - t.occupants, 0) ELSE 0 END), 0) AS totalVacancy,
            COALESCE(SUM(t.occupants >= t.capacity), 0) AS fullRooms
       FROM (SELECT r.capacity, r.status, ${OCCUPANTS_SUBQUERY} AS occupants
               FROM rooms r${where}) t`,
    params
  );

  const [rows] = await pool.query<RoomRow[]>(
    `${ROOM_SELECT}${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  const rooms = decorate(rows);

  return sendPage(
    res,
    rooms,
    Number(agg.total),
    pg,
    {
      // ສະຫຼຸບລວມ ສຳລັບສະແດງເທິງຫົວໜ້າຈໍ
      summary: {
        totalBeds: Number(agg.totalBeds),
        totalOccupants: Number(agg.totalOccupants),
        totalVacancy: Number(agg.totalVacancy),
        fullRooms: Number(agg.fullRooms),
      },
    },
    "rooms"
  );
});

/* ---------------------------------------------------------
   GET /api/rooms/available
   ຫ້ອງທີ່ຍັງຮັບຄົນເພີ່ມໄດ້ — ຄຳນວນຈາກຈຳນວນຜູ້ພັກຈິງ
   ບໍ່ໄດ້ເຊື່ອ column status ຢ່າງດຽວ
   --------------------------------------------------------- */
export const getAvailableRooms = asyncHandler(async (req: Request, res: Response) => {
  const pg = parsePagination(req.query, { defaultLimit: 100, maxLimit: 500 });
  const where = ` WHERE r.status <> 'maintenance' AND ${OCCUPANTS_SUBQUERY} < r.capacity`;

  const [[agg]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(t.capacity - t.occupants), 0) AS totalVacancy
       FROM (SELECT r.capacity, ${OCCUPANTS_SUBQUERY} AS occupants FROM rooms r${where}) t`
  );

  const [rows] = await pool.query<RoomRow[]>(
    `${ROOM_SELECT}${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [pg.limit, pg.offset]
  );
  const rooms = decorate(rows);

  return sendPage(res, rooms, Number(agg.total), pg, { totalVacancy: Number(agg.totalVacancy) }, "rooms");
});

/* ---------------------------------------------------------
   GET /api/rooms/:id
   --------------------------------------------------------- */
export const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<RoomRow[]>(`${ROOM_SELECT} WHERE r.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, "ບໍ່ພົບຫ້ອງ");
  }

  const room = decorate(rows)[0];
  return res.status(200).json({ data: room, room });
});

/* ---------------------------------------------------------
   GET /api/rooms/:id/occupants   (ໃໝ່)
   ລາຍຊື່ຜູ້ທີ່ພັກຢູ່ຫ້ອງນີ້ + ຈຳນວນບ່ອນຫວ່າງ
   ນັກສຶກສາເບິ່ງໄດ້ສະເພາະຫ້ອງຂອງຕົນ (ກັນການເບິ່ງລາຍຊື່ຫ້ອງຄົນອື່ນ)
   --------------------------------------------------------- */
export const getRoomOccupants = asyncHandler(async (req: any, res: Response) => {
  const id = paramId(req.params.id);
  const info = await getRoomOccupancy(id);

  if (!isStaff(req.user?.role)) {
    const [ownRows] = await pool.query<RowDataPacket[]>(
      "SELECT room_id FROM students WHERE user_id = ? LIMIT 1",
      [req.user?.id]
    );
    if (Number(ownRows[0]?.room_id) !== id) {
      throw new AppError(403, "ທ່ານເບິ່ງລາຍຊື່ຜູ້ພັກໄດ້ສະເພາະຫ້ອງຂອງຕົນເອງ");
    }
  }

  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, phone, avatar_url, status
       FROM students WHERE room_id = ? AND status = 'active' ORDER BY id`,
    [id]
  );

  return res.status(200).json({
    data: students,
    total: students.length,
    capacity: info.capacity,
    occupants: info.occupants,
    vacancy: info.vacancy,
    isFull: info.isFull,
    label: info.label,
    statusText: info.isFull ? "ເຕັມແລ້ວ" : `ຍັງຮັບໄດ້ອີກ ${info.vacancy} ຄົນ`,
  });
});

/* ---------------------------------------------------------
   POST /api/rooms  (admin ເທົ່ານັ້ນ)
   capacity ບໍ່ບັງຄັບ — ຖ້າບໍ່ສົ່ງມາ ໃຊ້ຄ່າມາດຕະຖານ 4 ຄົນຕໍ່ຫ້ອງ
   --------------------------------------------------------- */
export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const roomNumber = requireText(req.body?.roomNumber, "ເລກຫ້ອງ (roomNumber)", 50);
  const buildingId = requirePositiveInt(req.body?.buildingId, "buildingId");
  const price = requirePositiveNumber(req.body?.price, "price");
  const status = optionalEnum(req.body?.status, ROOM_STATUSES, "status") ?? "available";

  const capacity =
    req.body?.capacity === undefined || req.body?.capacity === null || req.body?.capacity === ""
      ? DEFAULT_ROOM_CAPACITY
      : requirePositiveInt(req.body.capacity, "capacity");

  if (capacity > MAX_ROOM_CAPACITY) {
    throw new AppError(
      400,
      `ກຳນົດຄວາມຈຸເກີນບໍ່ໄດ້ — ນະໂຍບາຍຂອງຫໍແມ່ນ 1 ຫ້ອງຢູ່ໄດ້ບໍ່ເກີນ ${MAX_ROOM_CAPACITY} ຄົນ ` +
        `(ທ່ານສົ່ງມາ ${capacity})`,
      "CAPACITY_LIMIT_EXCEEDED"
    );
  }

  await ensureExists("buildings", buildingId);

  const [existingRows] = await pool.query<RoomRow[]>(
    "SELECT id FROM rooms WHERE room_number = ? AND building_id = ? LIMIT 1",
    [roomNumber, buildingId]
  );
  if (existingRows.length > 0) {
    throw new AppError(409, "ເລກຫ້ອງນີ້ມີຢູ່ແລ້ວໃນຕຶກນີ້");
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO rooms (room_number, building_id, capacity, price, status) VALUES (?, ?, ?, ?, ?)",
    [roomNumber, buildingId, capacity, price, status]
  );

  const [rows] = await pool.query<RoomRow[]>(`${ROOM_SELECT} WHERE r.id = ?`, [result.insertId]);
  const room = decorate(rows)[0];

  return res.status(201).json({ message: "ເພີ່ມຫ້ອງສຳເລັດ", data: room, room });
});

/* ---------------------------------------------------------
   PUT /api/rooms/:id  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<RoomRow[]>(
    "SELECT * FROM rooms WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຫ້ອງ");
  }

  const roomNumber =
    req.body?.roomNumber !== undefined
      ? requireText(req.body.roomNumber, "ເລກຫ້ອງ (roomNumber)", 50)
      : existing.room_number;
  const buildingId =
    req.body?.buildingId !== undefined
      ? requirePositiveInt(req.body.buildingId, "buildingId")
      : existing.building_id;
  const capacity =
    req.body?.capacity !== undefined
      ? requirePositiveInt(req.body.capacity, "capacity")
      : Number(existing.capacity);
  const price =
    req.body?.price !== undefined
      ? requirePositiveNumber(req.body.price, "price")
      : existing.price;
  let status = optionalEnum(req.body?.status, ROOM_STATUSES, "status") ?? existing.status;

  if (capacity > MAX_ROOM_CAPACITY) {
    throw new AppError(
      400,
      `ກຳນົດຄວາມຈຸເກີນບໍ່ໄດ້ — ນະໂຍບາຍຂອງຫໍແມ່ນ 1 ຫ້ອງຢູ່ໄດ້ບໍ່ເກີນ ${MAX_ROOM_CAPACITY} ຄົນ ` +
        `(ທ່ານສົ່ງມາ ${capacity})`,
      "CAPACITY_LIMIT_EXCEEDED"
    );
  }
  if (buildingId !== existing.building_id) {
    await ensureExists("buildings", buildingId);
  }

  if (roomNumber !== existing.room_number || buildingId !== existing.building_id) {
    const [dupRows] = await pool.query<RoomRow[]>(
      "SELECT id FROM rooms WHERE room_number = ? AND building_id = ? AND id <> ? LIMIT 1",
      [roomNumber, buildingId, id]
    );
    if (dupRows.length > 0) {
      throw new AppError(409, "ເລກຫ້ອງນີ້ມີຢູ່ແລ້ວໃນຕຶກນີ້");
    }
  }

  // ຫຼຸດຄວາມຈຸຕ່ຳກວ່າຈຳນວນຜູ້ພັກປັດຈຸບັນບໍ່ໄດ້
  const info = await getRoomOccupancy(id);
  if (capacity < info.occupants) {
    throw new AppError(
      409,
      `ຫຼຸດຄວາມຈຸເປັນ ${capacity} ບໍ່ໄດ້ ຍ້ອນມີຜູ້ພັກຢູ່ແລ້ວ ${info.occupants} ຄົນ ` +
        `ກະລຸນາຍ້າຍຜູ້ພັກອອກກ່ອນ`
    );
  }

  // ຖ້າ admin ບໍ່ໄດ້ລະບຸ status ມາເອງ ໃຫ້ຄຳນວນຈາກຄວາມຈຸໃໝ່
  if (req.body?.status === undefined && existing.status !== "maintenance") {
    status = info.occupants >= capacity ? "occupied" : "available";
  }

  await pool.query(
    "UPDATE rooms SET room_number = ?, building_id = ?, capacity = ?, price = ?, status = ? WHERE id = ?",
    [roomNumber, buildingId, capacity, price, status, id]
  );

  const [rows] = await pool.query<RoomRow[]>(`${ROOM_SELECT} WHERE r.id = ?`, [id]);
  const room = decorate(rows)[0];
  return res.status(200).json({ message: "ອັບເດດຫ້ອງສຳເລັດ", data: room, room });
});

/* ---------------------------------------------------------
   DELETE /api/rooms/:id  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<RoomRow[]>(
    "SELECT * FROM rooms WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຫ້ອງ");
  }

  const info = await getRoomOccupancy(id);
  if (info.occupants > 0) {
    throw new AppError(
      409,
      `ລຶບຫ້ອງນີ້ບໍ່ໄດ້ ຍ້ອນຍັງມີຜູ້ພັກຢູ່ ${info.occupants} ຄົນ ກະລຸນາຍ້າຍອອກ/check-out ກ່ອນ`
    );
  }

  const [activeRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM bookings WHERE room_id = ? AND status IN ('pending','active')",
    [id]
  );
  const activeCount = Number(activeRows[0]?.total ?? 0);
  if (activeCount > 0) {
    throw new AppError(
      409,
      `ລຶບຫ້ອງນີ້ບໍ່ໄດ້ ຍ້ອນຍັງມີການຈອງທີ່ໃຊ້ງານຢູ່ ${activeCount} ລາຍການ`
    );
  }

  const [historyRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM bookings WHERE room_id = ?",
    [id]
  );
  const historyCount = Number(historyRows[0]?.total ?? 0);
  if (historyCount > 0 && req.query.force !== "true") {
    throw new AppError(
      409,
      `ຫ້ອງນີ້ມີປະຫວັດການຈອງ ${historyCount} ລາຍການ ເຊິ່ງຈະຖືກລຶບໄປນຳ. ` +
        `ຖ້າແນ່ໃຈ ໃຫ້ເອີ້ນ DELETE /api/rooms/${id}?force=true`
    );
  }

  await pool.query("UPDATE students SET room_id = NULL WHERE room_id = ?", [id]);
  await pool.query("DELETE FROM rooms WHERE id = ?", [id]);
  await pool.query("DELETE FROM images WHERE entity_type = 'room' AND entity_id = ?", [id]);

  return res.status(200).json({ message: "ລຶບຫ້ອງສຳເລັດ", data: existing });
});
