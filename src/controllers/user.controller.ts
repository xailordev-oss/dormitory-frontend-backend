import { Response } from "express";
import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { AuthRequest } from "../middlewares/auth.middleware";
import { createAccount } from "../utils/accounts";
import {
  AppError,
  ROLES,
  asyncHandler,
  normalizeEmail,
  optionalEnum,
  optionalText,
  paramId,
  parsePagination,
  requireEnum,
  requirePassword,
  requireText,
  sendPage,
} from "../utils/helpers";

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
         s.id AS student_id
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id`;

/* ---------------------------------------------------------
   GET /api/users  (admin ເທົ່ານັ້ນ)  ?role= &isActive= &search=
   ບໍ່ສົ່ງ column password ອອກໄປເດັດຂາດ
   --------------------------------------------------------- */
export const getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = optionalEnum(req.query.role, ROLES, "role");
  const { isActive, search } = req.query;
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (role) {
    where += " AND u.role = ?";
    params.push(role);
  }
  if (isActive !== undefined) {
    where += " AND u.is_active = ?";
    params.push(isActive === "true" || isActive === "1" ? 1 : 0);
  }
  if (search) {
    where += " AND (u.name LIKE ? OR u.email LIKE ?)";
    const like = `%${String(search).trim()}%`;
    params.push(like, like);
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users u${where}`,
    params
  );
  const [result] = await pool.query<RowDataPacket[]>(
    `${USER_SELECT}${where} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return sendPage(res, result, Number(countRow.total), pg);
});

/* ---------------------------------------------------------
   POST /api/users  (admin ເທົ່ານັ້ນ)
   ສ້າງບັນຊີໃຫ້ຄົນອື່ນ — ໃຊ້ສ້າງ staff / admin ຄົນໃໝ່, ຫຼືສ້າງບັນຊີນັກສຶກສາ
   ເມື່ອຕັ້ງ ALLOW_REGISTRATION=false (ປິດການສະໝັກເອງ)
   body: { name, email, password, role }   role = admin | staff | student
   --------------------------------------------------------- */
export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const name = requireText(req.body?.name, "ຊື່", 150);
  const email = normalizeEmail(req.body?.email);
  const password = requirePassword(req.body?.password);
  const role = requireEnum(req.body?.role ?? "student", ROLES, "role");
  const phone = optionalText(req.body?.phone, 30);

  const account = await createAccount({ name, email, password, role, phone });

  const [rows] = await pool.query<RowDataPacket[]>(`${USER_SELECT} WHERE u.id = ?`, [account.userId]);
  return res.status(201).json({
    message: "ສ້າງບັນຊີສຳເລັດ",
    data: rows[0],
    needsLinking: account.needsLinking,
  });
});

/* ---------------------------------------------------------
   PATCH /api/users/:id/password  (admin ເທົ່ານັ້ນ)
   ຕັ້ງລະຫັດຜ່ານໃຫ້ຜູ້ໃຊ້ (ເມື່ອລືມລະຫັດ ແລະ ຍັງບໍ່ໄດ້ຕັ້ງ SMTP)
   ຖອນ refresh token ຂອງຄົນນັ້ນທັງໝົດ ເພື່ອບັງຄັບ login ໃໝ່
   --------------------------------------------------------- */
export const resetUserPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const newPassword = requirePassword(req.body?.newPassword, "ລະຫັດຜ່ານໃໝ່");

  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
  if (rows.length === 0) throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password = ? WHERE id = ?", [hash, id]);
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [id]);

  return res.status(200).json({ message: "ຕັ້ງລະຫັດຜ່ານໃໝ່ສຳເລັດ (ຜູ້ໃຊ້ຕ້ອງ login ໃໝ່)" });
});

/* GET /api/users/:id  (admin ເທົ່ານັ້ນ) */
export const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<RowDataPacket[]>(`${USER_SELECT} WHERE u.id = ? LIMIT 1`, [id]);
  const user = rows[0];
  if (!user) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }

  return res.status(200).json({ data: user });
});

/* ---------------------------------------------------------
   ນັບ admin ທີ່ຍັງເປີດໃຊ້ງານຢູ່
   ໃຊ້ກັນບໍ່ໃຫ້ລະບົບເຫຼືອ admin ສູນຄົນ ເຊິ່ງຈະລັອກທຸກຄົນອອກຈາກລະບົບ
   ຂອງເກົ່າກັນແຕ່ "ຕົນເອງ" ຈຶ່ງຍັງມີຊ່ອງໃຫ້ admin A ຫຼຸດ admin B
   ເປັນ student ໄດ້ຈົນບໍ່ເຫຼືອໃຜ
   --------------------------------------------------------- */
const countActiveAdmins = async (excludeId?: number): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> ?",
    [excludeId ?? 0]
  );
  return Number(rows[0]?.total ?? 0);
};

/* PATCH /api/users/:id/role  (admin ເທົ່ານັ້ນ) — body: { role } */
export const updateUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const role = requireEnum(req.body?.role, ROLES, "role");

  if (id === Number(req.user?.id) && role !== "admin") {
    throw new AppError(400, "ບໍ່ສາມາດຫຼຸດ role ຂອງຕົນເອງໄດ້");
  }

  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }

  if (existing.role === "admin" && role !== "admin" && (await countActiveAdmins(id)) === 0) {
    throw new AppError(409, "ລະບົບຕ້ອງມີ admin ຢ່າງໜ້ອຍ 1 ຄົນສະເໝີ");
  }

  await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, id]);

  // role ຖືກຝັງຢູ່ໃນ access token ຈຶ່ງຕ້ອງຖອນ refresh token ອອກ
  // ບັງຄັບໃຫ້ຜູ້ໃຊ້ຄົນນັ້ນ login ໃໝ່ເພື່ອຮັບສິດຊຸດໃໝ່ — ກັນສິດເກົ່າຄ້າງ
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [id]);

  const [rows] = await pool.query<RowDataPacket[]>(`${USER_SELECT} WHERE u.id = ?`, [id]);
  return res.status(200).json({
    message: "ປ່ຽນ role ສຳເລັດ (ຜູ້ໃຊ້ຄົນນີ້ຕ້ອງ login ໃໝ່)",
    data: rows[0],
  });
});

/* PATCH /api/users/:id/status  (admin ເທົ່ານັ້ນ) — body: { isActive } */
export const updateUserStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const { isActive } = req.body ?? {};

  if (typeof isActive !== "boolean") {
    throw new AppError(400, "isActive ຕ້ອງເປັນ true ຫຼື false");
  }

  if (id === Number(req.user?.id) && !isActive) {
    throw new AppError(400, "ບໍ່ສາມາດປິດການໃຊ້ງານບັນຊີຕົນເອງໄດ້");
  }

  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, role FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }

  if (existing.role === "admin" && !isActive && (await countActiveAdmins(id)) === 0) {
    throw new AppError(409, "ລະບົບຕ້ອງມີ admin ທີ່ໃຊ້ງານໄດ້ຢ່າງໜ້ອຍ 1 ຄົນສະເໝີ");
  }

  await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [isActive, id]);

  // ປິດບັນຊີ → ຖອນ refresh token ທັງໝົດ ເພື່ອບໍ່ໃຫ້ຂໍ token ໃໝ່ໄດ້ອີກ
  if (!isActive) {
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [id]);
  }

  const [rows] = await pool.query<RowDataPacket[]>(`${USER_SELECT} WHERE u.id = ?`, [id]);
  return res.status(200).json({
    message: isActive ? "ເປີດການໃຊ້ງານບັນຊີສຳເລັດ" : "ປິດການໃຊ້ງານບັນຊີສຳເລັດ",
    data: rows[0],
  });
});

/* ---------------------------------------------------------
   DELETE /api/users/:id  (admin ເທົ່ານັ້ນ)
   ແນະນຳໃຫ້ໃຊ້ PATCH /status ປິດບັນຊີແທນ ເພາະ students.user_id
   ເປັນ ON DELETE SET NULL — ລຶບແລ້ວຂໍ້ມູນນັກສຶກສາຈະຂາດການເຊື່ອມ
   --------------------------------------------------------- */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  if (id === Number(req.user?.id)) {
    throw new AppError(400, "ບໍ່ສາມາດລຶບບັນຊີຕົນເອງໄດ້");
  }

  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }

  if (existing.role === "admin" && (await countActiveAdmins(id)) === 0) {
    throw new AppError(409, "ລະບົບຕ້ອງມີ admin ຢ່າງໜ້ອຍ 1 ຄົນສະເໝີ");
  }

  const [linkedRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name FROM students WHERE user_id = ? LIMIT 1",
    [id]
  );
  if (linkedRows.length > 0 && req.query.force !== "true") {
    throw new AppError(
      409,
      `ບັນຊີນີ້ຜູກກັບນັກສຶກສາ "${linkedRows[0].name}" (id ${linkedRows[0].id}) ຢູ່. ` +
        `ແນະນຳໃຫ້ປິດການໃຊ້ງານແທນການລຶບ. ຖ້າຕ້ອງການລຶບແທ້ ໃຫ້ໃຊ້ ?force=true`
    );
  }

  await pool.query("DELETE FROM users WHERE id = ?", [id]);
  return res.status(200).json({ message: "ລຶບບັນຊີສຳເລັດ", data: existing });
});
