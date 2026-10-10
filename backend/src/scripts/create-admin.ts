import bcrypt from "bcrypt";
import readline from "readline";
import { connectDb, explainConnectError } from "./dbtools";

/**
 * ສ້າງ (ຫຼື ເລື່ອນຕຳແໜ່ງ) ບັນຊີ admin / staff ຄົນທຳອິດ — ບໍ່ຕ້ອງແກ້ SQL ດ້ວຍມື
 *
 *   npm run create-admin -- --email admin@example.com --password "MyPass123" --name "Admin"
 *   npm run create-admin -- --email desk@example.com --password "MyPass123" --role staff
 *
 * ຫຼືຕັ້ງ ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME ໃນ .env
 * ຖ້າອີເມວນີ້ມີຢູ່ແລ້ວ → ເລື່ອນເປັນ role ທີ່ຕ້ອງການ (ແລະປ່ຽນລະຫັດຜ່ານຖ້າສົ່ງ --password ມາ)
 */
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

const main = async () => {
  let email = (arg("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  let password = arg("password") || process.env.ADMIN_PASSWORD || "";
  let name = (arg("name") || process.env.ADMIN_NAME || "").trim();
  const role = (arg("role") || "admin").trim();

  if (!["admin", "staff"].includes(role)) {
    throw new Error('--role ຕ້ອງເປັນ "admin" ຫຼື "staff"');
  }
  if (!email) email = (await ask("ອີເມວ: ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ");

  const conn = await connectDb();
  try {
    const [rows] = await conn.query("SELECT id, name, role FROM users WHERE email = ? LIMIT 1", [email]);
    const existing = (rows as any[])[0];

    if (!existing && !password) password = await ask("ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 8 ຕົວ): ");
    if (password && (password.length < 8 || Buffer.byteLength(password) > 72)) {
      throw new Error("ລະຫັດຜ່ານຕ້ອງຍາວ 8–72 ຕົວອັກສອນ");
    }

    if (existing) {
      if (password) {
        const hash = await bcrypt.hash(password, 10);
        await conn.query("UPDATE users SET role = ?, is_active = TRUE, password = ? WHERE id = ?", [
          role,
          hash,
          existing.id,
        ]);
        await conn.query("DELETE FROM refresh_tokens WHERE user_id = ?", [existing.id]);
      } else {
        await conn.query("UPDATE users SET role = ?, is_active = TRUE WHERE id = ?", [role, existing.id]);
      }
      console.log(`\n✅ ບັນຊີ ${email} ມີຢູ່ແລ້ວ → ຕັ້ງເປັນ ${role}${password ? " ແລະ ປ່ຽນລະຫັດຜ່ານແລ້ວ" : ""}\n`);
      return;
    }

    if (!name) name = (await ask("ຊື່: ")) || email.split("@")[0];
    const hash = await bcrypt.hash(password, 10);
    await conn.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      name,
      email,
      hash,
      role,
    ]);
    console.log(`\n✅ ສ້າງບັນຊີ ${role} ສຳເລັດ: ${email}\n   ເຂົ້າສູ່ລະບົບໄດ້ເລີຍທີ່ /api/auth/login (ຫຼືໜ້າເວັບ)\n`);
  } finally {
    await conn.end();
  }
};

main().catch((error) => {
  console.error("\n❌ create-admin ບໍ່ສຳເລັດ:", explainConnectError(error), "\n");
  process.exit(1);
});
