import { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { AppError, asyncHandler, requirePositiveInt } from "../utils/helpers";

interface AuditLogRow extends RowDataPacket {
  id: number;
  admin_id: number | null;
  admin_email: string | null;
  method: string;
  path: string;
  status_code: number | null;
  ip_address: string | null;
  created_at: string;
}

/* ---------------------------------------------------------
   GET /api/audit-logs  (admin ເທົ່ານັ້ນ)
   ?adminId= &method= &from= &to= &limit= &page=
   ເພີ່ມ pagination ເພາະຕາຕະລາງນີ້ໃຫຍ່ຂຶ້ນທຸກໆ request ທີ່ admin ເຮັດ
   --------------------------------------------------------- */
export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { adminId, method, from, to } = req.query;

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  let whereSql = "WHERE 1=1";
  const params: any[] = [];

  if (adminId) {
    whereSql += " AND admin_id = ?";
    params.push(requirePositiveInt(adminId, "adminId"));
  }
  if (method) {
    const m = String(method).toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(m)) {
      throw new AppError(400, "method ຕ້ອງເປັນ POST, PUT, PATCH ຫຼື DELETE");
    }
    whereSql += " AND method = ?";
    params.push(m);
  }
  if (from) {
    whereSql += " AND DATE(created_at) >= ?";
    params.push(String(from));
  }
  if (to) {
    whereSql += " AND DATE(created_at) <= ?";
    params.push(String(to));
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
    params
  );

  const [result] = await pool.query<AuditLogRow[]>(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = Number(countRow.total);
  return res.status(200).json({
    data: result,
    total,            // ຈຳນວນທັງໝົດທີ່ກົງເງື່ອນໄຂ (ບໍ່ແມ່ນສະເພາະໜ້ານີ້)
    count: result.length,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
});
