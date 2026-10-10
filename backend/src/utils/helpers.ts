import { Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";

/* =========================================================
   1) Error ແບບມີ status code — ໂຍນຈາກ controller ໄດ້ເລີຍ
      ແລ້ວ errorHandler ກາງຈະຈັບໄປຕອບເປັນ JSON ໃຫ້
   ========================================================= */
export class AppError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* =========================================================
   2) asyncHandler — ຫໍ່ controller ທີ່ເປັນ async
      ເພື່ອບໍ່ຕ້ອງຂຽນ try/catch ຊ້ຳທຸກ function
      ແລະ ບໍ່ໃຫ້ມີ unhandled promise rejection ຫຼຸດອອກໄປ
   ========================================================= */
type AsyncFn = (req: any, res: any, next: any) => Promise<any>;
export const asyncHandler =
  (fn: AsyncFn) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* =========================================================
   3) ຮູບແບບ response ມາດຕະຖານ
      - ລາຍການ  : { data: [...], total: n }
      - ອັນດຽວ  : { data: {...} }
      legacyKey ແມ່ນຊື່ເກົ່າ (rooms/students/...) ໃສ່ໄວ້ຊົ່ວຄາວ
      ເພື່ອບໍ່ໃຫ້ test.http ແລະ code ເກົ່າພັງ — frontend ໃໝ່ໃຫ້ໃຊ້ "data"
   ========================================================= */
export const sendList = <T>(res: Response, rows: T[], legacyKey?: string) => {
  const body: Record<string, unknown> = { data: rows, total: rows.length };
  if (legacyKey) body[legacyKey] = rows;
  return res.status(200).json(body);
};

export const sendOne = (
  res: Response,
  row: unknown,
  opts: { status?: number; message?: string; legacyKey?: string } = {}
) => {
  const body: Record<string, unknown> = { data: row };
  if (opts.message) body.message = opts.message;
  if (opts.legacyKey) body[opts.legacyKey] = row;
  return res.status(opts.status ?? 200).json(body);
};

/* =========================================================
   3.1) Pagination — ?page=1&limit=50
        ຄ່າເລີ່ມຕົ້ນ 50 ແຖວ, ສູງສຸດ 200 (ກັນ response ໃຫຍ່ເກີນ)
        response ຈະມີ: data, total (ຈຳນວນທັງໝົດ), page, limit, totalPages
   ========================================================= */
export interface PageOpts {
  page: number;
  limit: number;
  offset: number;
}

export const parsePagination = (
  query: Record<string, unknown>,
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): PageOpts => {
  const maxLimit = opts.maxLimit ?? 200;
  const defaultLimit = opts.defaultLimit ?? 50;

  const pageRaw = query.page === undefined || query.page === "" ? 1 : Number(query.page);
  const limitRaw = query.limit === undefined || query.limit === "" ? defaultLimit : Number(query.limit);

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    throw new AppError(400, "page ຕ້ອງເປັນຈຳນວນເຕັມທີ່ >= 1");
  }
  if (!Number.isInteger(limitRaw) || limitRaw < 1) {
    throw new AppError(400, "limit ຕ້ອງເປັນຈຳນວນເຕັມທີ່ >= 1");
  }
  const limit = Math.min(limitRaw, maxLimit);
  return { page: pageRaw, limit, offset: (pageRaw - 1) * limit };
};

/** ສົ່ງລາຍການແບບແບ່ງໜ້າ. extra = field ເພີ່ມເຕີມ (ເຊັ່ນ summary, unread) */
export const sendPage = <T>(
  res: Response,
  rows: T[],
  total: number,
  pg: PageOpts,
  extra: Record<string, unknown> = {},
  legacyKey?: string
) => {
  const body: Record<string, unknown> = {
    data: rows,
    total,
    page: pg.page,
    limit: pg.limit,
    totalPages: Math.max(1, Math.ceil(total / pg.limit)),
    ...extra,
  };
  if (legacyKey) body[legacyKey] = rows;
  return res.status(200).json(body);
};

/* =========================================================
   3.2) Role ຂອງລະບົບ
        admin   = ຄວບຄຸມທຸກຢ່າງ
        staff   = ພະນັກງານໜ້າຫໍ (ເບິ່ງທຸກຢ່າງ, ຮັບຊຳລະ, ຜູ້ມາຢ້ຽມ, ສ້ອມແປງ, check-out)
        student = ນັກສຶກສາ (ເຫັນສະເພາະຂອງຕົນ)
   ========================================================= */
