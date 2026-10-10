import nodemailer, { Transporter } from "nodemailer";
import { env, isMailEnabled } from "./env";

/**
 * ສົ່ງອີເມວ — ເປັນທາງເລືອກເສີມ
 *  - ຖ້າບໍ່ໄດ້ຕັ້ງ SMTP_HOST ໃນ .env → ບໍ່ສົ່ງ (ຄືນ false) ແລະບໍ່ throw
 *  - ຖ້າສົ່ງບໍ່ສຳເລັດ → log ແລ້ວຄືນ false, ບໍ່ໃຫ້ກະທົບ request ຫຼັກ
 */
let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendMail = async (mail: MailInput): Promise<boolean> => {
  if (!isMailEnabled()) return false;
  try {
    await getTransporter().sendMail({ from: env.MAIL_FROM, ...mail });
    return true;
  } catch (error: any) {
    console.error("⚠️ ສົ່ງອີເມວບໍ່ສຳເລັດ:", error?.message || error);
    return false;
  }
};

/** ສົ່ງຫຼາຍຄົນແບບຄ່ອຍໆ (ບໍ່ຍິງພ້ອມກັນຫຼາຍເກີນໄປ) — ໃຊ້ໃນ background */
export const sendMailBatch = async (mails: MailInput[], concurrency = 5): Promise<number> => {
  if (!isMailEnabled()) return 0;
  let sent = 0;
  for (let i = 0; i < mails.length; i += concurrency) {
    const chunk = mails.slice(i, i + concurrency);
    const results = await Promise.all(chunk.map((m) => sendMail(m)));
    sent += results.filter(Boolean).length;
  }
  return sent;
};
