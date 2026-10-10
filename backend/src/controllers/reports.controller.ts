import { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { AppError, asyncHandler } from "../utils/helpers";

// ກວດຮູບແບບວັນທີ YYYY-MM-DD ຂອງ query ?from= &to=
const optionalDate = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD`);
  }
  return text;
};

/* ---------------------------------------------------------
   GET /api/reports/occupancy  (admin ເທົ່ານັ້ນ)
   ເພີ່ມ: ຈຳນວນຫ້ອງທັງໝົດ, ບ່ອນນອນທັງໝົດ ແລະ ອັດຕາການເຂົ້າພັກເປັນ %
   ຂອງເກົ່າສົ່ງແຕ່ຈຳນວນ booking ເຊິ່ງເຮັດ dashboard ບໍ່ໄດ້
   --------------------------------------------------------- */
export const getOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
  const [[roomStats]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalRooms,
            COALESCE(SUM(capacity), 0) AS totalBeds,
            SUM(status = 'maintenance') AS maintenanceRooms
       FROM rooms`
  );

  const [[bookingStats]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalBookings,
            SUM(status IN ('pending','active')) AS activeBookings
       FROM bookings`
  );

  // ຈຳນວນຜູ້ພັກຈິງ ນັບຈາກ students.room_id (ແຫຼ່ງຄວາມຈິງດຽວຂອງລະບົບ)
  const [[occStats]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalOccupants
       FROM students WHERE room_id IS NOT NULL AND status = 'active'`
  );

  const [[fullStats]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS fullRooms FROM rooms r
      WHERE r.status <> 'maintenance'
        AND (SELECT COUNT(*) FROM students st
              WHERE st.room_id = r.id AND st.status = 'active') >= r.capacity`
  );

  const [statusRows] = await pool.query<RowDataPacket[]>(
    "SELECT status, COUNT(*) AS count FROM bookings GROUP BY status"
  );

  const [occupiedRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT room_id FROM students WHERE room_id IS NOT NULL AND status = 'active'"
  );

  const [byBuildingRows] = await pool.query<RowDataPacket[]>(
    `SELECT b.id AS building_id, b.name AS building_name,
            COUNT(r.id) AS rooms,
            COALESCE(SUM(r.capacity), 0) AS beds,
            COALESCE(SUM((SELECT COUNT(*) FROM students st
                           WHERE st.room_id = r.id
                             AND st.status = 'active')), 0) AS occupants
       FROM buildings b
       LEFT JOIN rooms r ON r.building_id = b.id
      GROUP BY b.id, b.name
      ORDER BY b.id`
  );

  const bookingsByStatus: Record<string, number> = {};
  for (const row of statusRows) {
    bookingsByStatus[row.status] = Number(row.count);
  }

  const totalBeds = Number(roomStats.totalBeds);
  const activeBookings = Number(bookingStats.activeBookings ?? 0);
  const totalOccupants = Number(occStats.totalOccupants ?? 0);

  return res.status(200).json({
    data: {
      totalRooms: Number(roomStats.totalRooms),
      totalBeds,
      maintenanceRooms: Number(roomStats.maintenanceRooms ?? 0),
      totalBookings: Number(bookingStats.totalBookings),
      activeBookings,
      totalOccupants,
      occupiedRooms: occupiedRows.length,
      fullRooms: Number(fullStats.fullRooms ?? 0),
      availableBeds: Math.max(0, totalBeds - totalOccupants),
      // ປັດເປັນ 2 ຕຳແໜ່ງ ແລະ ກັນການຫານດ້ວຍ 0 ຕອນຍັງບໍ່ມີຫ້ອງເລີຍ
      occupancyRate: totalBeds > 0 ? Number(((totalOccupants / totalBeds) * 100).toFixed(2)) : 0,
      bookingsByStatus,
      byBuilding: byBuildingRows.map((r) => ({
        buildingId: r.building_id,
        buildingName: r.building_name,
        rooms: Number(r.rooms),
        beds: Number(r.beds),
        occupants: Number(r.occupants),
        occupancyRate:
          Number(r.beds) > 0
            ? Number(((Number(r.occupants) / Number(r.beds)) * 100).toFixed(2))
            : 0,
      })),
    },
  });
});

/* ---------------------------------------------------------
   GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD  (admin)

   ແກ້ບັກສຳຄັນ: payment_date ເປັນ DATETIME ແຕ່ ?to= ເປັນ DATE
   ເງື່ອນໄຂເກົ່າ "payment_date <= '2026-12-31'" ຖືກແປເປັນ
   '2026-12-31 00:00:00' ຈຶ່ງຕົກລາຍການຂອງວັນສຸດທ້າຍທັງໝົດ
   ດຽວນີ້ໃຊ້ DATE(payment_date) ເພື່ອປຽບທຽບລະດັບວັນ
   --------------------------------------------------------- */
export const getRevenueReport = asyncHandler(async (req: Request, res: Response) => {
  const from = optionalDate(req.query.from, "from");
  const to = optionalDate(req.query.to, "to");

  if (from && to && from > to) {
    throw new AppError(400, "from ຕ້ອງບໍ່ຫຼັງກວ່າ to");
  }

  let whereSql = "WHERE 1=1";
  const params: any[] = [];
  if (from) {
    whereSql += " AND DATE(payment_date) >= ?";
    params.push(from);
  }
  if (to) {
    whereSql += " AND DATE(payment_date) <= ?";
    params.push(to);
  }

  const [[totals]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS totalRevenue, COUNT(*) AS totalPaidTransactions
       FROM payments ${whereSql} AND status = 'paid'`,
    params
  );

  const [[outstanding]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS outstandingAmount, COUNT(*) AS outstandingCount
       FROM payments ${whereSql} AND status = 'pending'`,
    params
  );

  const [methodRows] = await pool.query<RowDataPacket[]>(
    `SELECT method, COALESCE(SUM(amount), 0) AS total
       FROM payments ${whereSql} AND status = 'paid'
      GROUP BY method`,
    params
  );

  const [statusRows] = await pool.query<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS count FROM payments ${whereSql} GROUP BY status`,
    params
  );

  const [monthRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month,
            COALESCE(SUM(amount), 0) AS total
       FROM payments ${whereSql} AND status = 'paid'
      GROUP BY month
      ORDER BY month`,
    params
  );

  const revenueByMethod: Record<string, number> = {};
  for (const row of methodRows) revenueByMethod[row.method] = Number(row.total);

  const transactionCountByStatus: Record<string, number> = {};
  for (const row of statusRows) transactionCountByStatus[row.status] = Number(row.count);

  return res.status(200).json({
    data: {
      range: { from, to },
      totalRevenue: Number(totals.totalRevenue),
      totalPaidTransactions: Number(totals.totalPaidTransactions),
      outstandingAmount: Number(outstanding.outstandingAmount),
      outstandingCount: Number(outstanding.outstandingCount),
      revenueByMethod,
      transactionCountByStatus,
      // ສຳລັບແຕ້ມກຣາຟລາຍເດືອນຢູ່ dashboard
      monthlyRevenue: monthRows.map((r) => ({ month: r.month, total: Number(r.total) })),
    },
  });
});

/* ---------------------------------------------------------
   GET /api/reports/maintenance-summary  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const getMaintenanceSummary = asyncHandler(async (req: Request, res: Response) => {
  const [[totals]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalRequests,
            SUM(priority = 'urgent' AND status NOT IN ('resolved','cancelled')) AS openUrgentCount,
            SUM(status NOT IN ('resolved','cancelled')) AS openCount
       FROM maintenance_requests`
  );

  const [statusRows] = await pool.query<RowDataPacket[]>(
    "SELECT status, COUNT(*) AS count FROM maintenance_requests GROUP BY status"
  );
  const [priorityRows] = await pool.query<RowDataPacket[]>(
    "SELECT priority, COUNT(*) AS count FROM maintenance_requests GROUP BY priority"
  );

  // ເວລາສະເລ່ຍທີ່ໃຊ້ປິດວຽກ (ຊົ່ວໂມງ) — ວັດຄຸນນະພາບການບໍລິການ
  const [[avgRow]] = await pool.query<RowDataPacket[]>(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
       FROM maintenance_requests WHERE status = 'resolved'`
  );

  const [topRoomRows] = await pool.query<RowDataPacket[]>(
    `SELECT m.room_id, r.room_number, COUNT(*) AS count
       FROM maintenance_requests m
       LEFT JOIN rooms r ON r.id = m.room_id
      GROUP BY m.room_id, r.room_number
      ORDER BY count DESC
      LIMIT 5`
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[row.status] = Number(row.count);

  const byPriority: Record<string, number> = {};
  for (const row of priorityRows) byPriority[row.priority] = Number(row.count);

  return res.status(200).json({
    data: {
      totalRequests: Number(totals.totalRequests),
      openCount: Number(totals.openCount ?? 0),
      openUrgentCount: Number(totals.openUrgentCount ?? 0),
      avgResolutionHours: avgRow.avgHours === null ? null : Number(Number(avgRow.avgHours).toFixed(1)),
      byStatus,
      byPriority,
      topRooms: topRoomRows.map((r) => ({
        roomId: r.room_id,
        roomNumber: r.room_number,
        count: Number(r.count),
      })),
    },
  });
});

/* ---------------------------------------------------------
   GET /api/reports/dashboard  (admin / staff)
   ຕົວເລກສະຫຼຸບສຳລັບໜ້າຫຼັກ (ຍິງເທື່ອດຽວໄດ້ທັງໝົດ ບໍ່ຕ້ອງເອີ້ນຫຼາຍ endpoint)
   --------------------------------------------------------- */
export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const one = async (sql: string) => {
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows[0] ?? {};
  };

  const rooms = await one(
    `SELECT COUNT(*) AS totalRooms,
            COALESCE(SUM(capacity), 0) AS totalBeds,
            COALESCE(SUM(status = 'maintenance'), 0) AS maintenanceRooms
       FROM rooms`
  );
  const occupants = await one(
    "SELECT COUNT(*) AS total FROM students WHERE room_id IS NOT NULL AND status = 'active'"
  );
  const students = await one(
    `SELECT COALESCE(SUM(status = 'active'), 0) AS active,
            COALESCE(SUM(user_id IS NULL), 0) AS unlinked
       FROM students`
  );
  const bookings = await one(
    "SELECT COALESCE(SUM(status = 'pending'), 0) AS pending, COALESCE(SUM(status = 'active'), 0) AS active FROM bookings"
  );
  const payments = await one(
    `SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) AS pendingAmount,
            COALESCE(SUM(status = 'pending'), 0) AS pendingCount,
            COALESCE(SUM(CASE WHEN status = 'pending' AND due_date IS NOT NULL AND due_date < CURDATE() THEN amount END), 0) AS overdueAmount,
            COALESCE(SUM(status = 'pending' AND due_date IS NOT NULL AND due_date < CURDATE()), 0) AS overdueCount,
            COALESCE(SUM(CASE WHEN status = 'paid' AND DATE_FORMAT(payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN amount END), 0) AS revenueThisMonth
       FROM payments`
  );
  const maintenance = await one(
    `SELECT COALESCE(SUM(status IN ('pending','in_progress')), 0) AS open,
            COALESCE(SUM(priority = 'urgent' AND status IN ('pending','in_progress')), 0) AS openUrgent
       FROM maintenance_requests`
  );
  const visitors = await one("SELECT COUNT(*) AS inside FROM visitor_logs WHERE status = 'checked_in'");

  const totalBeds = Number(rooms.totalBeds);
  const totalOccupants = Number(occupants.total);

  return res.status(200).json({
    data: {
      students: { active: Number(students.active), unlinked: Number(students.unlinked) },
      rooms: {
        total: Number(rooms.totalRooms),
        beds: totalBeds,
        occupants: totalOccupants,
        availableBeds: Math.max(0, totalBeds - totalOccupants),
        maintenance: Number(rooms.maintenanceRooms),
        occupancyRate: totalBeds > 0 ? Number(((totalOccupants / totalBeds) * 100).toFixed(2)) : 0,
      },
      bookings: { pending: Number(bookings.pending), active: Number(bookings.active) },
      payments: {
        pendingCount: Number(payments.pendingCount),
        pendingAmount: Number(payments.pendingAmount),
        overdueCount: Number(payments.overdueCount),
        overdueAmount: Number(payments.overdueAmount),
        revenueThisMonth: Number(payments.revenueThisMonth),
      },
      maintenance: { open: Number(maintenance.open), openUrgent: Number(maintenance.openUrgent) },
      visitors: { inside: Number(visitors.inside) },
    },
  });
});
