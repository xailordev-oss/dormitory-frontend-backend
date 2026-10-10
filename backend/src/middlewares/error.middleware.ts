import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/helpers";
import { env } from "../config/env";

/**
 * ຈັບ request ທີ່ບໍ່ກົງກັບ route ໃດເລີຍ
 * ຕ້ອງໃສ່ຫຼັງ app.use() ຂອງທຸກ route ແຕ່ກ່ອນ errorHandler
 *
 * ເຫດຜົນ: Express ແບບ default ຈະຕອບເປັນ HTML ເຮັດໃຫ້ frontend
 * ທີ່ເອີ້ນ response.json() ພັງດ້ວຍ SyntaxError ແທນທີ່ຈະໄດ້ຂໍ້ຄວາມຊັດເຈນ
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({
    message: `ບໍ່ພົບ endpoint: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
};

/**
 * Error handler ກາງ — ຕ້ອງເປັນ middleware ສຸດທ້າຍ ແລະ ຕ້ອງມີ 4 arguments
 * ຈັດການ: AppError, multer error, JSON parse error, MySQL error ແລະ ອື່ນໆ
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // 1) JSON body ຜິດຮູບແບບ (ເຊັ່ນ {{variable}} ໃນ test.http ຍັງບໍ່ຖືກແທນຄ່າ)
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({
      message: "JSON body ບໍ່ຖືກຕ້ອງ (ອາດມີຕົວແປ {{...}} ທີ່ຍັງບໍ່ຖືກແທນຄ່າ)",
      code: "INVALID_JSON",
      path: req.originalUrl,
      rawBody: env.IS_PROD ? undefined : (req as any).rawBody,
    });
  }

  // 2) ຂໍ້ຜິດພາດຈາກ multer (ອັບໂຫລດໄຟລ໌)
  //    ກ່ອນແກ້: error ເຫຼົ່ານີ້ຫຼຸດໄປເປັນ HTML 500 — frontend ບອກຜູ້ໃຊ້ບໍ່ໄດ້ວ່າຜິດຫຍັງ
  if (err instanceof multer.MulterError) {
    const map: Record<string, string> = {
      LIMIT_FILE_SIZE: "ໄຟລ໌ໃຫຍ່ເກີນ 5MB",
      LIMIT_FILE_COUNT: "ອັບໂຫລດໄຟລ໌ໄດ້ເທື່ອລະ 1 ໄຟລ໌ເທົ່ານັ້ນ",
      LIMIT_UNEXPECTED_FILE: `ຊື່ field ຂອງໄຟລ໌ບໍ່ຖືກຕ້ອງ (ໄດ້ຮັບ: ${err.field})`,
    };
    return res.status(400).json({
      message: map[err.code] || `ອັບໂຫລດບໍ່ສຳເລັດ: ${err.code}`,
      code: err.code,
    });
  }

  // 3) ໄຟລ໌ຜິດປະເພດ (ໂຍນມາຈາກ fileFilter)
  if (err?.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({ message: err.message, code: err.code });
  }

  // 4) AppError ທີ່ controller ໂຍນມາເອງ
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  // 5) ຂໍ້ຜິດພາດຈາກ MySQL ທີ່ຄາດເດົາໄດ້ → ແປເປັນ status ທີ່ເໝາະສົມ
  //    (ກັນບໍ່ໃຫ້ກາຍເປັນ 500 ທັງໝົດ ແລະ ກັນການຮົ່ວ SQL ອອກໄປໃຫ້ client)
  const sqlMap: Record<string, { status: number; message: string }> = {
    ER_DUP_ENTRY: { status: 409, message: "ຂໍ້ມູນນີ້ມີຢູ່ໃນລະບົບແລ້ວ (ຄ່າຊ້ຳກັນ)" },
    ER_NO_REFERENCED_ROW_2: { status: 400, message: "ອ້າງອີງຂໍ້ມູນທີ່ບໍ່ມີຢູ່ຈິງ" },
    ER_ROW_IS_REFERENCED_2: {
      status: 409,
      message: "ລຶບບໍ່ໄດ້ ຍ້ອນຍັງມີຂໍ້ມູນອື່ນອ້າງອີງຢູ່",
    },
    ER_DATA_TOO_LONG: { status: 400, message: "ຂໍ້ມູນຍາວເກີນທີ່ກຳນົດໄວ້" },
    ECONNREFUSED: { status: 503, message: "ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ ກະລຸນາກວດວ່າ MySQL ແລ່ນຢູ່" },
    PROTOCOL_CONNECTION_LOST: { status: 503, message: "ການເຊື່ອມຕໍ່ຖານຂໍ້ມູນຂາດ" },
  };
  const mapped = sqlMap[err?.code];
  if (mapped) {
    console.error(`[${err.code}] ${req.method} ${req.originalUrl}:`, err.sqlMessage || err.message);
    return res.status(mapped.status).json({ message: mapped.message, code: err.code });
  }

  // 6) ອື່ນໆທັງໝົດ → 500 (log ເຕັມຢູ່ server, ສົ່ງລາຍລະອຽດໃຫ້ client ສະເພາະຕອນ dev)
  console.error(`❌ ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    message: "ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ",
    code: "INTERNAL_ERROR",
    error: env.IS_PROD ? undefined : String(err?.message || err),
  });
};
