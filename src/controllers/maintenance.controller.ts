import { Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  AppError,
  asyncHandler,
  ensureExists,
  getOwnStudentId,
  isStaff,
  optionalEnum,
  paramId,
  parsePagination,
  requireEnum,
  requirePositiveInt,
  requireText,
  sendPage,
  syncRoomStatus,
} from "../utils/helpers";
import { notifyStudent } from "../utils/notify";

const STATUSES = ["pending", "in_progress", "resolved", "cancelled"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

interface MaintenanceRow extends RowDataPacket {
  id: number;
  room_id: number;
  reported_by: number | null;
  issue: string;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
}

/* ---------------------------------------------------------
   GET /api/maintenance
   ແກ້ຊ່ອງໂຫວ່: ຂອງເກົ່າບໍ່ກັ່ນຕອງຕາມ role ເລີຍ
   ນັກສຶກສາຈຶ່ງເຫັນລາຍການແຈ້ງສ້ອມຂອງທຸກຫ້ອງໃນຫໍ
   ດຽວນີ້ນັກສຶກສາເຫັນສະເພາະ: ທີ່ຕົນແຈ້ງເອງ + ຂອງຫ້ອງທີ່ຕົນພັກຢູ່
   --------------------------------------------------------- */
export const getAllMaintenances = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = optionalEnum(req.query.status, STATUSES, "status");
  const priority = optionalEnum(req.query.priority, PRIORITIES, "priority");
  const { roomId } = req.query;
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (!isStaff(req.user?.role)) {
    const ownStudentId = await getOwnStudentId(Number(req.user?.id));
    if (!ownStudentId) {
      return sendPage(res, [], 0, pg);
    }
    where += ` AND (m.reported_by = ?
                  OR m.room_id = (SELECT room_id FROM students WHERE id = ?))`;
    params.push(ownStudentId, ownStudentId);
  }

  if (status) {
    where += " AND m.status = ?";
    params.push(status);
  }
  if (roomId) {
    where += " AND m.room_id = ?";
    params.push(requirePositiveInt(roomId, "roomId"));
  }
  if (priority) {
    where += " AND m.priority = ?";
    params.push(priority);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM maintenance_requests m${where}`,
    params
  );

  // ຮຽງຕາມຄວາມດ່ວນກ່ອນ ແລ້ວຈຶ່ງຕາມເວລາ — ໃຫ້ພະນັກງານເຫັນວຽກດ່ວນເທິງສຸດ
  const [result] = await pool.query<MaintenanceRow[]>(
    `SELECT m.*, r.room_number, s.name AS reporter_name
       FROM maintenance_requests m
       LEFT JOIN rooms r ON r.id = m.room_id
       LEFT JOIN students s ON s.id = m.reported_by
       ${where}
      ORDER BY FIELD(m.priority,'urgent','high','medium','low'), m.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return sendPage(res, result, Number(countRow.total), pg);
});

/* ---------------------------------------------------------
   POST /api/maintenance
   ແກ້ຊ່ອງໂຫວ່: ນັກສຶກສາເຄີຍຕັ້ງ reportedBy ເປັນ id ຂອງຄົນອື່ນໄດ້
   ດຽວນີ້ບັງຄັບໃຊ້ id ຂອງຜູ້ທີ່ login ຢູ່ (admin ເທົ່ານັ້ນທີ່ລະບຸແທນໄດ້)
   --------------------------------------------------------- */
export const createMaintenance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const roomId = requirePositiveInt(req.body?.roomId, "roomId");
  const issue = requireText(req.body?.issue, "ລາຍລະອຽດບັນຫາ (issue)", 500);
  const priority = optionalEnum(req.body?.priority, PRIORITIES, "priority") ?? "medium";

  await ensureExists("rooms", roomId);

  let reportedBy: number | null;
  if (isStaff(req.user?.role)) {
    // admin/staff ແຈ້ງແທນນັກສຶກສາໄດ້ ຫຼື ຈະບໍ່ລະບຸກໍໄດ້ (ພະນັກງານແຈ້ງເອງ)
    reportedBy =
      req.body?.reportedBy !== undefined && req.body?.reportedBy !== null
        ? requirePositiveInt(req.body.reportedBy, "reportedBy")
        : null;
    if (reportedBy) await ensureExists("students", reportedBy);
  } else {
    const own = await getOwnStudentId(Number(req.user?.id));
    if (!own) {
      throw new AppError(
        403,
        "ບັນຊີນີ້ຍັງບໍ່ໄດ້ຖືກເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ"
      );
    }
    if (req.body?.reportedBy !== undefined && Number(req.body.reportedBy) !== own) {
      throw new AppError(403, "ທ່ານແຈ້ງສ້ອມແປງໄດ້ໃນນາມຂອງຕົນເອງເທົ່ານັ້ນ");
    }
    reportedBy = own;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO maintenance_requests (room_id, reported_by, issue, priority, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [roomId, reportedBy, issue, priority]
  );

  const [rows] = await pool.query<MaintenanceRow[]>(
    "SELECT * FROM maintenance_requests WHERE id = ?",
    [result.insertId]
  );

  return res.status(201).json({ message: "ແຈ້ງສ້ອມແປງສຳເລັດ", data: rows[0] });
});