export const ROLES = ["admin", "staff", "student"] as const;
export type Role = (typeof ROLES)[number];

/** admin ຫຼື staff — ເຫັນຂໍ້ມູນຂອງທຸກຄົນໄດ້ (ບໍ່ຖືກຈຳກັດສະເພາະຂອງຕົນເອງ) */
export const isStaff = (role: string | undefined | null): boolean =>
  role === "admin" || role === "staff";

/* =========================================================
   4) ຕົວກວດຂໍ້ມູນ (validation)
   ========================================================= */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ເຮັດໃຫ້ອີເມວເປັນມາດຕະຖານ: ຕັດຊ່ອງວ່າງ + ເປັນຕົວນ້ອຍ ແລ້ວກວດຮູບແບບ */
export const normalizeEmail = (value: unknown, field = "email"): string => {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError(400, `ຮູບແບບ ${field} ບໍ່ຖືກຕ້ອງ (ຕົວຢ່າງ: name@example.com)`);
  }
  return email;
};

/** ຂໍ້ຄວາມທີ່ຫ້າມວ່າງ + ຕັດຊ່ອງວ່າງຫົວທ້າຍ + ຈຳກັດຄວາມຍາວ */
export const requireText = (value: unknown, field: string, max = 255): string => {
  const text = String(value ?? "").trim();
  if (!text) throw new AppError(400, `ກະລຸນາປ້ອນ ${field}`);
  if (text.length > max) {
    throw new AppError(400, `${field} ຍາວເກີນ ${max} ຕົວອັກສອນ`);
  }
  return text;
};

/** ລະຫັດຜ່ານ: ຢ່າງໜ້ອຍ 8 ຕົວ ແລະ ບໍ່ເກີນ 72 bytes (ຂີດຈຳກັດຂອງ bcrypt) */
export const MIN_PASSWORD_LENGTH = 8;
export const requirePassword = (value: unknown, field = "ລະຫັດຜ່ານ"): string => {
  const password = String(value ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `${field}ຕ້ອງຍາວຢ່າງໜ້ອຍ ${MIN_PASSWORD_LENGTH} ຕົວອັກສອນ`);
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new AppError(400, `${field}ຍາວເກີນໄປ (ສູງສຸດ 72 bytes)`);
  }
  return password;
};

/** ຂໍ້ຄວາມທີ່ບໍ່ບັງຄັບ — ຄືນ null ຖ້າວ່າງ */
export const optionalText = (value: unknown, max = 255): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new AppError(400, `ຂໍ້ຄວາມຍາວເກີນ ${max} ຕົວອັກສອນ`);
  return text;
};

/** ຕົວເລກບວກ — ຮັບທັງ number ແລະ string ທີ່ເປັນຕົວເລກ (form ສົ່ງມາເປັນ string ໄດ້) */
export const requirePositiveNumber = (value: unknown, field: string): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຕົວເລກທີ່ຫຼາຍກວ່າ 0`);
  }
  return num;
};

/** ຈຳນວນເຕັມບວກ (ເຊັ່ນ id, capacity) */
export const requirePositiveInt = (value: unknown, field: string): number => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຈຳນວນເຕັມທີ່ຫຼາຍກວ່າ 0`);
  }
  return num;
};

/** ອ່ານ :id ຈາກ URL — ກັນກໍລະນີສົ່ງ /api/rooms/abc ມາ */
export const paramId = (value: unknown, field = "id"): number => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(400, `${field} ໃນ URL ຕ້ອງເປັນຕົວເລກ`);
  }
  return num;
};

/** ຄ່າທີ່ຕ້ອງຢູ່ໃນລາຍການ enum ທີ່ກຳນົດ */
export const requireEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T => {
  const val = String(value ?? "").trim() as T;
  if (!allowed.includes(val)) {
    throw new AppError(400, `${field} ຕ້ອງເປັນໜຶ່ງໃນ: ${allowed.join(", ")}`);
  }
  return val;
};

/** enum ແບບບໍ່ບັງຄັບ — undefined ຜ່ານໄດ້ */
export const optionalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  return requireEnum(value, allowed, field);
};

/* =========================================================
   5) ກວດວ່າແຖວແມ່ອ້າງອີງ (foreign key) ມີຢູ່ຈິງ
      ຖ້າບໍ່ກວດ, MySQL ຈະ throw FK error ແລ້ວກາຍເປັນ 500
      ທັງໆທີ່ຄວາມຈິງແມ່ນ client ສົ່ງ id ຜິດ (ຄວນເປັນ 404)
   ========================================================= */
