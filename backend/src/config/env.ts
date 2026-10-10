// ກວດ environment variables ທີ່ຈຳເປັນ ຕັ້ງແຕ່ຕອນ start
// ເຫດຜົນ: ຖ້າ JWT_SECRET ບໍ່ມີ, jwt.sign() ຈະ throw ຕອນ login ເທົ່ານັ້ນ (runtime)
// ເຮັດໃຫ້ debug ຍາກ. ສູ້ໃຫ້ລົ້ມຕັ້ງແຕ່ຕອນເປີດ server ດີກວ່າ.

const REQUIRED = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DB_NAME"] as const;

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(
    `\n❌ ບໍ່ພົບ environment variables ທີ່ຈຳເປັນ: ${missing.join(", ")}\n` +
      `   ກະລຸນາສ້າງໄຟລ໌ .env (ເບິ່ງຕົວຢ່າງທີ່ .env.example) ແລ້ວເປີດ server ໃໝ່\n`
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  const weak = ["secret", "changeme", "jwt_secret", "123456"];
  if (weak.includes(String(process.env.JWT_SECRET).toLowerCase())) {
    console.error("\n❌ JWT_SECRET ອ່ອນເກີນໄປສຳລັບ production. ກະລຸນາປ່ຽນເປັນຄ່າສຸ່ມທີ່ຍາວ\n");
    process.exit(1);
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error("\n❌ JWT_SECRET ແລະ JWT_REFRESH_SECRET ຕ້ອງເປັນຄ່າຕ່າງກັນ\n");
    process.exit(1);
  }
}

const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const nodeEnv = process.env.NODE_ENV || "development";

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: nodeEnv,
  IS_PROD: nodeEnv === "production",
  IS_TEST: nodeEnv === "test",
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  CORS_ORIGIN: process.env.CORS_ORIGIN,

  // URL ຂອງເວັບ (ໃຊ້ສ້າງລິ້ງ reset password ໃນອີເມວ)
  APP_URL: (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/+$/, ""),
  // ອາຍຸຂອງລິ້ງ reset password (ນາທີ)
  RESET_TOKEN_MINUTES: Number(process.env.RESET_TOKEN_MINUTES) || 30,

  // ຈຳກັດຈຳນວນ request (ປິດໄດ້ດ້ວຍ RATE_LIMIT_ENABLED=false)
  RATE_LIMIT_ENABLED: bool(process.env.RATE_LIMIT_ENABLED, nodeEnv !== "test"),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20, // ຕໍ່ 15 ນາທີ ຕໍ່ IP
  API_RATE_LIMIT_MAX: Number(process.env.API_RATE_LIMIT_MAX) || 600, // ຕໍ່ 1 ນາທີ ຕໍ່ IP

  // trust proxy: ຕັ້ງເປັນຈຳນວນ proxy ທີ່ຢູ່ໜ້າ server (nginx = 1)
  TRUST_PROXY: process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY),

  // ອີເມວ (ບໍ່ບັງຄັບ — ຖ້າບໍ່ຕັ້ງ ລະບົບຈະບໍ່ສົ່ງອີເມວ ແຕ່ທຸກຢ່າງອື່ນໃຊ້ໄດ້ປົກກະຕິ)
  SMTP_HOST: process.env.SMTP_HOST?.trim() || "",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER?.trim() || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  MAIL_FROM: process.env.MAIL_FROM?.trim() || "Dormitory <no-reply@localhost>",

  // ອະນຸຍາດໃຫ້ຄົນນອກສະໝັກບັນຊີເອງ (POST /api/auth/register). ປິດ = admin ສ້າງບັນຊີໃຫ້ເທົ່ານັ້ນ
  ALLOW_REGISTRATION: bool(process.env.ALLOW_REGISTRATION, true),

  // ເປີດໃຫ້ server ເປີດໜ້າເວັບ (public/) ນຳ
  SERVE_FRONTEND: bool(process.env.SERVE_FRONTEND, true),
};

export const isMailEnabled = () => env.SMTP_HOST.length > 0;
