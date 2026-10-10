/* ປ້າຍພາສາລາວ ແລະ ສີຂອງສະຖານະຕ່າງໆ + ຕົວຊ່ວຍຈັດຮູບແບບ */

export const L = {
  role: { admin: "ຜູ້ດູແລລະບົບ", staff: "ພະນັກງານ", student: "ນັກສຶກສາ" },
  room: { available: "ຫວ່າງ", occupied: "ເຕັມ", maintenance: "ສ້ອມແປງ" },
  booking: { pending: "ລໍຖ້າອະນຸມັດ", active: "ພັກຢູ່", checked_out: "ອອກແລ້ວ", cancelled: "ຍົກເລີກ" },
  pay: { pending: "ຄ້າງຊຳລະ", paid: "ຊຳລະແລ້ວ", failed: "ລົ້ມເຫຼວ", refunded: "ຄືນເງິນແລ້ວ" },
  method: { cash: "ເງິນສົດ", bank_transfer: "ໂອນທະນາຄານ", card: "ບັດ", mobile_banking: "Mobile Banking" },
  ptype: { rent: "ຄ່າເຊົ່າຫ້ອງ", deposit: "ເງິນມັດຈຳ", utility: "ຄ່ານ້ຳ/ຄ່າໄຟ", other: "ອື່ນໆ" },
  maint: { pending: "ລໍຖ້າ", in_progress: "ກຳລັງສ້ອມ", resolved: "ສຳເລັດ", cancelled: "ຍົກເລີກ" },
  prio: { low: "ຕ່ຳ", medium: "ກາງ", high: "ສູງ", urgent: "ດ່ວນ" },
  visitor: { checked_in: "ຢູ່ໃນຫໍ", checked_out: "ອອກແລ້ວ" },
  student: { active: "ພັກຢູ່", inactive: "ບໍ່ໄດ້ພັກ" },
  ntype: { info: "ທົ່ວໄປ", warning: "ເຕືອນ", urgent: "ດ່ວນ", payment: "ການເງິນ", maintenance: "ສ້ອມແປງ" },
} as const;

export type Tone = "gray" | "green" | "yellow" | "red" | "blue" | "purple";

export const TONE: Record<string, Tone> = {
  available: "green",
  occupied: "gray",
  maintenance: "yellow",
  pending: "yellow",
  active: "green",
  checked_out: "gray",
  cancelled: "gray",
  paid: "green",
  failed: "red",
  refunded: "purple",
  overdue: "red",
  in_progress: "blue",
  resolved: "green",
  urgent: "red",
  high: "yellow",
  medium: "blue",
  low: "gray",
  checked_in: "green",
  inactive: "gray",
  admin: "purple",
  staff: "blue",
  student: "gray",
  info: "blue",
  warning: "yellow",
  payment: "green",
};

/** ແປງ map ເປັນ [value, label][] ສຳລັບ <select> */
export const opts = (m: Record<string, string>) => Object.entries(m) as [string, string][];

export const money = (n: unknown) => `${Number(n || 0).toLocaleString("en-US")} ກີບ`;
export const num = (n: unknown) => Number(n || 0).toLocaleString("en-US");
export const date = (s?: string | null) => (s ? String(s).slice(0, 10) : "—");
export const datetime = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 16).replace("T", " ");
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const timeAgo = (s?: string | null) => {
  if (!s) return "";
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (Number.isNaN(diff)) return "";
  if (diff < 60) return "ຫາກໍ່";
  if (diff < 3600) return `${Math.floor(diff / 60)} ນາທີກ່ອນ`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ຊົ່ວໂມງກ່ອນ`;
  return `${Math.floor(diff / 86400)} ມື້ກ່ອນ`;
};
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
};
