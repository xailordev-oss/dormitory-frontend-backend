import { Router } from "express";
import {
  getDashboard,
  getOccupancyReport,
  getRevenueReport,
  getMaintenanceSummary,
} from "../controllers/reports.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ໜ້າຫຼັກ: admin ແລະ staff ເບິ່ງໄດ້
router.get("/dashboard", authMiddleware, requireRole("admin", "staff"), getDashboard);

// ລາຍງານເຊີງການເງິນ/ວິເຄາະ: ສະເພາະ admin
router.get("/occupancy", authMiddleware, requireRole("admin"), getOccupancyReport);
router.get("/revenue", authMiddleware, requireRole("admin"), getRevenueReport);
router.get("/maintenance-summary", authMiddleware, requireRole("admin"), getMaintenanceSummary);

export default router;
