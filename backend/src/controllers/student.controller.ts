import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import {
  AppError,
  asyncHandler,
  assertRoomHasSpace,
  ensureExists,
  getRoomOccupancy,
  normalizeEmail,
  optionalEnum,
  optionalText,
  paramId,
  parsePagination,
  requirePositiveInt,
  requireText,
  sendPage,
  syncRoomStatus,
} from "../utils/helpers";

const STUDENT_STATUSES = ["active", "inactive"] as const;

interface StudentRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  room_id: number | null;
  status: (typeof STUDENT_STATUSES)[number];
}

/** ສະພາບຫ້ອງແບບພ້ອມສະແດງ — ສົ່ງກັບໄປໃຫ້ frontend ອັບເດດໜ້າຈໍໄດ້ທັນທີ */
const roomSummary = async (roomId: number) => {
  const info = await getRoomOccupancy(roomId);
  return {
    id: info.roomId,
    capacity: info.capacity,
    occupants: info.occupants,
    vacancy: info.vacancy,
    isFull: info.isFull,
    label: info.label,
    statusText: info.isFull ? "ເຕັມແລ້ວ" : `ຍັງຮັບໄດ້ອີກ ${info.vacancy} ຄົນ`,
  };
};

const STUDENT_SELECT = `
  SELECT s.*, r.room_number, r.capacity AS room_capacity, b.name AS building_name
    FROM students s
    LEFT JOIN rooms r ON r.id = s.room_id
    LEFT JOIN buildings b ON b.id = r.building_id`;

/* ---------------------------------------------------------
   GET /api/students  (admin / staff)  ?search= &status= &roomId= &page= &limit=
   --------------------------------------------------------- */
export const getAllStudents = asyncHandler(async (req: Request, res: Response) => {
  const status = optionalEnum(req.query.status, STUDENT_STATUSES, "status");
  const { search, roomId, unlinked } = req.query;
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (search) {
    where += " AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)";
    const like = `%${String(search).trim()}%`;
    params.push(like, like, like);
  }
  if (status) {
    where += " AND s.status = ?";
    params.push(status);
  }
  if (roomId) {
    where += " AND s.room_id = ?";
    params.push(requirePositiveInt(roomId, "roomId"));
  }
  // ?unlinked=true → ສະເພາະນັກສຶກສາທີ່ຍັງບໍ່ໄດ້ຜູກກັບບັນຊີ login
  if (unlinked === "true") {
    where += " AND s.user_id IS NULL";
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM students s${where}`,
    params
  );
  const [students] = await pool.query<StudentRow[]>(
    `${STUDENT_SELECT}${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return sendPage(res, students, Number(countRow.total), pg, {}, "students");
});

/* GET /api/students/:id  (admin) */
export const getStudentById = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<StudentRow[]>(`${STUDENT_SELECT} WHERE s.id = ? LIMIT 1`, [id]);
  const student = rows[0];
  if (!student) {
    throw new AppError(404, "ບໍ່ພົບນັກສຶກສາ");
  }

  return res.status(200).json({ data: student, student });
});

/* ---------------------------------------------------------
   POST /api/students  (admin)
   ຖ້າລະບຸ roomId ມາ = ຜູກເຂົ້າຫ້ອງເລີຍ ຈຶ່ງຕ້ອງກວດຄວາມຈຸຄືກັນກັບການຈອງ
   ບໍ່ດັ່ງນັ້ນ admin ຈະໃສ່ຄົນທີ 5 ເຂົ້າຫ້ອງ 4 ຄົນໄດ້ໂດຍຂ້າມການກວດໄປ
   --------------------------------------------------------- */
