import crypto from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { env, isMailEnabled } from "../config/env";
import { sendMail } from "../config/mailer";
import { AuthRequest } from "../middlewares/auth.middleware";
import { createAccount } from "../utils/accounts";
import {
  AppError,
  asyncHandler,
  normalizeEmail,
  optionalText,
  requirePassword,
  requireText,
} from "../utils/helpers";
import { buildMail } from "../utils/notify";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "staff" | "student";
  is_active: number;
}

const signAccessToken = (user: { id: number; email: string; role: string }) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);

const signRefreshToken = (user: { id: number; email: string; role: string }) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_DAYS}d`,
  } as jwt.SignOptions);

/* ---------------------------------------------------------
   POST /api/auth/register
   ບໍ່ຮັບ role ຈາກ client ເດັດຂາດ — ທຸກຄົນທີ່ສະໝັກເອງເປັນ student
   ສະໝັກແລ້ວລະບົບສ້າງ "ຂໍ້ມູນນັກສຶກສາ" ໃຫ້ພ້ອມ ຈຶ່ງຈອງຫ້ອງ/ແຈ້ງສ້ອມໄດ້ທັນທີ
   (ຖ້າ admin ສ້າງນັກສຶກສາຄົນນີ້ໄວ້ກ່ອນດ້ວຍອີເມວດຽວກັນ → ຕ້ອງໃຫ້ admin ຜູກບັນຊີໃຫ້ເອງ
    ເພື່ອກັນຄົນອື່ນສະໝັກແທນ; response ຈະມີ needsLinking: true)
   ການເລື່ອນເປັນ admin/staff ຕ້ອງໃຫ້ admin ເຮັດຜ່ານ PATCH /api/users/:id/role
   --------------------------------------------------------- */
export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!env.ALLOW_REGISTRATION) {
    throw new AppError(403, "ລະບົບປິດການສະໝັກເອງ ກະລຸນາຕິດຕໍ່ admin ເພື່ອສ້າງບັນຊີ", "REGISTRATION_CLOSED");
  }

  const name = requireText(req.body?.name, "ຊື່", 150);
  const email = normalizeEmail(req.body?.email);
  const password = requirePassword(req.body?.password);
  const phone = optionalText(req.body?.phone, 30);

  const account = await createAccount({ name, email, password, role: "student", phone });

  const created = {
    id: account.userId,
    name,
    email,
    role: "student",
    studentId: account.studentId,
  };
  return res.status(201).json({
    message: account.needsLinking
      ? "ສະໝັກສຳເລັດ ແຕ່ບັນຊີຍັງບໍ່ໄດ້ຜູກກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ admin"
      : "ສະໝັກສະມາຊິກສຳເລັດ",
    data: created,
    user: created,
    needsLinking: account.needsLinking,
  });
});

/* ---------------------------------------------------------
   POST /api/auth/login
   --------------------------------------------------------- */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    throw new AppError(400, "ກະລຸນາປ້ອນ email ແລະ password");
  }

  const [rows] = await pool.query<UserRow[]>(
    "SELECT id, name, email, password, role, is_active FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  const user = rows[0];

  // ໃຊ້ຂໍ້ຄວາມດຽວກັນທັງກໍລະນີບໍ່ພົບອີເມວ ແລະ ລະຫັດຜິດ
  // ເພື່ອບໍ່ໃຫ້ຜູ້ໂຈມຕີເດົາໄດ້ວ່າອີເມວໃດມີຢູ່ໃນລະບົບ (user enumeration)
  if (!user) {
    // ຄຳນວນ hash ຖິ້ມ ເພື່ອໃຫ້ເວລາຕອບໃກ້ຄຽງກັນ (ກັນ timing attack)
    await bcrypt.compare(password, "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY1");
    throw new AppError(401, "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
  }

  if (!user.is_active) {
    throw new AppError(403, "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ ກະລຸນາຕິດຕໍ່ admin");
  }

  const accessToken = signAccessToken(user);
  const refreshTok = signRefreshToken(user);

  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))",
    [user.id, refreshTok, env.REFRESH_TOKEN_DAYS]
  );

  // ລ້າງ token ທີ່ໝົດອາຍຸແລ້ວຂອງຜູ້ໃຊ້ນີ້ (ກັນຕາຕະລາງໃຫຍ່ຂຶ້ນເລື້ອຍໆ)
  pool
    .query("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()", [user.id])
    .catch(() => {});

  const profile = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.status(200).json({
    message: "ເຂົ້າສູ່ລະບົບສຳເລັດ",
    accessToken,
    refreshToken: refreshTok,
    data: profile,
    user: profile,
  });
});

/* ---------------------------------------------------------
   POST /api/auth/logout
   --------------------------------------------------------- */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken;
  if (!token) {
    throw new AppError(400, "ບໍ່ພົບ refresh token");
  }
  await pool.query("DELETE FROM refresh_tokens WHERE token = ?", [token]);
  return res.status(200).json({ message: "ອອກຈາກລະບົບສຳເລັດ" });
});

/* ---------------------------------------------------------
   POST /api/auth/refresh-token
   --------------------------------------------------------- */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken;

  if (!token) {
    throw new AppError(401, "ບໍ່ພົບ refresh token");
  }

  // ກວດ expires_at ນຳ — ກ່ອນແກ້ກວດແຕ່ວ່າ "ມີແຖວຢູ່" ເຮັດໃຫ້ token
  // ທີ່ໝົດອາຍຸໃນ DB ແລ້ວ ຍັງຖືກຮັບເປັນຂອງຖືກຕ້ອງຢູ່
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM refresh_tokens WHERE token = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
    [token]
  );

  if (rows.length === 0) {
    throw new AppError(403, "Refresh token ບໍ່ຖືກຕ້ອງ ຫຼື ຖືກຖອນແລ້ວ", "REFRESH_INVALID");
  }

  let decoded: { id: number };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: number };
  } catch {
    await pool.query("DELETE FROM refresh_tokens WHERE token = ?", [token]);
    throw new AppError(403, "Refresh token ໝົດອາຍຸ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່", "REFRESH_EXPIRED");
  }

  // ດຶງ role ປັດຈຸບັນຈາກ DB ສະເໝີ ບໍ່ໃຊ້ role ເກົ່າທີ່ຝັງຢູ່ໃນ token
  const [userRows] = await pool.query<UserRow[]>(
    "SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1",
    [decoded.id]
  );
  const user = userRows[0];

  if (!user) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }
  if (!user.is_active) {
    throw new AppError(403, "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ ກະລຸນາຕິດຕໍ່ admin");
  }

  return res.status(200).json({
    accessToken: signAccessToken(user),
    data: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

/* ---------------------------------------------------------
   GET /api/auth/me
   ສົ່ງ role / is_active / student_id ກັບມານຳ
   frontend ຕ້ອງໃຊ້ role ເຮັດ route guard ແລະ ຊ່ອນເມນູ admin
   --------------------------------------------------------- */
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            s.id AS student_id, s.avatar_url, s.phone, s.room_id,
            r.room_number, b.name AS building_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN buildings b ON b.id = r.building_id
      WHERE u.id = ? LIMIT 1`,
    [req.user?.id]
  );
  const user = rows[0];

  if (!user) {
    throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");
  }

  return res.status(200).json({ data: user, user });
});


