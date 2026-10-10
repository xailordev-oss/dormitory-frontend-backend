import fs from "fs";
import path from "path";
import { Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { AuthRequest } from "../middlewares/auth.middleware";
import { UPLOAD_ROOT } from "../middlewares/upload.middleware";
import { AppError, asyncHandler, optionalText, requireText } from "../utils/helpers";

interface StudentRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  room_id: number | null;
  status: "active" | "inactive";
}

const findStudentByUserId = async (userId: number) => {
  const [rows] = await pool.query<StudentRow[]>(
    `SELECT s.*, r.room_number, r.price AS room_price, b.name AS building_name
       FROM students s
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN buildings b ON b.id = r.building_id
      WHERE s.user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const requireLinkedStudent = async (req: AuthRequest) => {
  if (!req.user?.id) {
    throw new AppError(401, "ກະລຸນາເຂົ້າສູ່ລະບົບ");
  }
  const student = await findStudentByUserId(req.user.id);
  if (!student) {
    throw new AppError(
      404,
      "ບັນຊີນີ້ຍັງບໍ່ໄດ້ຖືກເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ"
    );
  }
  return student;
};

/* GET /api/students/me/profile */
export const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await requireLinkedStudent(req);
  return res.status(200).json({ data: student, student });
});

/* ---------------------------------------------------------
   PUT /api/students/me/profile
   ອະນຸຍາດແກ້ສະເພາະ name / phone
   ບໍ່ໃຫ້ແກ້ email, room_id ຫຼື status ເອງ — ເປັນສິດຂອງ admin
   --------------------------------------------------------- */
export const updateMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await requireLinkedStudent(req);

  const name =
    req.body?.name !== undefined ? requireText(req.body.name, "ຊື່", 150) : student.name;
  const phone =
    req.body?.phone !== undefined ? optionalText(req.body.phone, 30) : student.phone;

  // ແຈ້ງເຕືອນຖ້າພະຍາຍາມສົ່ງ field ທີ່ບໍ່ອະນຸຍາດມາ ເພື່ອບໍ່ໃຫ້ເຂົ້າໃຈຜິດວ່າບັນທຶກແລ້ວ
  const blocked = ["email", "roomId", "room_id", "status", "userId"].filter(
    (key) => req.body?.[key] !== undefined
  );

  await pool.query("UPDATE students SET name = ?, phone = ? WHERE id = ?", [
    name,
    phone,
    student.id,
  ]);

  const updated = await findStudentByUserId(req.user!.id);
  return res.status(200).json({
    message: "ອັບເດດໂປຣໄຟລ໌ສຳເລັດ",
    ...(blocked.length > 0 && {
      warning: `field ເຫຼົ່ານີ້ແກ້ເອງບໍ່ໄດ້ ຈຶ່ງຖືກຂ້າມ: ${blocked.join(", ")} (ຕິດຕໍ່ admin)`,
    }),
    data: updated,
    student: updated,
  });
});

/* ---------------------------------------------------------
   POST /api/students/me/avatar  (multipart/form-data, field = "avatar")
   ແກ້: route ນີ້ບໍ່ມີ :entityType ໃນ URL ຈຶ່ງຖືກ multer ເກັບລົງ uploads/misc
        ແຕ່ code ບັນທຶກ URL ເປັນ /uploads/students/... → ຮູບເປີດບໍ່ຂຶ້ນ 404
        ດຽວນີ້ຍ້າຍໄຟລ໌ໄປ uploads/students ໃຫ້ກົງກັບ URL ທີ່ບັນທຶກ
   --------------------------------------------------------- */
export const uploadMyAvatar = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await requireLinkedStudent(req);

  if (!req.file) {
    throw new AppError(400, "ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ (field: avatar)");
  }

  const targetDir = path.join(UPLOAD_ROOT, "students");
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, req.file.filename);
  if (path.resolve(req.file.path) !== path.resolve(targetPath)) {
    fs.renameSync(req.file.path, targetPath);
  }

  const newAvatarUrl = `/uploads/students/${req.file.filename}`;

  // ລຶບຮູບເກົ່າອອກຈາກ disk (ກັນໄຟລ໌ຄ້າງ) — ກວດ path ກ່ອນເພື່ອກັນ path traversal
  if (student.avatar_url) {
    const oldPath = path.join(UPLOAD_ROOT, student.avatar_url.replace("/uploads/", ""));
    if (path.resolve(oldPath).startsWith(path.resolve(UPLOAD_ROOT))) {
      fs.unlink(oldPath, () => {});
    }
  }

  await pool.query("UPDATE students SET avatar_url = ? WHERE id = ?", [newAvatarUrl, student.id]);

  const updated = await findStudentByUserId(req.user!.id);
  return res.status(200).json({
    message: "ອັບໂຫລດຮູບໂປຣໄຟລ໌ສຳເລັດ",
    data: updated,
    student: updated,
  });
});
