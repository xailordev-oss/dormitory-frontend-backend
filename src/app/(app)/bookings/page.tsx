"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Check, LogOut as CheckoutIcon, X, Pencil, Trash2 } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, date, datetime, opts } from "@/lib/labels";
import type { Booking, Paged } from "@/lib/types";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  FilterBar,
  FormActions,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  formValues,
  useConfirm,
} from "@/components/ui";
import { BookingModal, RoomSelect, StudentSelect } from "@/components/pickers";

const REFRESH = ["/bookings", "/rooms", "/reports", "/students"];

/**
 * GET /api/bookings · POST · PATCH /:id/approve|cancel|checkout · PUT/DELETE /:id
 * ຂັ້ນຕອນ: ນັກສຶກສາຈອງ (pending) → ພະນັກງານອະນຸມັດ (active) → check-out (checked_out)
 */
export default function BookingsPage() {
  const { isAdmin, isStaff, isStudent, user, reload } = useAuth();
  const params = useSearchParams();
  const f = useFilters({ status: params.get("status") ?? "", studentId: "", roomId: "" });
  // ກົດລິ້ງຈາກ bell (ເຊັ່ນ ?status=pending) ຂະນະຢູ່ໜ້ານີ້ແລ້ວ → ປ່ຽນຕົວກອງຕາມ
  const urlStatus = params.get("status");
  useEffect(() => {
    if (urlStatus !== null) f.set("status", urlStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStatus]);

  const { data, error, isLoading, mutate } = useApi<Paged<Booking>>(`/bookings${qs({ ...f.filters, page: f.page, limit: 20 })}`, {
    refreshInterval: isStaff ? 20000 : 0,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const { busy, run } = useAction();
  const del = useDelete();
  const confirm = useConfirm();

  const hasOpenBooking = data?.data.some((b) => b.status === "pending" || b.status === "active");

  const approve = (b: Booking) =>
    run(`a-${b.id}`, () => api.patch(`/bookings/${b.id}/approve`), {
      success: `ອະນຸມັດການຈອງຂອງ ${b.student_name ?? ""} ແລ້ວ — ນັກສຶກສາໄດ້ຮັບແຈ້ງເຕືອນ`,
      refresh: REFRESH,
    });

  const checkout = async (b: Booking) => {
    if (!(await confirm({ message: `Check-out ${b.student_name} ອອກຈາກຫ້ອງ ${b.room_number}?`, confirmText: "Check-out" }))) return;
    await run(`o-${b.id}`, () => api.patch(`/bookings/${b.id}/checkout`), { refresh: REFRESH });
  };

  const cancel = async (b: Booking) => {
    if (!(await confirm({ message: `ຍົກເລີກການຈອງຫ້ອງ ${b.room_number}?`, danger: true, confirmText: "ຍົກເລີກການຈອງ" }))) return;
    const r = await run(`c-${b.id}`, () => api.patch(`/bookings/${b.id}/cancel`), { refresh: REFRESH });
    if (r && isStudent) await reload();
  };

  return (
    <>
      <PageHeader
        title={isStudent ? "ການຈອງຂອງຂ້ອຍ" : "ການຈອງຫ້ອງ"}
        description={isStaff ? "ລາຍການຈອງໃໝ່ຈະຂຶ້ນແຈ້ງເຕືອນອັດຕະໂນມັດ" : "ທ່ານຈະໄດ້ຮັບແຈ້ງເຕືອນເມື່ອການຈອງຖືກອະນຸມັດ"}
        actions={
          (isStaff || (isStudent && user?.student_id && !hasOpenBooking)) && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> {isStaff ? "ຈອງແທນນັກສຶກສາ" : "ຈອງຫ້ອງ"}
            </Button>
          )
        }
      />

      <FilterBar>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.booking)} empty="ທຸກສະຖານະ" />
        {isStaff && (
          <>
            <StudentSelect value={f.filters.studentId} onChange={(e) => f.set("studentId", e.target.value)} empty="ນັກສຶກສາທຸກຄົນ" />
            <RoomSelect value={f.filters.roomId} onChange={(e) => f.set("roomId", e.target.value)} empty="ທຸກຫ້ອງ" />
          </>
        )}
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          empty="ບໍ່ມີການຈອງ"
          columns={[
            { header: "#", cell: (b) => <span className="text-slate-400">{b.id}</span> },
            ...(isStaff ? [{ header: "ນັກສຶກສາ", cell: (b: Booking) => <span className="font-medium">{b.student_name}</span> }] : []),
            { header: "ຫ້ອງ", cell: (b) => `${b.room_number ?? b.room_id} · ${b.building_name ?? ""}` },
            { header: "ວັນເຂົ້າພັກ", cell: (b) => date(b.check_in_date) },
            { header: "ວັນອອກ", cell: (b) => date(b.check_out_date) },
            { header: "ສະຖານະ", cell: (b) => <StatusBadge kind="booking" value={b.status} /> },
            { header: "ຈອງເມື່ອ", cell: (b) => <span className="text-xs text-slate-500">{datetime(b.created_at)}</span> },
            {
              header: "",
              className: "text-right",
              cell: (b) => (
                <div className="flex justify-end gap-1">
                  {isStaff && b.status === "pending" && (
                    <Button size="sm" variant="success" loading={busy === `a-${b.id}`} onClick={() => approve(b)}>
                      <Check className="size-3.5" /> ອະນຸມັດ
                    </Button>
                  )}
                  {isStaff && b.status === "active" && (
                    <Button size="sm" variant="secondary" loading={busy === `o-${b.id}`} onClick={() => checkout(b)}>
                      <CheckoutIcon className="size-3.5" /> Check-out
                    </Button>
                  )}
                  {(b.status === "pending" || (isStaff && b.status === "active")) && (
                    <Button size="sm" variant="ghost" loading={busy === `c-${b.id}`} onClick={() => cancel(b)} title="ຍົກເລີກ">
                      <X className="size-3.5 text-red-600" /> {isStudent && "ຍົກເລີກ"}
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(b)} title="ແກ້ໄຂ">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={del.busy === `/bookings/${b.id}`}
                        onClick={() => del.remove(`/bookings/${b.id}`, `ການຈອງ #${b.id}`, REFRESH)}
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
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>

      <BookingModal open={creating} onClose={() => setCreating(false)} />
      {editing && <BookingEdit booking={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** PUT /api/bookings/:id (admin) */
function BookingEdit({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = {
      studentId: Number(v.studentId),
      roomId: Number(v.roomId),
      checkInDate: v.checkInDate,
      status: v.status,
    };
    if (v.checkOutDate) body.checkOutDate = v.checkOutDate;
    const r = await run("save", () => api.put(`/bookings/${booking.id}`, body), { refresh: REFRESH });
    if (r) onClose();
  };
  return (
    <Modal open title={`ແກ້ໄຂການຈອງ #${booking.id}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ນັກສຶກສາ" className="sm:col-span-2">
          <StudentSelect name="studentId" defaultValue={booking.student_id} />
        </Field>
        <Field label="ຫ້ອງ" className="sm:col-span-2">
          <RoomSelect name="roomId" defaultValue={booking.room_id} />
        </Field>
        <Field label="ວັນເຂົ້າພັກ">
          <Input type="date" name="checkInDate" defaultValue={date(booking.check_in_date)} />
        </Field>
        <Field label="ວັນອອກ" hint="ຖ້າໃສ່ ສະຖານະຕ້ອງເປັນ 'ອອກແລ້ວ'">
          <Input type="date" name="checkOutDate" defaultValue={booking.check_out_date ? date(booking.check_out_date) : ""} />
        </Field>
        <Field label="ສະຖານະ" className="sm:col-span-2">
          <Select name="status" options={opts(L.booking)} defaultValue={booking.status} />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} />
        </div>
      </form>
    </Modal>
  );
}
