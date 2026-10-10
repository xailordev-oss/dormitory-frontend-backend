import { Router } from "express";
import {
  checkInVisitor,
  checkOutVisitor,
  getVisitorLogs,
} from "../controllers/visitor.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ການຈັດການຜູ້ມາຢ້ຽມຢາມ (check-in/check-out/ເບິ່ງ log) ມີຂໍ້ມູນສ່ວນຕົວ (ເລກບັດ, ເບີໂທ)
// ຂອງທັງແຂກ ແລະ ນັກສຶກສາ ຈຶ່ງສະຫງວນໄວ້ສະເພາະ admin ແລະ staff (ພະນັກງານໜ້າຫໍ)
router.post("/check-in", authMiddleware, requireRole("admin", "staff"), checkInVisitor);
router.post("/check-out", authMiddleware, requireRole("admin", "staff"), checkOutVisitor);
router.get("/logs", authMiddleware, requireRole("admin", "staff"), getVisitorLogs);

export default router;
