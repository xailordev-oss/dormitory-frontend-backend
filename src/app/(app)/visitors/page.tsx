"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAction, useFilters } from "@/lib/hooks";
import { L, datetime, opts } from "@/lib/labels";
import type { Paged, Visitor } from "@/lib/types";
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
} from "@/components/ui";
import { RoomSelect, StudentSelect } from "@/components/pickers";
import { RoleGate } from "@/components/AppShell";

/** POST /api/visitors/check-in · /check-out · GET /logs  (admin, staff) */
export default function VisitorsPage() {
  return (
    <RoleGate roles={["admin", "staff"]}>
      <VisitorsInner />
    </RoleGate>
  );
}

function VisitorsInner() {
  const f = useFilters({ status: "", studentId: "", roomId: "", from: "", to: "" });
  const { data, error, isLoading, mutate } = useApi<Paged<Visitor>>(`/visitors/logs${qs({ ...f.filters, page: f.page, limit: 20 })}`);
  const [checkingIn, setCheckingIn] = useState(false);
  const { busy, run } = useAction();

  const checkOut = (v: Visitor) =>
    run(`o-${v.id}`, () => api.post("/visitors/check-out", { id: v.id }), { refresh: ["/visitors", "/reports"] });

  return (
    <>
      <PageHeader
        title="ຜູ້ມາຢ້ຽມຢາມ"
        actions={
          <Button onClick={() => setCheckingIn(true)}>
            <LogIn className="size-4" /> Check-in ແຂກ
          </Button>
        }
      />
      <FilterBar>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.visitor)} empty="ທຸກສະຖານະ" />
        <StudentSelect value={f.filters.studentId} onChange={(e) => f.set("studentId", e.target.value)} empty="ນັກສຶກສາທຸກຄົນ" />
        <RoomSelect value={f.filters.roomId} onChange={(e) => f.set("roomId", e.target.value)} empty="ທຸກຫ້ອງ" />
        <Input type="date" value={f.filters.from} onChange={(e) => f.set("from", e.target.value)} title="ຈາກວັນທີ" />
        <Input type="date" value={f.filters.to} onChange={(e) => f.set("to", e.target.value)} title="ຮອດວັນທີ" />
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          empty="ບໍ່ມີບັນທຶກ"
          columns={[
            {
              header: "ແຂກ",
              cell: (v) => (
                <div>
                  <p className="font-medium">{v.visitor_name}</p>
                  <p className="text-xs text-slate-500">
                    {v.phone ?? ""} {v.id_card_number && `· ບັດ ${v.id_card_number}`}
                  </p>
                </div>
              ),
            },
            { header: "ມາຫາ", cell: (v) => (v.student_name ? `${v.student_name}${v.room_number ? ` (ຫ້ອງ ${v.room_number})` : ""}` : v.room_number ? `ຫ້ອງ ${v.room_number}` : "—") },
            { header: "ຈຸດປະສົງ", cell: (v) => v.purpose ?? "—" },
            { header: "ເຂົ້າ", cell: (v) => <span className="text-xs">{datetime(v.check_in_time)}</span> },
            { header: "ອອກ", cell: (v) => <span className="text-xs">{datetime(v.check_out_time)}</span> },
            { header: "ສະຖານະ", cell: (v) => <StatusBadge kind="visitor" value={v.status} /> },
            {
              header: "",
              className: "text-right",
              cell: (v) =>
                v.status === "checked_in" && (
                  <Button size="sm" variant="secondary" loading={busy === `o-${v.id}`} onClick={() => checkOut(v)}>
                    <LogOut className="size-3.5" /> Check-out
                  </Button>
                ),
            },
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>
      {checkingIn && <CheckInForm onClose={() => setCheckingIn(false)} />}
    </>
  );
}

function CheckInForm({ onClose }: { onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = { visitorName: v.visitorName };
    for (const k of ["idCardNumber", "phone", "purpose"]) if (v[k]) body[k] = v[k];
    if (v.studentId) body.studentId = Number(v.studentId);
    if (v.roomId) body.roomId = Number(v.roomId);
    const r = await run("save", () => api.post("/visitors/check-in", body), { refresh: ["/visitors", "/reports"] });
    if (r) onClose();
  };
  return (
    <Modal open title="Check-in ຜູ້ມາຢ້ຽມ" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ຊື່ແຂກ" required className="sm:col-span-2">
          <Input name="visitorName" required maxLength={150} autoFocus />
        </Field>
        <Field label="ເລກບັດປະຈຳຕົວ">
          <Input name="idCardNumber" maxLength={50} />
        </Field>
        <Field label="ເບີໂທ">
          <Input name="phone" maxLength={30} />
        </Field>
        <Field label="ມາຫານັກສຶກສາ">
          <StudentSelect name="studentId" empty="— ບໍ່ລະບຸ —" />
        </Field>
        <Field label="ຫ້ອງ">
          <RoomSelect name="roomId" empty="— ບໍ່ລະບຸ —" />
        </Field>
        <Field label="ຈຸດປະສົງ" className="sm:col-span-2">
          <Input name="purpose" maxLength={255} placeholder="ເຊັ່ນ: ຢ້ຽມຢາມ, ສົ່ງເຄື່ອງ" />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} submitText="Check-in" />
        </div>
      </form>
    </Modal>
  );
}