/* ---------------------------------------------------------
   PUT /api/auth/change-password   (ຕ້ອງ login)
   body: { currentPassword, newPassword }
   ສຳເລັດ → ຖອນ refresh token ທຸກອັນ (ທຸກອຸປະກອນຕ້ອງ login ໃໝ່)
   --------------------------------------------------------- */
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = requirePassword(req.body?.newPassword, "ລະຫັດຜ່ານໃໝ່");

  if (!currentPassword) throw new AppError(400, "ກະລຸນາປ້ອນລະຫັດຜ່ານປັດຈຸບັນ");
  if (currentPassword === newPassword) {
    throw new AppError(400, "ລະຫັດຜ່ານໃໝ່ຕ້ອງບໍ່ຄືກັບລະຫັດເກົ່າ");
  }

  const [rows] = await pool.query<UserRow[]>("SELECT id, password FROM users WHERE id = ? LIMIT 1", [
    req.user?.id,
  ]);
  const user = rows[0];
  if (!user) throw new AppError(404, "ບໍ່ພົບຜູ້ໃຊ້");

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new AppError(400, "ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ", "WRONG_PASSWORD");

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password = ? WHERE id = ?", [hash, user.id]);
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = ?", [user.id]);

  return res.status(200).json({ message: "ປ່ຽນລະຫັດຜ່ານສຳເລັດ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່" });
});

