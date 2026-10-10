import { Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import { isMailEnabled } from "../config/env";
import { sendMailBatch } from "../config/mailer";
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
  requirePositiveInt,
  requireText,
  sendPage,
} from "../utils/helpers";
import { buildMail } from "../utils/notify";

const TYPES = ["info", "warning", "urgent", "payment", "maintenance"] as const;

interface NotificationRow extends RowDataPacket {
  id: number;
  title: string;
  message: string;
  type: (typeof TYPES)[number];
  student_id: number | null;
  is_read: number;
}

/* ---------------------------------------------------------
   ສະຖານະ "ອ່ານແລ້ວ" ຂອງນັກສຶກສາແຕ່ລະຄົນ
   - ແຈ້ງການສ່ວນຕົວ (student_id ມີຄ່າ) → ໃຊ້ notifications.is_read
   - ແຈ້ງການລວມ (student_id IS NULL)     → ໃຊ້ຕາຕະລາງ notification_reads ແຍກຕາມຄົນ
     (ແກ້ບັກເກົ່າ: ນັກສຶກສາຄົນໜຶ່ງກົດອ່ານ ທຸກຄົນກໍກາຍເປັນອ່ານແລ້ວ)
   --------------------------------------------------------- */
const READ_EXPR = `CASE WHEN n.student_id IS NULL THEN (nr.student_id IS NOT NULL) ELSE n.is_read END`;

/* ---------------------------------------------------------
   GET /api/notifications  ?type= &isRead= &studentId=(staff) &page= &limit=
   ນັກສຶກສາເຫັນສະເພາະ: ຂອງຕົນເອງ + ແຈ້ງການລວມ (student_id IS NULL)
   admin/staff ເຫັນທັງໝົດ
   ຕອບ unread = ຈຳນວນທີ່ຍັງບໍ່ໄດ້ອ່ານທັງໝົດ (ບໍ່ແມ່ນສະເພາະໜ້ານີ້)
   --------------------------------------------------------- */
export const getAllNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = optionalEnum(req.query.type, TYPES, "type");
  const { studentId, isRead } = req.query;
  const pg = parsePagination(req.query);

  const staff = isStaff(req.user?.role);
  const ownStudentId = staff ? null : await getOwnStudentId(Number(req.user?.id));

  // join ຕາຕະລາງ "ອ່ານແລ້ວ" ສະເພາະຂອງນັກສຶກສາຄົນນີ້
  const fromSql = `FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.student_id = ?`;
  const joinParam = ownStudentId ?? 0;

  let scope = " WHERE 1=1";
  const scopeParams: any[] = [];
  if (!staff) {
    if (ownStudentId) {
      scope += " AND (n.student_id = ? OR n.student_id IS NULL)";
      scopeParams.push(ownStudentId);
    } else {
      // ບັນຊີທີ່ຍັງບໍ່ຜູກກັບນັກສຶກສາ → ເຫັນສະເພາະແຈ້ງການລວມ
      scope += " AND n.student_id IS NULL";
    }
  } else if (studentId) {
    scope += " AND n.student_id = ?";
    scopeParams.push(requirePositiveInt(studentId, "studentId"));
  }

  let filters = "";
  const filterParams: any[] = [];
  if (type) {
    filters += " AND n.type = ?";
    filterParams.push(type);
  }
  if (isRead !== undefined) {
    filters += ` AND (${READ_EXPR}) = ?`;
    filterParams.push(isRead === "true" || isRead === "1" ? 1 : 0);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total ${fromSql}${scope}${filters}`,
    [joinParam, ...scopeParams, ...filterParams]
  );
  const [[unreadRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread ${fromSql}${scope} AND (${READ_EXPR}) = 0`,
    [joinParam, ...scopeParams]
  );
  const [result] = await pool.query<NotificationRow[]>(
    `SELECT n.id, n.title, n.message, n.type, n.student_id, n.created_at, n.updated_at,
            (${READ_EXPR}) AS is_read
       ${fromSql}${scope}${filters}
      ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    [joinParam, ...scopeParams, ...filterParams, pg.limit, pg.offset]
  );

  return sendPage(res, result, Number(countRow.total), pg, { unread: Number(unreadRow.unread) });
});

/* ---------------------------------------------------------
   POST /api/notifications  (admin / staff)
   ບໍ່ລະບຸ studentId = ແຈ້ງການລວມທີ່ທຸກຄົນເຫັນ
   ອີເມວ (ເມື່ອຕັ້ງ SMTP ໄວ້):
     - ສ່ວນຕົວ  → ສົ່ງອີເມວໃຫ້ນັກສຶກສາຄົນນັ້ນ (ປິດໄດ້ດ້ວຍ sendEmail: false)
     - ແຈ້ງລວມ  → ສົ່ງເມື່ອລະບຸ sendEmail: true ເທົ່ານັ້ນ (ສົ່ງຫານັກສຶກສາ active ທຸກຄົນ)
   --------------------------------------------------------- */
export const createNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const title = requireText(req.body?.title, "title", 200);
  const message = requireText(req.body?.message, "message", 1000);
  const type = optionalEnum(req.body?.type, TYPES, "type") ?? "info";
  const sendEmail = req.body?.sendEmail;

  let studentId: number | null = null;
  if (req.body?.studentId !== undefined && req.body?.studentId !== null && req.body?.studentId !== "") {
    studentId = requirePositiveInt(req.body.studentId, "studentId");
    await ensureExists("students", studentId);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (title, message, type, student_id, is_read)
     VALUES (?, ?, ?, ?, FALSE)`,
    [title, message, type, studentId]
  );

  const [rows] = await pool.query<NotificationRow[]>(
    "SELECT * FROM notifications WHERE id = ?",
    [result.insertId]
  );

  let emailQueued = false;
  if (isMailEnabled()) {
    if (studentId && sendEmail !== false) {
      const [stu] = await pool.query<RowDataPacket[]>("SELECT email FROM students WHERE id = ?", [studentId]);
      if (stu[0]?.email) {
        emailQueued = true;
        void sendMailBatch([buildMail(stu[0].email, title, message)]);
      }
    } else if (!studentId && sendEmail === true) {
      const [all] = await pool.query<RowDataPacket[]>(
        "SELECT email FROM students WHERE status = 'active'"
      );
      emailQueued = all.length > 0;
      void sendMailBatch(all.map((r) => buildMail(r.email, title, message)));
    }
  }

  return res.status(201).json({ message: "ສ້າງແຈ້ງການສຳເລັດ", data: rows[0], emailQueued });
});