/* ---------------------------------------------------------
   PUT /api/maintenance/:id/status  (admin / staff)
   ເມື່ອຕັ້ງເປັນ in_progress ໃຫ້ປ່ຽນຫ້ອງເປັນ maintenance
   ແລະ ເມື່ອປິດວຽກແລ້ວໃຫ້ປ່ອຍຫ້ອງກັບຄືນ
   --------------------------------------------------------- */
export const updateMaintenanceStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const status = requireEnum(req.body?.status, STATUSES, "status");

  const [existingRows] = await pool.query<MaintenanceRow[]>(
    "SELECT * FROM maintenance_requests WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບລາຍການແຈ້ງສ້ອມແປງ");
  }

  await pool.query("UPDATE maintenance_requests SET status = ? WHERE id = ?", [status, id]);

  if (status === "in_progress") {
    await pool.query("UPDATE rooms SET status = 'maintenance' WHERE id = ?", [existing.room_id]);
  } else if (status === "resolved" || status === "cancelled") {
    // ປ່ອຍຫ້ອງຄືນ ສະເພາະເມື່ອບໍ່ມີວຽກສ້ອມແປງອື່ນຄ້າງຢູ່ແລ້ວ
    const [openRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS open FROM maintenance_requests
        WHERE room_id = ? AND status = 'in_progress' AND id <> ?`,
      [existing.room_id, id]
    );
    if (Number(openRows[0]?.open ?? 0) === 0) {
      // ແກ້ບັກ: ເມື່ອກ່ອນຕັ້ງເປັນ 'available' ສະເໝີ ເຖິງແມ່ນຫ້ອງຈະເຕັມຢູ່
      // ຕອນນີ້ປົດຈາກ maintenance ແລ້ວຄຳນວນ occupied/available ຈາກຈຳນວນຜູ້ພັກຈິງ
      await pool.query(
        "UPDATE rooms SET status = 'available' WHERE id = ? AND status = 'maintenance'",
        [existing.room_id]
      );
      await syncRoomStatus(existing.room_id);
    }
  }

  if (existing.status !== status) {
    const label: Record<string, string> = {
      pending: "ລໍຖ້າດຳເນີນການ",
      in_progress: "ກຳລັງສ້ອມແປງ",
      resolved: "ສ້ອມແປງສຳເລັດແລ້ວ",
      cancelled: "ຍົກເລີກ",
    };
    void notifyStudent(existing.reported_by, {
      title: "ອັບເດດການແຈ້ງສ້ອມແປງ",
      message: `ເລື່ອງ "${existing.issue.slice(0, 80)}" ປ່ຽນສະຖານະເປັນ: ${label[status]}`,
      type: "maintenance",
    });
  }

  const [rows] = await pool.query<MaintenanceRow[]>(
    "SELECT * FROM maintenance_requests WHERE id = ?",
    [id]
  );
  return res.status(200).json({ message: "ອັບເດດສະຖານະສຳເລັດ", data: rows[0] });
});

/* ---------------------------------------------------------
   DELETE /api/maintenance/:id  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const deleteMaintenance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<MaintenanceRow[]>(
    "SELECT * FROM maintenance_requests WHERE id = ? LIMIT 1",
    [id]
  );
  const deleted = rows[0];
  if (!deleted) {
    throw new AppError(404, "ບໍ່ພົບລາຍການແຈ້ງສ້ອມແປງ");
  }

  await pool.query("DELETE FROM maintenance_requests WHERE id = ?", [id]);
  return res.status(200).json({ message: "ລຶບລາຍການແຈ້ງສ້ອມແປງສຳເລັດ", data: deleted });
});
