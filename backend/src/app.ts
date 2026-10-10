import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env"; // ກວດ env ກ່ອນສິ່ງອື່ນທັງໝົດ
import pool from "./config/db";
import { UPLOAD_ROOT } from "./middlewares/upload.middleware";
import { auditLogMiddleware } from "./middlewares/auditLog.middleware";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware";

import authRoutes from "./routes/auth.routes";
import studentRoutes from "./routes/student.routes";
import buildingRoutes from "./routes/building.routes";
import roomRoutes from "./routes/room.routes";
import bookingRoutes from "./routes/booking.routes";
import paymentRoutes from "./routes/payment.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import visitorRoutes from "./routes/visitor.routes";
import notificationRoutes from "./routes/notification.routes";
import reportsRoutes from "./routes/reports.routes";
import imageRoutes from "./routes/image.routes";
import userRoutes from "./routes/user.routes";
import auditLogRoutes from "./routes/auditLog.routes";

/**
 * ສ້າງ Express app (ແຍກອອກຈາກ index.ts ເພື່ອໃຫ້ automated test ໂຫຼດ app ໄດ້
 * ໂດຍບໍ່ຕ້ອງເປີດ port ຈິງ)
 */
const app = express();

// ອ່ານ IP ຈິງຂອງ client ໄດ້ຖືກຕ້ອງເມື່ອຢູ່ຫຼັງ nginx/reverse proxy (ໃຊ້ໃນ audit log ແລະ rate limit)
app.set("trust proxy", env.TRUST_PROXY > 0 ? env.TRUST_PROXY : false);

/* ---------------------------------------------------------
   Security headers (helmet)
   - CSP: ໜ້າເວັບໃນ public/ ໃຊ້ໄດ້ (ສະຄຣິບ/ຮູບແບບຈາກ server ເອງ + Google Fonts)
   - crossOriginResourcePolicy = cross-origin ເພື່ອໃຫ້ frontend ຢູ່ domain ອື່ນໂຫຼດຮູບຈາກ /uploads ໄດ້
   --------------------------------------------------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        // ບໍ່ບັງຄັບ https ຕອນຮັນຜ່ານ http://localhost
        "upgrade-insecure-requests": null,
      },
    },
  })
);

/* ---------------------------------------------------------
   CORS
   ຖ້າບໍ່ໄດ້ຕັ້ງ CORS_ORIGIN:
     - dev  → ອະນຸຍາດທຸກ origin (ສະດວກຕອນພັດທະນາ)
     - prod → ປະຕິເສດ ແລະ ເຕືອນ (ກັນການເປີດກວ້າງໂດຍບໍ່ຕັ້ງໃຈ)
   ໜ້າເວັບທີ່ server ເປີດໃຫ້ເອງ (same-origin) ບໍ່ຕ້ອງໃຊ້ CORS
   --------------------------------------------------------- */
const allowedOrigins = env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);

if (env.IS_PROD && (!allowedOrigins || allowedOrigins.length === 0)) {
  console.warn("⚠️ ຍັງບໍ່ໄດ້ຕັ້ງ CORS_ORIGIN ໃນ production — browser ພາຍນອກຈະຖືກປະຕິເສດ (ໜ້າເວັບຂອງ server ເອງຍັງໃຊ້ໄດ້)");
}

app.use(
  cors({
    origin(origin, callback) {
      // request ທີ່ບໍ່ມີ origin (Postman, curl, mobile app) ຜ່ານໄດ້ສະເໝີ
      if (!origin) return callback(null, true);
      if (!allowedOrigins || allowedOrigins.length === 0) {
        return callback(null, !env.IS_PROD);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

/* ---------------------------------------------------------
   Rate limiting — ກັນການເດົາລະຫັດ ແລະ ການຍິງ API ຖີ່ເກີນໄປ
   ປິດໄດ້ດ້ວຍ RATE_LIMIT_ENABLED=false ໃນ .env
   --------------------------------------------------------- */
const passthrough: express.RequestHandler = (_req, _res, next) => next();

const makeLimiter = (opts: { windowMs: number; limit: number; message: string; skipSuccessfulRequests?: boolean }) =>
  env.RATE_LIMIT_ENABLED
    ? rateLimit({
        windowMs: opts.windowMs,
        limit: opts.limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
        message: { message: opts.message, code: "RATE_LIMITED" },
      })
    : passthrough;

const apiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_MAX,
  message: "ສົ່ງ request ຖີ່ເກີນໄປ ກະລຸນາລໍຖ້າສັກຄູ່ແລ້ວລອງໃໝ່",
});
// login: ນັບສະເພາະເທື່ອທີ່ລົ້ມເຫຼວ (ໃສ່ລະຫັດຜິດ) — ຜູ້ໃຊ້ປົກກະຕິທີ່ login ສຳເລັດບໍ່ຖືກນັບ
const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  message: "ພະຍາຍາມເຂົ້າສູ່ລະບົບຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່",
});
const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  message: "ສົ່ງ request ຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່",
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

app.use(
  express.json({
    limit: "1mb", // ກັນການສົ່ງ body ໃຫຍ່ຜິດປົກກະຕິ
    verify: (req: any, _res, buf) => {
      // ເກັບ raw body ໄວ້ສະແດງໃນ error handler ເມື່ອ JSON parse ບໍ່ຜ່ານ
      req.rawBody = buf.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ບັນທຶກການກະທຳຂອງ admin / staff ລົງ audit_logs
app.use(auditLogMiddleware);

// ເປີດໄຟລ໌ຮູບທີ່ອັບໂຫລດແລ້ວຜ່ານ URL ເຊັ່ນ http://localhost:3000/uploads/rooms/xxx.jpg
app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    maxAge: "7d",
    // ບໍ່ໃຫ້ browser ລອງເດົາຊະນິດໄຟລ໌ເອງ ແລະ ບໍ່ສະແດງລາຍການໄຟລ໌ໃນໂຟນເດີ
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

/* ---------------------------------------------------------
   Health check — ໃຊ້ກວດວ່າ server ແລະ DB ຍັງດີຢູ່ບໍ່
   ບໍ່ຕ້ອງໃຊ້ token (docker healthcheck / uptime monitor ເອີ້ນໄດ້)
   --------------------------------------------------------- */
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({
      status: "ok",
      database: "connected",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({ status: "degraded", database: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);

/* ---------------------------------------------------------
   ໜ້າເວັບ (frontend) — ໄຟລ໌ໃນໂຟນເດີ public/
   ເປີດ http://localhost:3000 ໄດ້ເລີຍ ບໍ່ຕ້ອງຕິດຕັ້ງ frontend ແຍກ
   --------------------------------------------------------- */
const PUBLIC_DIR = path.join(process.cwd(), "public");
if (env.SERVE_FRONTEND && fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
  app.use(express.static(PUBLIC_DIR, { maxAge: env.IS_PROD ? "1h" : 0 }));
}

// ຕ້ອງຢູ່ຫຼັງ routes ທັງໝົດສະເໝີ
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
