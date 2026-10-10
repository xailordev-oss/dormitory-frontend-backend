import { NextResponse } from "next/server";
import { listSlides } from "@/lib/slides";

/** GET /slides → ລາຍການຮູບສະໄລ້ຈາກໂຟນເດີ images */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const slides = await listSlides();
  return NextResponse.json({ slides }, { headers: { "Cache-Control": "no-store" } });
}
