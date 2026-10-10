import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

// ໂຟນເດີເກັບໄຟລ໌ອັບໂຫລດ — ຢູ່ນອກ src ເພື່ອບໍ່ໃຫ້ tsx watch ເຮັດວຽກຊ້ຳ
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

["rooms", "buildings", "students", "misc"].forEach((sub) =>
  ensureDir(path.join(UPLOAD_ROOT, sub))
);

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const entityType = String(req.params.entityType || "").toLowerCase();
    const allowed = ["rooms", "buildings", "students"];
    const folder = allowed.includes(entityType) ? entityType : "misc";
    const dest = path.join(UPLOAD_ROOT, folder);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    // ບໍ່ໃຊ້ຊື່ໄຟລ໌ເດີມເລີຍ — ກັນ path traversal (ເຊັ່ນ "../../etc/passwd.jpg")
    // ແລະ ກັນຊື່ຊ້ຳກັນ. ເອົາແຕ່ນາມສະກຸນທີ່ຜ່ານການກວດແລ້ວ
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // ກວດທັງ mimetype ແລະ ນາມສະກຸນ — client ປອມ mimetype ໄດ້ງ່າຍ
  if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXT.includes(ext)) {
    const error: any = new Error(
      "ຮອງຮັບສະເພາະໄຟລ໌ຮູບພາບ (jpg, jpeg, png, webp) ເທົ່ານັ້ນ"
    );
    error.code = "INVALID_FILE_TYPE";
    return cb(error);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});