export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const name = requireText(req.body?.name, "ຊື່", 150);
  const email = normalizeEmail(req.body?.email);
  const phone = optionalText(req.body?.phone, 30);
  const status = optionalEnum(req.body?.status, STUDENT_STATUSES, "status") ?? "active";

  const roomId =
    req.body?.roomId !== undefined && req.body?.roomId !== null && req.body?.roomId !== ""
      ? requirePositiveInt(req.body.roomId, "roomId")
      : null;
  const userId =
    req.body?.userId !== undefined && req.body?.userId !== null && req.body?.userId !== ""
      ? requirePositiveInt(req.body.userId, "userId")
      : null;

  const [existingRows] = await pool.query<StudentRow[]>(
    "SELECT id FROM students WHERE email = ? LIMIT 1",
    [email]
  );
  if (existingRows.length > 0) {
    throw new AppError(409, "ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
  }

  if (roomId) {
    // ນັກສຶກສາ inactive ບໍ່ນັບເປັນຜູ້ກິນບ່ອນ ຈຶ່ງກວດສະເພາະ active
    if (status === "active") {
      await assertRoomHasSpace(roomId);
    } else {
      await ensureExists("rooms", roomId);
    }
  }

  if (userId) {
    await ensureExists("users", userId);
    const [linkedRows] = await pool.query<StudentRow[]>(
      "SELECT id FROM students WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (linkedRows.length > 0) {
      throw new AppError(409, "ບັນຊີນີ້ຖືກເຊື່ອມກັບນັກສຶກສາຄົນອື່ນແລ້ວ");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO students (name, email, phone, room_id, status, user_id) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, phone, roomId, status, userId]
  );

  await syncRoomStatus(roomId);

  const [rows] = await pool.query<StudentRow[]>("SELECT * FROM students WHERE id = ?", [
    result.insertId,
  ]);

  return res.status(201).json({
    message: "ເພີ່ມນັກສຶກສາສຳເລັດ",
    data: rows[0],
    student: rows[0],
    ...(roomId ? { room: await roomSummary(roomId) } : {}),
  });
});

/* ---------------------------------------------------------
   PUT /api/students/:id  (admin) — ແກ້ userId ໄດ້ ເພື່ອຜູກ/ຖອນບັນຊີ login
   --------------------------------------------------------- */