/* ---------------------------------------------------------
   POST /api/auth/forgot-password   body: { email }
   - ຕອບຄືກັນສະເໝີ ບໍ່ວ່າອີເມວຈະມີໃນລະບົບຫຼືບໍ່ (ກັນການເດົາວ່າໃຜມີບັນຊີ)
   - ເກັບແຕ່ hash (sha256) ຂອງ token ໃນຖານຂໍ້ມູນ, token ຈິງສົ່ງທາງອີເມວເທົ່ານັ້ນ
   - ບໍ່ໄດ້ຕັ້ງ SMTP: ຕອນ dev/test ສົ່ງ resetToken ກັບມາໃນ response ເພື່ອທົດສອບ,
     ສ່ວນ production ຈະບໍ່ສົ່ງອອກ (admin ໃຊ້ PATCH /api/users/:id/password ແທນ)
   --------------------------------------------------------- */
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const generic = {
    message: "ຖ້າອີເມວນີ້ມີໃນລະບົບ ເຮົາໄດ້ສົ່ງລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ແລ້ວ (ລິ້ງໃຊ້ໄດ້ຊົ່ວໄລຍະສັ້ນໆ)",
  };

  const [rows] = await pool.query<UserRow[]>(
    "SELECT id, name, email, is_active FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  const user = rows[0];
  if (!user || !user.is_active) return res.status(200).json(generic);

  const token = crypto.randomBytes(32).toString("hex");
  // ເຮັດໃຫ້ token ເກົ່າທີ່ຍັງບໍ່ໄດ້ໃຊ້ໃຊ້ບໍ່ໄດ້ອີກ
  await pool.query("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", [user.id]);
  await pool.query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
    [user.id, hashToken(token), env.RESET_TOKEN_MINUTES]
  );

  const link = `${env.APP_URL}/#/reset-password?token=${token}`;

  if (isMailEnabled()) {
    void sendMail(
      buildMail(
        user.email,
        "ຕັ້ງລະຫັດຜ່ານໃໝ່",
        `ສະບາຍດີ ${user.name},\n\nກົດລິ້ງລຸ່ມນີ້ເພື່ອຕັ້ງລະຫັດຜ່ານໃໝ່ (ໃຊ້ໄດ້ ${env.RESET_TOKEN_MINUTES} ນາທີ):\n${link}\n\n` +
          `ຖ້າເຈົ້າບໍ່ໄດ້ຂໍ ໃຫ້ບໍ່ຕ້ອງສົນໃຈອີເມວນີ້.`
      )
    );
    return res.status(200).json(generic);
  }

  if (!env.IS_PROD) {
    console.log(`\n🔑 [dev] ລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່ຂອງ ${user.email}:\n   ${link}\n`);
    return res.status(200).json({ ...generic, resetToken: token, resetLink: link });
  }

  console.warn(
    `⚠️ ມີຄົນຂໍ reset ລະຫັດຜ່ານ (${user.email}) ແຕ່ຍັງບໍ່ໄດ້ຕັ້ງ SMTP — ໃຫ້ admin ຕັ້ງລະຫັດໃຫ້ຜ່ານ PATCH /api/users/:id/password`
  );
  return res.status(200).json(generic);
});

/* ---------------------------------------------------------
   POST /api/auth/reset-password   body: { token, newPassword }
   --------------------------------------------------------- */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token ?? "").trim();
  const newPassword = requirePassword(req.body?.newPassword, "ລະຫັດຜ່ານໃໝ່");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new AppError(400, "ລິ້ງຕັ້ງລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ", "RESET_INVALID");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
        LIMIT 1 FOR UPDATE`,
      [hashToken(token)]
    );
    const reset = rows[0];
    if (!reset) {
      throw new AppError(400, "ລິ້ງຕັ້ງລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ", "RESET_INVALID");
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await conn.query("UPDATE users SET password = ? WHERE id = ?", [hash, reset.user_id]);
    await conn.query("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [reset.id]);
    await conn.query("DELETE FROM refresh_tokens WHERE user_id = ?", [reset.user_id]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return res.status(200).json({ message: "ຕັ້ງລະຫັດຜ່ານໃໝ່ສຳເລັດ ກະລຸນາເຂົ້າສູ່ລະບົບ" });
});
