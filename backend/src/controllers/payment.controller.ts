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
  optionalText,
  paramId,
  parsePagination,
  requireEnum,
  requirePositiveInt,
  requirePositiveNumber,
  sendPage,
} from "../utils/helpers";
import { notifyStudent } from "../utils/notify";

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "mobile_banking"] as const;
const PAYMENT_TYPES = ["rent", "deposit", "utility", "other"] as const;

const TYPE_LABEL: Record<(typeof PAYMENT_TYPES)[number], string> = {
  rent: "ຄ່າເຊົ່າຫ້ອງ",
  deposit: "ເງິນມັດຈຳ",
  utility: "ຄ່ານ້ຳ/ຄ່າໄຟ",
  other: "ອື່ນໆ",
};

interface PaymentRow extends RowDataPacket {
  id: number;
  student_id: number;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  status: (typeof PAYMENT_STATUSES)[number];
  type: (typeof PAYMENT_TYPES)[number];
  description: string | null;
  billing_month: string | null;
  due_date: string | null;
  invoice_no: string | null;
  receipt_no: string | null;
  paid_at: string | null;
  payment_date: string;
}

/* ---------------------------------------------------------
   ຕົວຊ່ວຍ
   --------------------------------------------------------- */
const pad = (id: number) => String(id).padStart(6, "0");
const yyyymm = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
const money = (n: number) => Number(n).toLocaleString("en-US");

/** ເລກໃບແຈ້ງໜີ້ / ໃບຮັບເງິນ ອີງຕາມ id ຂອງແຖວ (ບໍ່ຊ້ຳກັນແນ່ນອນ) */
const invoiceNo = (id: number) => `INV-${yyyymm()}-${pad(id)}`;
const receiptNo = (id: number) => `RC-${yyyymm()}-${pad(id)}`;

const parseMonth = (value: unknown, field = "billingMonth"): string => {
  const text = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})$/.exec(text);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຮູບແບບ YYYY-MM (ເຊັ່ນ 2026-10)`);
  }
  return text;
};

const parseDateOnly = (value: unknown, field: string): string => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(text).getTime())) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD`);
  }
  return text;
};

const PAYMENT_SELECT = `
  SELECT p.*, s.name AS student_name, r.room_number, b.name AS building_name,
         (p.status = 'pending' AND p.due_date IS NOT NULL AND p.due_date < CURDATE()) AS is_overdue
    FROM payments p
    LEFT JOIN students s ON s.id = p.student_id
    LEFT JOIN rooms r ON r.id = s.room_id
    LEFT JOIN buildings b ON b.id = r.building_id`;

const findPayment = async (id: number): Promise<PaymentRow> => {
  const [rows] = await pool.query<PaymentRow[]>(`${PAYMENT_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  if (!rows[0]) throw new AppError(404, "ບໍ່ພົບລາຍການຊຳລະ");
  return rows[0];
};

/** ນັກສຶກສາເຂົ້າເຖິງໄດ້ສະເພາະລາຍການຂອງຕົນ, admin/staff ເຂົ້າໄດ້ທຸກອັນ */
const assertCanAccess = async (req: AuthRequest, studentId: number, message: string) => {
  if (isStaff(req.user?.role)) return;
  const own = await getOwnStudentId(Number(req.user?.id));
  if (!own || own !== studentId) throw new AppError(403, message);
};

/** ສະຫຼຸບຍອດເງິນ: ຈ່າຍແລ້ວ / ຄ້າງຈ່າຍ / ເກີນກຳນົດ */
const TOTALS_SELECT = `
  SELECT COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount END), 0) AS totalPaid,
         COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount END), 0) AS totalPending,
         COALESCE(SUM(CASE WHEN p.status = 'pending' AND p.due_date IS NOT NULL AND p.due_date < CURDATE()
                           THEN p.amount END), 0) AS totalOverdue,
         COUNT(*) AS total
    FROM payments p`;

const toTotals = (row: RowDataPacket) => ({
  totalPaid: Number(row.totalPaid),
  totalPending: Number(row.totalPending),
  totalOverdue: Number(row.totalOverdue),
});

/* ---------------------------------------------------------
   GET /api/payments  (admin / staff)
   ?status= &method= &type= &studentId= &billingMonth= &overdue=true &from= &to= &page= &limit=
   --------------------------------------------------------- */
export const getAllPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = optionalEnum(req.query.status, PAYMENT_STATUSES, "status");
  const method = optionalEnum(req.query.method, PAYMENT_METHODS, "method");
  const type = optionalEnum(req.query.type, PAYMENT_TYPES, "type");
  const { studentId, billingMonth, overdue, from, to } = req.query;
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (status) {
    where += " AND p.status = ?";
    params.push(status);
  }
  if (method) {
    where += " AND p.method = ?";
    params.push(method);
  }
  if (type) {
    where += " AND p.type = ?";
    params.push(type);
  }
  if (studentId) {
    where += " AND p.student_id = ?";
    params.push(requirePositiveInt(studentId, "studentId"));
  }
  if (billingMonth) {
    where += " AND p.billing_month = ?";
    params.push(parseMonth(billingMonth, "billingMonth"));
  }
  if (overdue === "true") {
    where += " AND p.status = 'pending' AND p.due_date IS NOT NULL AND p.due_date < CURDATE()";
  }
  if (from) {
    where += " AND DATE(p.payment_date) >= ?";
    params.push(parseDateOnly(from, "from"));
  }
  if (to) {
    where += " AND DATE(p.payment_date) <= ?";
    params.push(parseDateOnly(to, "to"));
  }

  const [[totals]] = await pool.query<RowDataPacket[]>(`${TOTALS_SELECT}${where}`, params);
  const [rows] = await pool.query<PaymentRow[]>(
    `${PAYMENT_SELECT}${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );

  return sendPage(res, rows, Number(totals.total), pg, { summary: toTotals(totals) });
});

