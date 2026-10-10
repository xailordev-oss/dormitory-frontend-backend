import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * ຮູບສະໄລ້ (server ເທົ່ານັ້ນ)
 * ອ່ານຮູບຈາກໂຟນເດີ images ໂດຍກົງທຸກເທື່ອທີ່ມີຄົນເປີດເວັບ
 * → ເພີ່ມ / ລຶບ / ປ່ຽນຮູບໄດ້ເລີຍ ບໍ່ຕ້ອງ build ໃໝ່
 *
 * ຊອກຕາມລຳດັບ: public/images/ ແລ້ວ images/ (ຢູ່ຂ້າງ package.json)
 */
export const SLIDE_DIRS = [path.join(process.cwd(), "public", "images"), path.join(process.cwd(), "images")];

export const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export interface Slide {
  src: string;
  title?: string;
  text?: string;
}

/** ຂໍ້ຄວາມ (ທາງເລືອກ) ຈາກ slides.json ໃນໂຟນເດີດຽວກັນ */
interface SlideMeta {
  file: string;
  title?: string;
  text?: string;
}

async function readDir(dir: string): Promise<string[]> {
  try {
    const names = await fs.readdir(/*turbopackIgnore: true*/ dir);
    return names.filter((n) => !n.startsWith(".") && IMAGE_TYPES[path.extname(n).toLowerCase()]);
  } catch {
    return [];
  }
}

async function readMeta(dir: string): Promise<SlideMeta[]> {
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ path.join(dir, "slides.json"), "utf8");
    const json: unknown = JSON.parse(raw);
    return Array.isArray(json) ? (json.filter((m) => m && typeof m.file === "string") as SlideMeta[]) : [];
  } catch {
    return [];
  }
}

export async function listSlides(): Promise<Slide[]> {
  const seen = new Set<string>();
  const files: string[] = [];
  const meta: SlideMeta[] = [];
  for (const dir of SLIDE_DIRS) {
    for (const f of await readDir(dir)) {
      if (!seen.has(f)) {
        seen.add(f);
        files.push(f);
      }
    }
    meta.push(...(await readMeta(dir)));
  }

  // ລຽງຕາມຊື່ໄຟລ໌ (1, 2, 10 ບໍ່ແມ່ນ 1, 10, 2) — ຖ້າມີ slides.json ຈະລຽງຕາມໄຟລ໌ນັ້ນກ່ອນ
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const order = meta.map((m) => m.file);
  const rank = (f: string) => (order.includes(f) ? order.indexOf(f) : order.length);
  files.sort((a, b) => rank(a) - rank(b));

  return files.map((f) => {
    const m = meta.find((x) => x.file === f);
    return { src: `/slides/${encodeURIComponent(f)}`, title: m?.title, text: m?.text };
  });
}

/** ຫາໄຟລ໌ຈິງຈາກຊື່ (ກັນ ../ ອອກໄປນອກໂຟນເດີ) */
export async function findSlideFile(name: string): Promise<{ file: string; type: string } | null> {
  const base = path.basename(name);
  const type = IMAGE_TYPES[path.extname(base).toLowerCase()];
  if (!type || base !== name) return null;
  for (const dir of SLIDE_DIRS) {
    const file = path.join(/*turbopackIgnore: true*/ dir, base);
    try {
      const st = await fs.stat(/*turbopackIgnore: true*/ file);
      if (st.isFile()) return { file, type };
    } catch {
      /* ລອງໂຟນເດີຕໍ່ໄປ */
    }
  }
  return null;
}
