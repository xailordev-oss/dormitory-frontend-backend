import { Router } from "express";
import {
  getAllMaintenances,
  createMaintenance,
  updateMaintenanceStatus,
  deleteMaintenance,
} from "../controllers/maintenance.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ນັກສຶກສາແຈ້ງສ້ອມແປງເອງໄດ້ ແລະ ເບິ່ງໄດ້ສະເພາະຂອງຕົນ/ຫ້ອງຕົນ
router.get("/", authMiddleware, getAllMaintenances);
router.post("/", authMiddleware, createMaintenance);

// ການປ່ຽນສະຖານະ: admin + staff | ລຶບ: ສະເພາະ admin
router.put("/:id/status", authMiddleware, requireRole("admin", "staff"), updateMaintenanceStatus);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteMaintenance);

export default router;
