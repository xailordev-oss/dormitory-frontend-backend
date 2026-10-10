"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Users, BedDouble } from "lucide-react";
import { api, clean, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, money, opts } from "@/lib/labels";
import type { Room, RoomList } from "@/lib/types";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  FilterBar,
  FormActions,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  formValues,
} from "@/components/ui";
import { BookingModal, BuildingSelect } from "@/components/pickers";
import { EntityCover } from "@/components/RoomCover";

/** GET /api/rooms (+ POST/PUT/DELETE ສຳລັບ admin) */
export default function RoomsPage() {
  const { isAdmin, isStaff, isStudent, user } = useAuth();
  const params = useSearchParams();
  const f = useFilters({
    status: params.get("status") ?? "",
    buildingId: params.get("buildingId") ?? "",
    minPrice: "",
    maxPrice: "",
    hasVacancy: params.get("hasVacancy") ?? "",
  });
  const path = `/rooms${qs({ ...f.filters, page: f.page, limit: 24 })}`;
  const { data, error, isLoading, mutate } = useApi<RoomList>(path);

  const [editing, setEditing] = useState<Room | "new" | null>(null);
  const [booking, setBooking] = useState<Room | null>(null);

  const del = useDelete();
  const remove = (r: Room) => del.remove(`/rooms/${r.id}`, `ຫ້ອງ ${r.room_number}`, ["/rooms", "/reports"]);

  return (
    <>
      <PageHeader
        title="ຫ້ອງພັກ"
        description={
          data?.summary
            ? `ທັງໝົດ ${data.total} ຫ້ອງ · ${data.summary.totalOccupants}/${data.summary.totalBeds} ຕຽງ · ວ່າງ ${data.summary.totalVacancy} ຕຽງ`
            : undefined
        }
        actions={
          isAdmin && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> ເພີ່ມຫ້ອງ
            </Button>
          )
        }
      />

      <FilterBar>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.room)} empty="ທຸກສະຖານະ" />
        <BuildingSelect value={f.filters.buildingId} onChange={(e) => f.set("buildingId", e.target.value)} empty="ທຸກຕຶກ" />
        {/* <Input type="number" placeholder="ລາຄາຕ່ຳສຸດ" value={f.filters.minPrice} onChange={(e) => f.set("minPrice", e.target.value)} />
        <Input type="number" placeholder="ລາຄາສູງສຸດ" value={f.filters.maxPrice} onChange={(e) => f.set("maxPrice", e.target.value)} /> */}
        <Select
          value={f.filters.hasVacancy}
          onChange={(e) => f.set("hasVacancy", e.target.value)}
          options={[["true", "ສະເພາະຫ້ອງທີ່ຍັງວ່າງ"]]}
          empty="ທຸກຫ້ອງ"
        />
      </FilterBar>

      {error ? (
        <ErrorBox error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : !data?.data.length ? (
        <Card>
          <Empty text="ບໍ່ພົບຫ້ອງຕາມເງື່ອນໄຂ" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.data.map((r) => {
              const pct = r.capacity ? Math.min(100, (r.occupants / r.capacity) * 100) : 0;
              const mine = isStudent && user?.room_id === r.id;
              return (
                <div key={r.id} className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${mine ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"}`}>
                  <Link href={`/rooms/${r.id}`} className="block">
                    <EntityCover entityType="rooms" entityId={r.id} className="aspect-[16/10] w-full" />
                  </Link>
                  <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/rooms/${r.id}`} className="hover:underline">
                      <p className="text-lg font-bold text-slate-900">ຫ້ອງ {r.room_number}</p>
                      <p className="text-xs text-slate-500">{r.building_name}</p>
                    </Link>
                    <StatusBadge kind="room" value={r.status} />
                  </div>
                  <p className="mt-3 text-xl font-semibold text-brand-700">
                    {money(r.price)}
                    <span className="text-xs font-normal text-slate-500"> / ເດືອນ</span>
                  </p>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <BedDouble className="size-3.5" /> {r.label} ຄົນ
                      </span>
                      <span>{r.statusText}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${r.isFull ? "bg-slate-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {mine && <p className="mt-2 text-xs font-medium text-brand-700">ຫ້ອງຂອງທ່ານ</p>}
                  <div className="h-4" />
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {r.isAvailable && (isStudent ? !user?.room_id : isStaff) && (
                      <Button size="sm" onClick={() => setBooking(r)}>
                        {isStaff ? "ຈອງແທນ" : "ຈອງຫ້ອງນີ້"}
                      </Button>
                    )}
                    <Link href={`/rooms/${r.id}`}>
                      <Button size="sm" variant="secondary">
                        <p className="size-3.5" /> ລາຍລະອຽດ
                      </Button>
                    </Link>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="ແກ້ໄຂ">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r)} loading={del.busy === `/rooms/${r.id}`} title="ລຶບ">
                          <Trash2 className="size-3.5 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />
          </div>
        </>
      )}

      {editing && <RoomForm room={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <BookingModal open={!!booking} room={booking} onClose={() => setBooking(null)} />
    </>
  );
}

/** POST /api/rooms ຫຼື PUT /api/rooms/:id */
function RoomForm({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body = clean({
      roomNumber: v.roomNumber,
      buildingId: v.buildingId ? Number(v.buildingId) : undefined,
      capacity: v.capacity ? Number(v.capacity) : undefined,
      price: v.price ? Number(v.price) : undefined,
      status: v.status,
    });
    const r = await run("save", () => (room ? api.put(`/rooms/${room.id}`, body) : api.post("/rooms", body)), {
      refresh: ["/rooms", "/reports"],
    });
    if (r) onClose();
  };
  return (
    <Modal open title={room ? `ແກ້ໄຂຫ້ອງ ${room.room_number}` : "ເພີ່ມຫ້ອງໃໝ່"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ເລກຫ້ອງ" required>
          <Input name="roomNumber" required maxLength={50} defaultValue={room?.room_number} />
        </Field>
        <Field label="ຕຶກ" required>
          <BuildingSelect name="buildingId" required empty="-- ເລືອກຕຶກ --" defaultValue={room?.building_id} />
        </Field>
        <Field label="ຄວາມຈຸ (ຄົນ)" hint="ຄ່າເລີ່ມຕົ້ນ 4">
          <Input name="capacity" type="number" min={1} defaultValue={room?.capacity} />
        </Field>
        <Field label="ລາຄາ / ເດືອນ (ກີບ)" required>
          <Input name="price" type="number" min={1} required defaultValue={room ? Number(room.price) : undefined} />
        </Field>
        <Field label="ສະຖານະ" className="sm:col-span-2" hint="ປົກກະຕິລະບົບຄິດໄລ່ໃຫ້ເອງ (ຫວ່າງ/ເຕັມ) — ຕັ້ງ 'ສ້ອມແປງ' ເພື່ອປິດຮັບຈອງ">
          <Select name="status" options={opts(L.room)} empty="(ອັດຕະໂນມັດ)" defaultValue={room ? room.status : ""} />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} />
        </div>
      </form>
    </Modal>
  );
}
