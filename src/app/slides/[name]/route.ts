import { promises as fs } from "node:fs";
import { findSlideFile } from "@/lib/slides";

/** GET /slides/:name → ສົ່ງໄຟລ໌ຮູບຈາກໂຟນເດີ images */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let file = name;
  try {
    file = decodeURIComponent(name);
  } catch {
    /* ຊື່ຖືກ decode ມາແລ້ວ */
  }
  const found = await findSlideFile(file);
  if (!found) return new Response("Not found", { status: 404 });
  const body = await fs.readFile(/*turbopackIgnore: true*/ found.file);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": found.type, "Cache-Control": "public, max-age=3600" },
  });
}