const TABLE_LABEL: Record<string, string> = {
  students: "ນັກສຶກສາ",
  rooms: "ຫ້ອງ",
  buildings: "ຕຶກ",
  users: "ຜູ້ໃຊ້",
};

export const ensureExists = async (table: keyof typeof TABLE_LABEL, id: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError(404, `ບໍ່ພົບ${TABLE_LABEL[table]} id = ${id}`);
  }
};

/* =========================================================
   6) ຄວາມຈຸຫ້ອງ — ແຫຼ່ງຄວາມຈິງດຽວຂອງ "ໃຜພັກຢູ່ຫ້ອງໃດ"

   ໃຊ້ students.room_id ເປັນຕົວນັບ (ບໍ່ແມ່ນຕາຕະລາງ bookings)
   ເຫດຜົນ: ນັກສຶກສາເຂົ້າຫ້ອງໄດ້ 2 ທາງ
     1. ຜ່ານການຈອງ  (POST /api/bookings)
     2. admin ຜູກໃຫ້ໂດຍກົງ (POST/PUT /api/students ພ້ອມ roomId)
   ຖ້ານັບຈາກ bookings ຢ່າງດຽວ ທາງທີ 2 ຈະຂ້າມການກວດຄວາມຈຸໄປ
   ດັ່ງນັ້ນທຸກຈຸດຈຶ່ງນັບຈາກ students.room_id ອັນດຽວກັນໝົດ
   (booking.controller ເປັນຜູ້ຮັກສາໃຫ້ room_id ກົງກັບການຈອງສະເໝີ)
   ========================================================= */
// ນະໂຍບາຍຂອງຫໍ: 1 ຫ້ອງຢູ່ໄດ້ບໍ່ເກີນ 4 ຄົນ ເດັດຂາດ
// ຕັ້ງຕ່ຳກວ່ານີ້ໄດ້ (ຫ້ອງ 2 ຄົນ, 3 ຄົນ) ແຕ່ຕັ້ງເກີນບໍ່ໄດ້
export const MAX_ROOM_CAPACITY = 4;
export const DEFAULT_ROOM_CAPACITY = 4;

export interface RoomOccupancy {
  roomId: number;
  capacity: number;
  occupants: number;
  vacancy: number;
  isFull: boolean;
  status: "available" | "occupied" | "maintenance";
  label: string; // ເຊັ່ນ "3/4"
}

/** SQL ຍ່ອຍທີ່ໃຊ້ນັບຜູ້ພັກ — ໃສ່ໃນ SELECT ຂອງ controller ອື່ນໄດ້ເລີຍ */
export const OCCUPANTS_SUBQUERY = `(
  SELECT COUNT(*) FROM students st
   WHERE st.room_id = r.id AND st.status = 'active'
)`;

/**
 * ອ່ານສະພາບຄວາມຈຸຂອງຫ້ອງ
 * ຮັບ conn ໄດ້ ເພື່ອໃຫ້ອ່ານພາຍໃນ transaction ດຽວກັນກັບຜູ້ເອີ້ນ
 * forUpdate = ລັອກແຖວຫ້ອງໄວ້ ກັນສອງ request ຈອງບ່ອນສຸດທ້າຍພ້ອມກັນ
 */