/* ---------------------------------------------------------
   GET /api/payments/:id
   --------------------------------------------------------- */
export const getPaymentById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payment = await findPayment(paramId(req.params.id));
  await assertCanAccess(req, payment.student_id, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງລາຍການຊຳລະນີ້");
  return res.status(200).json({ data: payment });
});

/* ---------------------------------------------------------
   POST /api/payments  (admin / staff)
   ບັນທຶກລາຍການຊຳລະ ຫຼື ອອກໃບແຈ້ງໜີ້ໃຫ້ນັກສຶກສາ
   body: { studentId, amount, method, type?, description?, status?(pending|paid),
           billingMonth?(YYYY-MM), dueDate?(YYYY-MM-DD), paymentDate? }
   - ທຸກລາຍການໄດ້ເລກໃບແຈ້ງໜີ້ (invoice_no); ຈ່າຍແລ້ວ (paid) ໄດ້ເລກໃບຮັບເງິນ (receipt_no) ນຳ
   - ນັກສຶກສາຄົນດຽວ + ເດືອນ + ປະເພດ ອອກບິນຊ້ຳບໍ່ໄດ້ (409)
   --------------------------------------------------------- */
export const createPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentId = requirePositiveInt(req.body?.studentId, "studentId");
  const amount = requirePositiveNumber(req.body?.amount, "amount");
  const method = requireEnum(req.body?.method, PAYMENT_METHODS, "method");
  const type = optionalEnum(req.body?.type, PAYMENT_TYPES, "type") ?? "other";
  const description = optionalText(req.body?.description, 255);
  const status = optionalEnum(req.body?.status, PAYMENT_STATUSES, "status") ?? "pending";
  const billingMonth =
    req.body?.billingMonth !== undefined && req.body?.billingMonth !== null && req.body?.billingMonth !== ""
      ? parseMonth(req.body.billingMonth)
      : null;
  const dueDate =
    req.body?.dueDate !== undefined && req.body?.dueDate !== null && req.body?.dueDate !== ""
      ? parseDateOnly(req.body.dueDate, "dueDate")
      : null;

  if (status !== "pending" && status !== "paid") {
    throw new AppError(400, "ສ້າງລາຍການໃໝ່ໄດ້ສະເພາະ status = pending ຫຼື paid");
  }

  await ensureExists("students", studentId);

  // ຈຳກັດຈຳນວນສູງສຸດ ກັນພິມຕົວເລກຜິດ (DECIMAL(12,2))
  if (amount > 9_999_999_999) {
    throw new AppError(400, "amount ໃຫຍ່ເກີນທີ່ລະບົບຮອງຮັບ");
  }

  const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
  if (Number.isNaN(paymentDate.getTime())) {
    throw new AppError(400, "paymentDate ບໍ່ຖືກຮູບແບບ (ຕົວຢ່າງ: 2026-09-19 10:00:00)");
  }

  const conn = await pool.getConnection();
  let newId: number;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO payments
         (student_id, amount, method, status, type, description, billing_month, due_date, payment_date, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        amount,
        method,
        status,
        type,
        description,
        billingMonth,
        dueDate,
        paymentDate,
        status === "paid" ? paymentDate : null,
      ]
    );
    newId = result.insertId;
    await conn.query("UPDATE payments SET invoice_no = ?, receipt_no = ? WHERE id = ?", [
      invoiceNo(newId),
      status === "paid" ? receiptNo(newId) : null,
      newId,
    ]);
    await conn.commit();
  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY" && String(error.sqlMessage).includes("uq_payment_month")) {
      throw new AppError(
        409,
        `ນັກສຶກສາຄົນນີ້ມີລາຍການ "${TYPE_LABEL[type]}" ຂອງເດືອນ ${billingMonth} ແລ້ວ`,
        "PAYMENT_DUPLICATE"
      );
    }
    throw error;
  } finally {
    conn.release();
  }

  if (status === "pending") {
    void notifyStudent(studentId, {
      title: "ມີໃບແຈ້ງໜີ້ໃໝ່",
      message:
        `${description || TYPE_LABEL[type]} ຈຳນວນ ${money(amount)} ກີບ` +
        (dueDate ? ` ກຳນົດຊຳລະ ${dueDate}` : "") +
        ` (ເລກທີ ${invoiceNo(newId)})`,
      type: "payment",
    });
  }

  return res.status(201).json({ message: "ບັນທຶກການຊຳລະສຳເລັດ", data: await findPayment(newId) });
});