/* ---------------------------------------------------------
   PATCH /api/notifications/:id/read
   ນັກສຶກສາໝາຍວ່າອ່ານແລ້ວໄດ້ສະເພາະຂອງຕົນ ແລະ ແຈ້ງການລວມ (ຜົນມີສະເພາະກັບຕົນເອງ)
   --------------------------------------------------------- */
export const markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<NotificationRow[]>(
    "SELECT * FROM notifications WHERE id = ? LIMIT 1",
    [id]
  );
  const notification = rows[0];
  if (!notification) {
    throw new AppError(404, "ບໍ່ພົບແຈ້ງການ");
  }

  if (!isStaff(req.user?.role)) {
    const ownStudentId = await getOwnStudentId(Number(req.user?.id));
    const isMine = notification.student_id !== null && notification.student_id === ownStudentId;
    const isBroadcast = notification.student_id === null;
    if (!isMine && !isBroadcast) {
      throw new AppError(403, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງແຈ້ງການນີ້");
    }
    if (isBroadcast) {
      if (!ownStudentId) {
        throw new AppError(403, "ບັນຊີນີ້ຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ");
      }
      await pool.query(
        "INSERT IGNORE INTO notification_reads (notification_id, student_id) VALUES (?, ?)",
        [id, ownStudentId]
      );
      return res.status(200).json({ message: "ໝາຍວ່າອ່ານແລ້ວ", data: { ...notification, is_read: 1 } });
    }
  }

  await pool.query("UPDATE notifications SET is_read = TRUE WHERE id = ?", [id]);

  const [updated] = await pool.query<NotificationRow[]>(
    "SELECT * FROM notifications WHERE id = ?",
    [id]
  );
  return res.status(200).json({ message: "ໝາຍວ່າອ່ານແລ້ວ", data: updated[0] });
});

/* ---------------------------------------------------------
   PATCH /api/notifications/read-all   (ນັກສຶກສາ)
   ໝາຍທຸກແຈ້ງການຂອງຕົນ ແລະ ແຈ້ງການລວມວ່າອ່ານແລ້ວ
   --------------------------------------------------------- */
export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ownStudentId = await getOwnStudentId(Number(req.user?.id));
  if (!ownStudentId) {
    throw new AppError(403, "ບັນຊີນີ້ຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ");
  }
  await pool.query("UPDATE notifications SET is_read = TRUE WHERE student_id = ? AND is_read = FALSE", [
    ownStudentId,
  ]);
  await pool.query(
    `INSERT IGNORE INTO notification_reads (notification_id, student_id)
     SELECT n.id, ? FROM notifications n WHERE n.student_id IS NULL`,
    [ownStudentId]
  );
  return res.status(200).json({ message: "ໝາຍວ່າອ່ານແລ້ວທັງໝົດ" });
});

/* ---------------------------------------------------------
   DELETE /api/notifications/:id  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<NotificationRow[]>(
    "SELECT * FROM notifications WHERE id = ? LIMIT 1",
    [id]
  );
  const deleted = rows[0];
  if (!deleted) {
    throw new AppError(404, "ບໍ່ພົບແຈ້ງການ");
  }

  await pool.query("DELETE FROM notifications WHERE id = ?", [id]);
  return res.status(200).json({ message: "ລຶບແຈ້ງການສຳເລັດ", data: deleted });
});