export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<StudentRow[]>(
    "SELECT * FROM students WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບນັກສຶກສາ");
  }

  const name =
    req.body?.name !== undefined ? requireText(req.body.name, "ຊື່", 150) : existing.name;
  const email =
    req.body?.email !== undefined ? normalizeEmail(req.body.email) : existing.email;
  const phone =
    req.body?.phone !== undefined ? optionalText(req.body.phone, 30) : existing.phone;
  const status = optionalEnum(req.body?.status, STUDENT_STATUSES, "status") ?? existing.status;

  // ຜູກ / ຖອນການຜູກບັນຊີ login (userId: null = ຖອນ)
  let userId = existing.user_id;
  if (req.body?.userId !== undefined) {
    userId =
      req.body.userId === null || req.body.userId === ""
        ? null
        : requirePositiveInt(req.body.userId, "userId");
    if (userId !== null && userId !== existing.user_id) {
      await ensureExists("users", userId);
      const [linkedRows] = await pool.query<StudentRow[]>(
        "SELECT id FROM students WHERE user_id = ? AND id <> ? LIMIT 1",
        [userId, id]
      );
      if (linkedRows.length > 0) {
        throw new AppError(409, "ບັນຊີນີ້ຖືກເຊື່ອມກັບນັກສຶກສາຄົນອື່ນແລ້ວ");
      }
    }
  }

  let roomId = existing.room_id;
  if (req.body?.roomId !== undefined) {
    roomId =
      req.body.roomId === null || req.body.roomId === ""
        ? null
        : requirePositiveInt(req.body.roomId, "roomId");
  }

  if (email !== existing.email) {
    const [dupRows] = await pool.query<StudentRow[]>(
      "SELECT id FROM students WHERE email = ? AND id <> ? LIMIT 1",
      [email, id]
    );
    if (dupRows.length > 0) {
      throw new AppError(409, "ອີເມວນີ້ຖືກໃຊ້ໂດຍນັກສຶກສາຄົນອື່ນແລ້ວ");
    }
  }

  if (roomId !== existing.room_id) {
    // ມີການຈອງທີ່ຍັງໃຊ້ງານຢູ່ → ຫ້າມຍ້າຍຫ້ອງມືໆ ເພາະການຈອງກັບຫ້ອງຈິງຈະຂັດກັນ
    const [bkRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, room_id FROM bookings WHERE student_id = ? AND status IN ('pending','active') LIMIT 1",
      [id]
    );
    if (bkRows.length > 0 && Number(bkRows[0].room_id) !== roomId) {
      throw new AppError(
        409,
        `ນັກສຶກສາຄົນນີ້ມີການຈອງທີ່ຍັງໃຊ້ງານຢູ່ (booking id ${bkRows[0].id}) ` +
          `ກະລຸນາ check-out ຫຼື ແກ້ໄຂການຈອງນັ້ນກ່ອນຈຶ່ງຍ້າຍຫ້ອງໄດ້`
      );
    }

    if (roomId) {
      if (status === "active") {
        await assertRoomHasSpace(roomId, undefined, { excludeStudentId: id });
      } else {
        await ensureExists("rooms", roomId);
      }
    }
  } else if (roomId && status === "active" && existing.status !== "active") {
    // ປ່ຽນຈາກ inactive ກັບມາ active ໃນຂະນະທີ່ຍັງຜູກກັບຫ້ອງເກົ່າ = ກິນບ່ອນເພີ່ມ
    await assertRoomHasSpace(roomId, undefined, { excludeStudentId: id });
  }

  await pool.query(
    "UPDATE students SET name = ?, email = ?, phone = ?, room_id = ?, status = ?, user_id = ? WHERE id = ?",
    [name, email, phone, roomId, status, userId, id]
  );

  // ຄວາມຈຸອາດປ່ຽນທັງສອງຫ້ອງ ຈຶ່ງຄຳນວນ status ຄືນທັງສອງບ່ອນ
  await syncRoomStatus(existing.room_id);
  if (roomId !== existing.room_id) await syncRoomStatus(roomId);

  const [rows] = await pool.query<StudentRow[]>("SELECT * FROM students WHERE id = ?", [id]);
  return res.status(200).json({
    message: "ອັບເດດຂໍ້ມູນສຳເລັດ",
    data: rows[0],
    student: rows[0],
    ...(roomId ? { room: await roomSummary(roomId) } : {}),
  });
});

/* ---------------------------------------------------------
   DELETE /api/students/:id  (admin)
   --------------------------------------------------------- */
export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<StudentRow[]>(
    "SELECT * FROM students WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບນັກສຶກສາ");
  }

  const [activeRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM bookings WHERE student_id = ? AND status IN ('pending','active')",
    [id]
  );
  if (Number(activeRows[0]?.total ?? 0) > 0) {
    throw new AppError(
      409,
      "ລຶບນັກສຶກສາຄົນນີ້ບໍ່ໄດ້ ຍ້ອນຍັງມີການຈອງທີ່ໃຊ້ງານຢູ່ ກະລຸນາ check-out ກ່ອນ"
    );
  }

  const [payRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM payments WHERE student_id = ?",
    [id]
  );
  const payCount = Number(payRows[0]?.total ?? 0);
  if (payCount > 0 && req.query.force !== "true") {
    throw new AppError(
      409,
      `ນັກສຶກສາຄົນນີ້ມີປະຫວັດການຊຳລະ ${payCount} ລາຍການ ເຊິ່ງຈະຖືກລຶບໄປນຳ. ` +
        `ແນະນຳໃຫ້ປ່ຽນ status ເປັນ "inactive" ແທນ. ຖ້າຕ້ອງການລຶບແທ້ ໃຫ້ໃຊ້ ?force=true`
    );
  }

  await pool.query("DELETE FROM images WHERE entity_type = 'student' AND entity_id = ?", [id]);
  await pool.query("DELETE FROM students WHERE id = ?", [id]);

  // ຄົນອອກໄປແລ້ວ ຫ້ອງອາດຈະວ່າງຄືນ
  await syncRoomStatus(existing.room_id);

  return res.status(200).json({ message: "ລຶບນັກສຶກສາສຳເລັດ", data: existing });
});
