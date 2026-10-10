import { RowDataPacket } from "mysql2";
import pool from "../config/db";
import { sendMail } from "../config/mailer";

export type NotificationType = "info" | "warning" | "urgent" | "payment" | "maintenance";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildMail = (to: string, title: string, message: string) => ({
  to,
  subject: title,
  text: `${title}\n\n${message}\n\n— ລະບົບຈັດການຫໍພັກ`,
  html:
    `<div style="font-family:Arial,'Noto Sans Lao',sans-serif;line-height:1.6">` +
    `<h3 style="margin:0 0 8px">${escapeHtml(title)}</h3>` +
    `<p style="white-space:pre-line">${escapeHtml(message)}</p>` +
    `<hr><small>ລະບົບຈັດການຫໍພັກ</small></div>`,
});

/**
 * ສົ່ງແຈ້ງການໃຫ້ນັກສຶກສາຄົນໜຶ່ງ (ບັນທຶກໃນລະບົບ + ສົ່ງອີເມວຖ້າຕັ້ງ SMTP ໄວ້)
 *
 * ເຈດຕະນາໃຫ້ "ບໍ່ throw" — ແຈ້ງການເປັນສ່ວນເສີມ, ຖ້າມັນລົ້ມກໍຕ້ອງບໍ່ເຮັດໃຫ້
 * ການຊຳລະເງິນ / ການຈອງ / ການແຈ້ງສ້ອມ ທີ່ສຳເລັດແລ້ວກາຍເປັນ error
 */
export const notifyStudent = async (
  studentId: number | null | undefined,
  input: { title: string; message: string; type?: NotificationType },
  opts: { email?: boolean } = {}
): Promise<void> => {
  if (!studentId) return;
  try {
    await pool.query(
      `INSERT INTO notifications (title, message, type, student_id, is_read)
       VALUES (?, ?, ?, ?, FALSE)`,
      [input.title.slice(0, 200), input.message.slice(0, 1000), input.type ?? "info", studentId]
    );

    if (opts.email !== false) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT email FROM students WHERE id = ? LIMIT 1",
        [studentId]
      );
      const email = rows[0]?.email as string | undefined;
      if (email) {
        // ບໍ່ await — ບໍ່ໃຫ້ request ຊ້າຍ້ອນ SMTP
        void sendMail(buildMail(email, input.title, input.message));
      }
    }
  } catch (error: any) {
    console.error("⚠️ ສ້າງແຈ້ງການອັດຕະໂນມັດບໍ່ສຳເລັດ:", error?.message || error);
  }
};
