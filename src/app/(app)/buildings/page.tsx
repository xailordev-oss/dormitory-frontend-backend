"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import { api, clean, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete } from "@/lib/hooks";
import type { Building } from "@/lib/types";
import { Button, Card, ErrorBox, Field, FormActions, Input, Modal, PageHeader, Table, formValues } from "@/components/ui";
import { ImageGallery } from "@/components/ImageGallery";

/** GET /api/buildings (+ POST/PUT/DELETE ສຳລັບ admin) */
export default function BuildingsPage() {
  const { isAdmin } = useAuth();
  const { data, error, isLoading, mutate } = useApi<{ data: Building[]; total: number }>("/buildings");
  const [editing, setEditing] = useState<Building | "new" | null>(null);
  const [gallery, setGallery] = useState<Building | null>(null);
  const del = useDelete();

  return (
    <>
      <PageHeader
        title="ຕຶກ"
        description={data ? `ທັງໝົດ ${data.total} ຕຶກ` : undefined}
        actions={
          isAdmin && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> ເພີ່ມຕຶກ
            </Button>
          )
        }
      />
      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          columns={[
            { header: "ຊື່ຕຶກ", cell: (b) => <span className="font-medium">{b.name}</span> },
            { header: "ທີ່ຢູ່", cell: (b) => b.address ?? "—" },
            { header: "ຈຳນວນຊັ້ນ", cell: (b) => b.total_floors ?? "—" },
            {
              header: "",
              className: "text-right",
              cell: (b) => (
                <div className="flex justify-end gap-1">
                  <Link href={`/rooms?buildingId=${b.id}`}>
                    <Button size="sm" variant="secondary">
                      ເບິ່ງຫ້ອງ
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setGallery(b)} title="ຮູບພາບ">
                    <ImageIcon className="size-3.5" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(b)} title="ແກ້ໄຂ">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={del.busy === `/buildings/${b.id}`}
                        onClick={() => del.remove(`/buildings/${b.id}`, `ຕຶກ ${b.name}`, ["/buildings", "/rooms"])}
                        title="ລຶບ"
                      >
                        <Trash2 className="size-3.5 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {editing && <BuildingForm building={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <Modal open={!!gallery} title={`ຮູບພາບ · ${gallery?.name ?? ""}`} onClose={() => setGallery(null)} wide>
        {gallery && <ImageGallery entityType="buildings" entityId={gallery.id} />}
      </Modal>
    </>
  );
}

function BuildingForm({ building, onClose }: { building: Building | null; onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = clean({ name: v.name, address: v.address, totalFloors: v.totalFloors ? Number(v.totalFloors) : undefined });
    const r = await run("save", () => (building ? api.put(`/buildings/${building.id}`, body) : api.post("/buildings", body)), {
      refresh: ["/buildings", "/rooms"],
    });
    if (r) onClose();
  };
  return (
    <Modal open title={building ? "ແກ້ໄຂຕຶກ" : "ເພີ່ມຕຶກໃໝ່"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="ຊື່ຕຶກ" required>
          <Input name="name" required maxLength={150} defaultValue={building?.name} />
        </Field>
        <Field label="ທີ່ຢູ່">
          <Input name="address" maxLength={255} defaultValue={building?.address ?? ""} />
        </Field>
        <Field label="ຈຳນວນຊັ້ນ" hint="1–100">
          <Input name="totalFloors" type="number" min={1} max={100} defaultValue={building?.total_floors ?? ""} />
        </Field>
        <FormActions onCancel={onClose} loading={busy === "save"} />
      </form>
    </Modal>
  );
}
