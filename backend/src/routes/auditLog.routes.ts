import { Router } from "express";
import { getAuditLogs } from "../controllers/auditLog.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, requireRole("admin"), getAuditLogs);

export default router;