/* ---------------------------------------------------------
   GET /api/payments/student/:studentId   ?page= &limit=
   totalPaid / totalPending / totalOverdue ຄຳນວນຈາກທຸກລາຍການຂອງນັກສຶກສາຄົນນີ້
   --------------------------------------------------------- */
export const getPaymentsByStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentId = paramId(req.params.studentId, "studentId");
  await assertCanAccess(req, studentId, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງລາຍການຊຳລະຂອງນັກສຶກສາອື່ນ");
  const pg = parsePagination(req.query);

  const [[totals]] = await pool.query<RowDataPacket[]>(`${TOTALS_SELECT} WHERE p.student_id = ?`, [
    studentId,
  ]);
  const [rows] = await pool.query<PaymentRow[]>(
    `${PAYMENT_SELECT} WHERE p.student_id = ? ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [studentId, pg.limit, pg.offset]
  );

  return sendPage(res, rows, Number(totals.total), pg, toTotals(totals));
});

/* ---------------------------------------------------------
   PUT /api/payments/:id/status  (admin / staff)
   body: { status, method? }   — method ໃຊ້ຕອນບັນທຶກວ່າຈ່າຍດ້ວຍວິທີໃດ
   ກົດການປ່ຽນສະຖານະ: ຈ່າຍແລ້ວຈະກັບໄປ pending ບໍ່ໄດ້
   ຄືນເງິນ (refunded) ສະເພາະ admin
   ຈ່າຍແລ້ວ (paid) → ອອກເລກໃບຮັບເງິນ + ແຈ້ງນັກສຶກສາ
   --------------------------------------------------------- */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "failed", "pending"],
  failed: ["pending", "paid", "failed"],
  paid: ["refunded", "paid"],
  refunded: ["refunded"],
};

export const updatePaymentStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const status = requireEnum(req.body?.status, PAYMENT_STATUSES, "status");
  const method = optionalEnum(req.body?.method, PAYMENT_METHODS, "method");

  const existing = await findPayment(id);

  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(
      409,
      `ປ່ຽນສະຖານະຈາກ "${existing.status}" ໄປ "${status}" ບໍ່ໄດ້ (ອະນຸຍາດ: ${allowed.join(", ")})`
    );
  }
  if (status === "refunded" && req.user?.role !== "admin") {
    throw new AppError(403, "ການຄືນເງິນ (refunded) ເຮັດໄດ້ສະເພາະ admin", "FORBIDDEN");
  }

  if (status === "paid" && existing.status !== "paid") {
    await pool.query(
      `UPDATE payments
          SET status = 'paid', paid_at = NOW(), payment_date = NOW(),
              method = COALESCE(?, method),
              receipt_no = COALESCE(receipt_no, ?)
        WHERE id = ?`,
      [method ?? null, receiptNo(id), id]
    );
    void notifyStudent(existing.student_id, {
      title: "ຮັບຊຳລະເງິນແລ້ວ",
      message: `ໄດ້ຮັບເງິນ ${money(existing.amount)} ກີບ (${existing.description || TYPE_LABEL[existing.type]}) ເລກໃບຮັບເງິນ ${receiptNo(id)}`,
      type: "payment",
    });
  } else {
    await pool.query("UPDATE payments SET status = ?, method = COALESCE(?, method) WHERE id = ?", [
      status,
      method ?? null,
      id,
    ]);
  }

  return res.status(200).json({ message: "ອັບເດດສະຖານະສຳເລັດ", data: await findPayment(id) });
});

/* ---------------------------------------------------------
   POST /api/payments/generate-monthly  (admin ເທົ່ານັ້ນ)
   ສ້າງໃບແຈ້ງໜີ້ຄ່າເຊົ່າປະຈຳເດືອນ ໃຫ້ນັກສຶກສາທຸກຄົນທີ່ພັກຢູ່ (status = active ແລະມີຫ້ອງ)
   body: { month: "2026-10", dueDay?: 1-28 (ຄ່າເລີ່ມຕົ້ນ 5), type?: rent, dryRun?: true,
           splitRoom?: true }
   - ຄ່າເລີ່ມຕົ້ນ ລາຄາຫ້ອງ (rooms.price) = ຄ່າເຊົ່າຕໍ່ຄົນຕໍ່ເດືອນ
     ຖ້າ splitRoom = true → ເອົາລາຄາຫ້ອງຫານດ້ວຍຈຳນວນຜູ້ພັກ
   - ແລ່ນຊ້ຳໄດ້ປອດໄພ: ຄົນທີ່ມີບິນເດືອນນັ້ນແລ້ວຈະຖືກຂ້າມ (ບໍ່ອອກຊ້ຳ)
   - dryRun = true → ເບິ່ງຕົວຢ່າງເທົ່ານັ້ນ ບໍ່ບັນທຶກ
   --------------------------------------------------------- */
export const generateMonthlyInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const month = parseMonth(req.body?.month, "month");
  const type = optionalEnum(req.body?.type, PAYMENT_TYPES, "type") ?? "rent";
  const dryRun = req.body?.dryRun === true;
  const splitRoom = req.body?.splitRoom === true;

  const dueDay = req.body?.dueDay === undefined ? 5 : Number(req.body.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    throw new AppError(400, "dueDay ຕ້ອງເປັນຈຳນວນເຕັມ 1–28");
  }
  const dueDate = `${month}-${String(dueDay).padStart(2, "0")}`;

  const [candidates] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS student_id, s.name AS student_name, r.id AS room_id, r.room_number, r.price,
            (SELECT COUNT(*) FROM students x WHERE x.room_id = r.id AND x.status = 'active') AS occupants
       FROM students s
       JOIN rooms r ON r.id = s.room_id
      WHERE s.status = 'active'
      ORDER BY s.id`
  );

  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT student_id FROM payments WHERE billing_month = ? AND type = ?",
    [month, type]
  );
  const already = new Set(existingRows.map((r) => Number(r.student_id)));

  const plan = candidates
    .filter((c) => !already.has(Number(c.student_id)))
    .map((c) => {
      const price = Number(c.price);
      const amount = splitRoom ? Math.round((price / Math.max(1, Number(c.occupants))) * 100) / 100 : price;
      return {
        studentId: Number(c.student_id),
        studentName: c.student_name as string,
        roomNumber: c.room_number as string,
        amount,
      };
    });

  const skipped = candidates.length - plan.length;

  if (dryRun) {
    return res.status(200).json({
      message: "ຕົວຢ່າງການອອກບິນ (ຍັງບໍ່ໄດ້ບັນທຶກ)",
      dryRun: true,
      month,
      dueDate,
      created: plan.length,
      skipped,
      totalAmount: plan.reduce((s, p) => s + p.amount, 0),
      data: plan,
    });
  }

  const description = `${TYPE_LABEL[type]} ເດືອນ ${month}`;
  const createdIds: number[] = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of plan) {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO payments
           (student_id, amount, method, status, type, description, billing_month, due_date, payment_date)
         VALUES (?, ?, 'cash', 'pending', ?, ?, ?, ?, NOW())`,
        [item.studentId, item.amount, type, description, month, dueDate]
      );
      await conn.query("UPDATE payments SET invoice_no = ? WHERE id = ?", [
        invoiceNo(result.insertId),
        result.insertId,
      ]);
      createdIds.push(result.insertId);
    }
    await conn.commit();
  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      throw new AppError(409, "ມີການອອກບິນເດືອນນີ້ພ້ອມກັນ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ", "PAYMENT_DUPLICATE");
    }
    throw error;
  } finally {
    conn.release();
  }

  // ແຈ້ງນັກສຶກສາ (ເບື້ອງຫຼັງ, ບໍ່ໃຫ້ request ຊ້າ)
  void (async () => {
    for (const item of plan) {
      await notifyStudent(item.studentId, {
        title: `ໃບແຈ້ງໜີ້ ${description}`,
        message: `ຈຳນວນ ${money(item.amount)} ກີບ ກຳນົດຊຳລະ ${dueDate} (ຫ້ອງ ${item.roomNumber})`,
        type: "payment",
      });
    }
  })();

  return res.status(201).json({
    message: `ອອກໃບແຈ້ງໜີ້ເດືອນ ${month} ສຳເລັດ ${createdIds.length} ລາຍການ`,
    dryRun: false,
    month,
    dueDate,
    created: createdIds.length,
    skipped,
    totalAmount: plan.reduce((s, p) => s + p.amount, 0),
    data: plan,
  });
});

/* ---------------------------------------------------------
   POST /api/payments/send-reminders  (admin ເທົ່ານັ້ນ)
   ສົ່ງແຈ້ງເຕືອນໃຫ້ນັກສຶກສາທີ່ມີບິນເກີນກຳນົດຊຳລະ (ຄົນລະ 1 ຂໍ້ຄວາມ)
   --------------------------------------------------------- */
export const sendOverdueReminders = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.student_id, COUNT(*) AS count, SUM(p.amount) AS total, MIN(p.due_date) AS oldest
       FROM payments p
      WHERE p.status = 'pending' AND p.due_date IS NOT NULL AND p.due_date < CURDATE()
      GROUP BY p.student_id`
  );

  for (const r of rows) {
    await notifyStudent(Number(r.student_id), {
      title: "ແຈ້ງເຕືອນ: ມີຍອດຄ້າງຊຳລະ",
      message: `ທ່ານມີບິນເກີນກຳນົດ ${r.count} ລາຍການ ລວມ ${money(Number(r.total))} ກີບ (ເກົ່າສຸດ ${r.oldest}) ກະລຸນາຊຳລະໂດຍໄວ`,
      type: "warning",
    });
  }

  return res.status(200).json({
    message: `ສົ່ງແຈ້ງເຕືອນແລ້ວ ${rows.length} ຄົນ`,
    students: rows.length,
  });
});

