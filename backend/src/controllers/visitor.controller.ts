import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import {
  AppError,
  asyncHandler,
  ensureExists,
  optionalEnum,
  optionalText,
  parsePagination,
  requirePositiveInt,
  requireText,
  sendPage,
} from "../utils/helpers";

const VISITOR_STATUSES = ["checked_in", "checked_out"] as const;

interface VisitorLogRow extends RowDataPacket {
  id: number;
  visitor_name: string;
  id_card_number: string | null;
  phone: string | null;
  purpose: string | null;
  student_id: number | null;
  room_id: number | null;
  check_in_time: string;
  check_out_time: string | null;
  status: (typeof VISITOR_STATUSES)[number];
}

/* ---------------------------------------------------------
   POST /api/visitors/check-in  (admin / ພະນັກງານໜ້າຫໍ)
   ແກ້: studentId / roomId ທີ່ບໍ່ມີຢູ່ → ເຄີຍເປັນ 500 ຈາກ FK
        ຖ້າລະບຸ studentId ແຕ່ບໍ່ລະບຸ roomId → ຕື່ມຫ້ອງຂອງນັກສຶກສາໃຫ້ເອງ
   --------------------------------------------------------- */
export const checkInVisitor = asyncHandler(async (req: Request, res: Response) => {
  const visitorName = requireText(req.body?.visitorName, "ຊື່ຜູ້ມາຢ້ຽມ (visitorName)", 150);
  const idCardNumber = optionalText(req.body?.idCardNumber, 50);
  const phone = optionalText(req.body?.phone, 30);
  const purpose = optionalText(req.body?.purpose, 255);

  let studentId: number | null = null;
  if (req.body?.studentId !== undefined && req.body?.studentId !== null && req.body?.studentId !== "") {
    studentId = requirePositiveInt(req.body.studentId, "studentId");
    await ensureExists("students", studentId);
  }

  let roomId: number | null = null;
  if (req.body?.roomId !== undefined && req.body?.roomId !== null && req.body?.roomId !== "") {
    roomId = requirePositiveInt(req.body.roomId, "roomId");
    await ensureExists("rooms", roomId);
  } else if (studentId) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT room_id FROM students WHERE id = ? LIMIT 1",
      [studentId]
    );
    roomId = (rows[0]?.room_id as number) ?? null;
  }

  // ກັນບັນທຶກຊ້ຳ: ແຂກຄົນດຽວກັນທີ່ຍັງ check-in ຄ້າງຢູ່ ບໍ່ໃຫ້ເພີ່ມອີກ
  if (idCardNumber) {
    const [openRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM visitor_logs WHERE id_card_number = ? AND status = 'checked_in' LIMIT 1",
      [idCardNumber]
    );
    if (openRows.length > 0) {
      throw new AppError(
        409,
        `ແຂກຄົນນີ້ຍັງ check-in ຄ້າງຢູ່ (log id = ${openRows[0].id}) ກະລຸນາ check-out ກ່ອນ`
      );
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO visitor_logs
      (visitor_name, id_card_number, phone, purpose, student_id, room_id, check_in_time, status)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 'checked_in')`,
    [visitorName, idCardNumber, phone, purpose, studentId, roomId]
  );

  const [rows] = await pool.query<VisitorLogRow[]>("SELECT * FROM visitor_logs WHERE id = ?", [
    result.insertId,
  ]);

  return res.status(201).json({ message: "ບັນທຶກ check-in ສຳເລັດ", data: rows[0] });
});

/* ---------------------------------------------------------
   POST /api/visitors/check-out  (admin / ພະນັກງານໜ້າຫໍ)
   --------------------------------------------------------- */
export const checkOutVisitor = asyncHandler(async (req: Request, res: Response) => {
  const id = requirePositiveInt(req.body?.id, "id");

  const [existingRows] = await pool.query<VisitorLogRow[]>(
    "SELECT * FROM visitor_logs WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບບັນທຶກຜູ້ມາຢ້ຽມ");
  }
  if (existing.status === "checked_out") {
    throw new AppError(400, "ແຂກຄົນນີ້ check-out ໄປແລ້ວ");
  }

  await pool.query(
    "UPDATE visitor_logs SET status = 'checked_out', check_out_time = NOW() WHERE id = ?",
    [id]
  );

  const [rows] = await pool.query<VisitorLogRow[]>("SELECT * FROM visitor_logs WHERE id = ?", [id]);
  return res.status(200).json({ message: "ບັນທຶກ check-out ສຳເລັດ", data: rows[0] });
});

/* ---------------------------------------------------------
   GET /api/visitors/logs  (admin / staff)
   ?status= &studentId= &roomId= &from= &to=
   --------------------------------------------------------- */
export const getVisitorLogs = asyncHandler(async (req: Request, res: Response) => {
  const status = optionalEnum(req.query.status, VISITOR_STATUSES, "status");
  const { studentId, roomId, from, to } = req.query;
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (status) {
    where += " AND v.status = ?";
    params.push(status);
  }
  if (studentId) {
    where += " AND v.student_id = ?";
    params.push(requirePositiveInt(studentId, "studentId"));
  }
  if (roomId) {
    where += " AND v.room_id = ?";
    params.push(requirePositiveInt(roomId, "roomId"));
  }
  // ໃຊ້ DATE() ເພື່ອໃຫ້ວັນສຸດທ້າຍຖືກນັບລວມ (ເບິ່ງຄຳອະທິບາຍໃນ reports.controller)
  if (from) {
    where += " AND DATE(v.check_in_time) >= ?";
    params.push(String(from));
  }
  if (to) {
    where += " AND DATE(v.check_in_time) <= ?";
    params.push(String(to));
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM visitor_logs v${where}`,
    params
  );
  const [result] = await pool.query<VisitorLogRow[]>(
    `SELECT v.*, s.name AS student_name, r.room_number
       FROM visitor_logs v
       LEFT JOIN students s ON s.id = v.student_id
       LEFT JOIN rooms r ON r.id = v.room_id
       ${where}
      ORDER BY v.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return sendPage(res, result, Number(countRow.total), pg);
});
