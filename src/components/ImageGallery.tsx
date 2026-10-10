"use client";

import { useRef, useState } from "react";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, revalidate, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete } from "@/lib/hooks";
import type { Image } from "@/lib/types";
import { Badge, Button, Card, Empty, Loading } from "./ui";

/**
 * ຄັງຮູບ: GET /api/images/:entityType/:entityId
 * admin: POST (form-data field "image"), PATCH /:id/cover, DELETE /:id
 */
export function ImageGallery({ entityType, entityId }: { entityType: "rooms" | "buildings" | "students"; entityId: number }) {
  const { isAdmin } = useAuth();
  const key = `/images/${entityType}/${entityId}`;
  const { data } = useApi<{ total: number; images: Image[] }>(key);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { busy, run } = useAction();
  const del = useDelete();

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("ໄຟລ໌ໃຫຍ່ເກີນ 5MB");
    const fd = new FormData();
    fd.append("image", file);
    setUploading(true);
    try {
      await api.post(key, fd);
      toast.success("ອັບໂຫລດຮູບສຳເລັດ");
      await revalidate("/images");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card
      title={`ຮູບພາບ ${data ? `(${data.total})` : ""}`}
      actions={
        isAdmin && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
            />
            <Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" /> ອັບໂຫລດຮູບ
            </Button>
          </>
        )
      }
    >
      {!data ? (
        <Loading />
      ) : data.images.length === 0 ? (
        <Empty text="ຍັງບໍ່ມີຮູບ" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
              {Number(img.is_cover) === 1 && (
                <span className="absolute top-2 left-2">
                  <Badge tone="yellow">ຮູບປົກ</Badge>
                </span>
              )}
              {isAdmin && (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-2 opacity-0 transition group-hover:opacity-100">
                  {!Number(img.is_cover) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === `cover-${img.id}`}
                      onClick={() => run(`cover-${img.id}`, () => api.patch(`/images/${img.id}/cover`), { refresh: ["/images"] })}
                    >
                      <Star className="size-3.5" /> ຕັ້ງເປັນປົກ
                    </Button>
                  )}
                  <Button size="sm" variant="danger" loading={del.busy === `/images/${img.id}`} onClick={() => del.remove(`/images/${img.id}`, "ຮູບນີ້", ["/images"])}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