/* ---------------------------------------------------------
   GET /api/payments/:id/invoice   ແລະ   GET /api/payments/:id/receipt
   ຄືນຂໍ້ມູນເອກະສານ (JSON) ພ້ອມພິມ — frontend ເອົາໄປສະແດງ/ພິມເປັນ PDF ໄດ້
   ໃບຮັບເງິນອອກໄດ້ສະເພາະລາຍການທີ່ຈ່າຍແລ້ວ (paid) ຫຼື ຄືນເງິນແລ້ວ (refunded)
   --------------------------------------------------------- */
const buildDocument = async (req: AuthRequest, kind: "invoice" | "receipt") => {
  const payment = await findPayment(paramId(req.params.id));
  await assertCanAccess(req, payment.student_id, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງລາຍການຊຳລະນີ້");

  if (kind === "receipt" && payment.status !== "paid" && payment.status !== "refunded") {
    throw new AppError(409, "ຍັງບໍ່ໄດ້ຊຳລະ ຈຶ່ງຍັງອອກໃບຮັບເງິນບໍ່ໄດ້", "NOT_PAID");
  }

  const [stuRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, email, phone FROM students WHERE id = ? LIMIT 1",
    [payment.student_id]
  );

  return {
    kind,
    documentNo: kind === "receipt" ? payment.receipt_no : payment.invoice_no,
    invoiceNo: payment.invoice_no,
    receiptNo: payment.receipt_no,
    status: payment.status,
    isOverdue: Boolean(payment.is_overdue),
    student: stuRows[0] ?? null,
    room: payment.room_number
      ? { roomNumber: payment.room_number, buildingName: (payment as any).building_name ?? null }
      : null,
    item: {
      type: payment.type,
      typeLabel: TYPE_LABEL[payment.type],
      description: payment.description,
      billingMonth: payment.billing_month,
    },
    amount: Number(payment.amount),
    currency: "LAK",
    method: payment.method,
    dueDate: payment.due_date,
    issuedAt: payment.created_at,
    paidAt: payment.paid_at,
  };
};

export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) =>
  res.status(200).json({ data: await buildDocument(req, "invoice") })
);

export const getReceipt = asyncHandler(async (req: AuthRequest, res: Response) =>
  res.status(200).json({ data: await buildDocument(req, "receipt") })
);
