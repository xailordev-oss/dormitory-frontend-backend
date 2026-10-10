"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Image } from "@/lib/types";

/**
 * ຮູບປົກຂອງຫ້ອງ/ຕຶກ — GET /api/images/:entityType/:entityId
 * ເລືອກຮູບທີ່ is_cover = 1 ກ່ອນ, ຖ້າບໍ່ມີ ໃຊ້ຮູບທຳອິດ, ຖ້າບໍ່ມີຮູບເລີຍ ສະແດງພື້ນວ່າງ
 */
export function EntityCover({
  entityType,
  entityId,
  className = "",
  children,
}: {
  entityType: "rooms" | "buildings" | "students";
  entityId: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const { data, isLoading } = useApi<{ total: number; images: Image[] }>(`/images/${entityType}/${entityId}`, {
    revalidateOnFocus: false,
  });
  const [broken, setBroken] = useState(false);
  const img = data?.images.find((i) => Number(i.is_cover) === 1) ?? data?.images[0];

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {img && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.image_url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400 ${isLoading ? "animate-pulse" : ""}`}>
          {!isLoading && (
            <>
              <ImageOff className="size-6" />
              <span className="text-xs">ຍັງບໍ່ມີຮູບ</span>
            </>
          )}
        </div>
      )}
      {data && data.total > 1 && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">📷 {data.total}</span>
      )}
      {children}
    </div>
  );
}