export const getRoomOccupancy = async (
  roomId: number,
  conn?: { query: Function },
  forUpdate = false
): Promise<RoomOccupancy> => {
  const db = conn ?? pool;

  const [roomRows] = await db.query(
    `SELECT id, capacity, status FROM rooms WHERE id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [roomId]
  );
  const room = (roomRows as RowDataPacket[])[0];
  if (!room) {
    throw new AppError(404, `ບໍ່ພົບຫ້ອງ id = ${roomId}`);
  }

  const [countRows] = await db.query(
    "SELECT COUNT(*) AS occupants FROM students WHERE room_id = ? AND status = 'active'",
    [roomId]
  );
  const occupants = Number((countRows as RowDataPacket[])[0]?.occupants ?? 0);
  const capacity = Number(room.capacity);

  return {
    roomId,
    capacity,
    occupants,
    vacancy: Math.max(0, capacity - occupants),
    isFull: occupants >= capacity,
    status: room.status,
    label: `${occupants}/${capacity}`,
  };
};

/**
 * ກວດວ່າຫ້ອງຍັງຮັບຄົນເພີ່ມໄດ້ບໍ່ — ຖ້າບໍ່ໄດ້ ໂຍນ 409 ພ້ອມຂໍ້ຄວາມທີ່ອ່ານເຂົ້າໃຈ
 * excludeStudentId = ຕອນຍ້າຍຫ້ອງ, ບໍ່ໃຫ້ນັບຕົວເອງຊ້ຳ
 */
export const assertRoomHasSpace = async (
  roomId: number,
  conn?: { query: Function },
  opts: { forUpdate?: boolean; excludeStudentId?: number } = {}
): Promise<RoomOccupancy> => {
  const info = await getRoomOccupancy(roomId, conn, opts.forUpdate ?? false);

  if (info.status === "maintenance") {
    throw new AppError(409, "ຫ້ອງນີ້ກຳລັງສ້ອມແປງ ຈຶ່ງຮັບຜູ້ພັກເພີ່ມບໍ່ໄດ້", "ROOM_UNDER_MAINTENANCE");
  }

  // ຄົນທີ່ຢູ່ຫ້ອງນີ້ຢູ່ແລ້ວ ບໍ່ນັບເປັນຄົນໃໝ່
  let occupants = info.occupants;
  if (opts.excludeStudentId) {
    const db = conn ?? pool;
    const [rows] = await db.query(
      "SELECT 1 FROM students WHERE id = ? AND room_id = ? AND status = 'active' LIMIT 1",
      [opts.excludeStudentId, roomId]
    );
    if ((rows as RowDataPacket[]).length > 0) occupants -= 1;
  }

  if (occupants >= info.capacity) {
    throw new AppError(
      409,
      `ຫ້ອງນີ້ເຕັມແລ້ວ (${info.occupants}/${info.capacity} ຄົນ) ກະລຸນາເລືອກຫ້ອງອື່ນ`,
      "ROOM_FULL"
    );
  }

  return info;
};

/**
 * ຄຳນວນ rooms.status ຄືນໃໝ່ຈາກຈຳນວນຜູ້ພັກຈິງ
 * ບໍ່ແຕະຫ້ອງທີ່ຢູ່ສະຖານະ maintenance (admin ຕັ້ງໄວ້ເອງ)
 */
export const syncRoomStatus = async (roomId: number | null | undefined) => {
  if (!roomId) return;

  const [roomRows] = await pool.query<RowDataPacket[]>(
    "SELECT capacity, status FROM rooms WHERE id = ? LIMIT 1",
    [roomId]
  );
  const room = roomRows[0];
  if (!room || room.status === "maintenance") return;

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS occupants FROM students WHERE room_id = ? AND status = 'active'",
    [roomId]
  );
  const occupants = Number(countRows[0]?.occupants ?? 0);
  const nextStatus = occupants >= Number(room.capacity) ? "occupied" : "available";

  if (nextStatus !== room.status) {
    await pool.query("UPDATE rooms SET status = ? WHERE id = ?", [nextStatus, roomId]);
  }
};

/* =========================================================
   7) ຫາ students.id ຂອງຜູ້ໃຊ້ທີ່ login ຢູ່
      ໃຊ້ຮ່ວມກັນຫຼາຍ controller ຈຶ່ງຍ້າຍມາໄວ້ບ່ອນດຽວ
   ========================================================= */
export const getOwnStudentId = async (userId: number): Promise<number | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM students WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return (rows[0]?.id as number) ?? null;
};

/** ຖ້າບໍ່ແມ່ນ admin/staff → ບັງຄັບໃຊ້ studentId ຂອງຕົນເອງສະເໝີ (ກັນ IDOR) */
export const resolveStudentScope = async (
  user: { id: number; role: string } | undefined,
  requestedStudentId?: unknown
): Promise<number> => {
  if (!user) throw new AppError(401, "ກະລຸນາເຂົ້າສູ່ລະບົບ");

  if (isStaff(user.role)) {
    return requirePositiveInt(requestedStudentId, "studentId");
  }

  const own = await getOwnStudentId(user.id);
  if (!own) {
    throw new AppError(
      403,
      "ບັນຊີນີ້ຍັງບໍ່ໄດ້ຖືກເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ"
    );
  }

  // ຖ້ານັກສຶກສາພະຍາຍາມລະບຸ studentId ຂອງຄົນອື່ນ → ປະຕິເສດຢ່າງຊັດເຈນ
  if (
    requestedStudentId !== undefined &&
    requestedStudentId !== null &&
    requestedStudentId !== "" &&
    Number(requestedStudentId) !== own
  ) {
    throw new AppError(403, "ທ່ານສາມາດດຳເນີນການໄດ້ສະເພາະໃນນາມຂອງຕົນເອງເທົ່ານັ້ນ");
  }

  return own;
};
