import { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  getPaymentsByStudent,
  updatePaymentStatus,
  generateMonthlyInvoices,
  sendOverdueReminders,
  getInvoice,
  getReceipt,
} from "../controllers/payment.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// NOTE: ເສັ້ນທາງທີ່ເປັນຄຳສະເພາະ (/student/:id, /generate-monthly ...) ຕ້ອງລົງທະບຽນກ່ອນ /:id
// ບໍ່ດັ່ງນັ້ນ Express ຈະຈັບຄຳວ່າ "student" ເປັນຄ່າຂອງ :id
router.get("/", authMiddleware, requireRole("admin", "staff"), getAllPayments);
router.get("/student/:studentId", authMiddleware, getPaymentsByStudent);
router.post("/generate-monthly", authMiddleware, requireRole("admin"), generateMonthlyInvoices);
router.post("/send-reminders", authMiddleware, requireRole("admin"), sendOverdueReminders);
router.get("/:id/invoice", authMiddleware, getInvoice);
router.get("/:id/receipt", authMiddleware, getReceipt);
router.get("/:id", authMiddleware, getPaymentById);
router.post("/", authMiddleware, requireRole("admin", "staff"), createPayment);
router.put("/:id/status", authMiddleware, requireRole("admin", "staff"), updatePaymentStatus);

export default router;
