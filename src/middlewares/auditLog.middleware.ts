import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import { AuthRequest } from "./auth.middleware";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// path ທີ່ບໍ່ຕ້ອງການບັນທຶກ (ບໍ່ມີປະໂຫຍດຕໍ່ການກວດສອບ ແລະ ເຮັດໃຫ້ table ໃຫຍ່ໄວ)
const SKIP_PATHS = [
  "/api/auth/login",
  "/api/auth/refresh-token",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// ຂໍ້ມູນລັບ: ບໍ່ເກັບ query string (ອາດມີ token) ໃນ log
const cleanPath = (url: string) => url.split("?")[0].slice(0, 255);

/**
 * ບັນທຶກທຸກ request ທີ່ແກ້ໄຂຂໍ້ມູນ (POST/PUT/PATCH/DELETE) ຊຶ່ງເຮັດໂດຍ admin ຫຼື staff
 *
 * middleware ນີ້ຕິດຕັ້ງກ່ອນ routes ແຕ່ req.user ຈະຖືກຕັ້ງຄ່າໂດຍ authMiddleware
 * ພາຍຫຼັງ — ເຮັດວຽກໄດ້ຍ້ອນອ່ານ req.user ຕອນ event "finish" (ຫຼັງສົ່ງ response ແລ້ວ)
 */
export const auditLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.originalUrl.startsWith(p))) return next();

  res.on("finish", () => {
    const user = (req as AuthRequest).user;

    // ບັນທຶກສະເພາະການກະທຳຂອງ admin / staff (ບໍ່ບັນທຶກການກະທຳຂອງນັກສຶກສາ)
    if (!user || (user.role !== "admin" && user.role !== "staff")) return;

    // ບໍ່ບັນທຶກ request ທີ່ລົ້ມເຫຼວດ້ວຍ 4xx ຈາກການ validate (ບໍ່ໄດ້ປ່ຽນຂໍ້ມູນຫຍັງ)
    if (res.statusCode >= 400 && res.statusCode < 500) return;

    pool
      .query(
        `INSERT INTO audit_logs (admin_id, admin_email, role, method, path, status_code, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.email,
          user.role,
          req.method,
          cleanPath(req.originalUrl),
          res.statusCode,
          (req.ip ?? "").slice(0, 64) || null,
        ]
      )
      .catch((error) => {
        // audit log ລົ້ມເຫຼວຕ້ອງບໍ່ກະທົບ request ຫຼັກ
        console.error("⚠️ ບັນທຶກ audit log ບໍ່ສຳເລັດ:", error?.message || error);
      });
  });

  next();
};
