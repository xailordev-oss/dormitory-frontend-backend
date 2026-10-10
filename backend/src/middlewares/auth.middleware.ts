import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { env } from "../config/env";

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string };
}

/**
 * ກວດ Bearer token ແລະ ແນບ req.user
 *
 * ແຍກ error ອອກເປັນ code ຊັດເຈນ ເພື່ອໃຫ້ frontend ຕັດສິນໃຈໄດ້ວ່າ:
 *  - TOKEN_EXPIRED  → ຍິງ /api/auth/refresh-token ແລ້ວລອງໃໝ່ (ບໍ່ຕ້ອງ logout)
 *  - TOKEN_INVALID  → logout ແລ້ວໃຫ້ login ໃໝ່
 *  - ACCOUNT_DISABLED → ບັນຊີຖືກປິດ (ມີຜົນທັນທີ ບໍ່ຕ້ອງລໍຖ້າ token ໝົດອາຍຸ)
 *
 * ນອກຈາກກວດລາຍເຊັນຂອງ token ແລ້ວ ຍັງກວດຖານຂໍ້ມູນທຸກ request (query ດຽວ ຕາມ primary key):
 *  - ບັນຊີທີ່ຖືກປິດ/ລຶບ ຈະເຂົ້າບໍ່ໄດ້ທັນທີ (ເມື່ອກ່ອນ token ເກົ່າຍັງໃຊ້ໄດ້ຈົນໝົດ 15 ນາທີ)
 *  - ໃຊ້ role ປັດຈຸບັນຈາກຖານຂໍ້ມູນ ບໍ່ແມ່ນ role ທີ່ຝັງໃນ token (ປ່ຽນ role ມີຜົນທັນທີ)
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "ບໍ່ພົບ Token, ກະລຸນາເຂົ້າສູ່ລະບົບ",
      code: "TOKEN_MISSING",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ message: "Token ວ່າງເປົ່າ", code: "TOKEN_MISSING" });
  }

  let payload: { id: number; email: string; role: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as typeof payload;
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token ໝົດອາຍຸແລ້ວ",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      message: "Token ບໍ່ຖືກຕ້ອງ",
      code: "TOKEN_INVALID",
    });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1",
      [payload.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: "ບໍ່ພົບບັນຊີຜູ້ໃຊ້ນີ້ແລ້ວ", code: "TOKEN_INVALID" });
    }
    if (!user.is_active) {
      return res.status(403).json({
        message: "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ ກະລຸນາຕິດຕໍ່ admin",
        code: "ACCOUNT_DISABLED",
      });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * ຈຳກັດສິດຕາມ role — ໃຊ້ຫຼັງ authMiddleware ສະເໝີ
 * ຕົວຢ່າງ: router.post("/", authMiddleware, requireRole("admin"), createRoom)
 *          router.get("/", authMiddleware, requireRole("admin", "staff"), listStudents)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "ກະລຸນາເຂົ້າສູ່ລະບົບ",
        code: "TOKEN_MISSING",
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງ resource ນີ້",
        code: "FORBIDDEN",
        requiredRole: allowedRoles,
      });
    }
    return next();
  };
};

/** ທາງລັດ: admin ຫຼື staff */
export const requireStaff = requireRole("admin", "staff");
