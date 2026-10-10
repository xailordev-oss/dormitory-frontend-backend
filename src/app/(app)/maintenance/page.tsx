"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, datetime, opts } from "@/lib/labels";
import type { Maintenance, MaintenanceStatus, Paged } from "@/lib/types";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  FilterBar,
  FormActions,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  Textarea,
  formValues,
} from "@/components/ui";
import { RoomSelect, StudentSelect } from "@/components/pickers";

const REFRESH = ["/maintenance", "/rooms", "/reports"];

/**
 * GET/POST /api/maintenance · PUT /:id/status (admin, staff) · DELETE /:id (admin)
 * in_progress → ຫ້ອງຖືກປ່ຽນເປັນ "ສ້ອມແປງ" ອັດຕະໂນມັດ · resolved/cancelled → ຫ້ອງກັບມາໃຊ້ໄດ້
 */
export default function MaintenancePage() {
  const { isAdmin, isStaff, isStudent, user } = useAuth();
  const params = useSearchParams();
  const f = useFilters({ status: params.get("status") ?? "", priority: "", roomId: "" });
  const urlStatus = params.get("status");
  useEffect(() => {
    if (urlStatus !== null) f.set("status", urlStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStatus]);

  const { data, error, isLoading, mutate } = useApi<Paged<Maintenance>>(`/maintenance${qs({ ...f.filters, page: f.page, limit: 20 })}`, {
    refreshInterval: isStaff ? 20000 : 0,
  });
  const [creating, setCreating] = useState(false);
  const { busy, run } = useAction();
  const del = useDelete();

  const setStatus = (m: Maintenance, status: MaintenanceStatus) =>
    run(`s-${m.id}`, () => api.put(`/maintenance/${m.id}/status`, { status }), {
      success: `ປ່ຽນເປັນ "${L.maint[status]}" ແລ້ວ${m.reported_by ? " — ຜູ້ແຈ້ງໄດ້ຮັບແຈ້ງເຕືອນ" : ""}`,
      refresh: REFRESH,
    });

  return (
    <>
      <PageHeader
        title="ແຈ້ງສ້ອມແປງ"
        description={isStudent ? "ສະແດງລາຍການທີ່ທ່ານແຈ້ງ ແລະ ຂອງຫ້ອງທ່ານ" : "ລາຍການໃໝ່ຈະຂຶ້ນແຈ້ງເຕືອນອັດຕະໂນມັດ"}
        actions={
          (isStaff || user?.student_id) && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> ແຈ້ງສ້ອມແປງ
            </Button>
          )
        }
      />
      <FilterBar>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.maint)} empty="ທຸກສະຖານະ" />
        <Select value={f.filters.priority} onChange={(e) => f.set("priority", e.target.value)} options={opts(L.prio)} empty="ທຸກລະດັບ" />
        {isStaff && <RoomSelect value={f.filters.roomId} onChange={(e) => f.set("roomId", e.target.value)} empty="ທຸກຫ້ອງ" />}
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          empty="ບໍ່ມີລາຍການແຈ້ງສ້ອມ"
          columns={[
            { header: "ຫ້ອງ", cell: (m) => <span className="font-medium">{m.room_number ?? m.room_id}</span> },
            {
              header: "ບັນຫາ",
              cell: (m) => (
                <div className="max-w-md">
                  <p>{m.issue}</p>
                  <p className="text-xs text-slate-500">{m.reporter_name ? `ແຈ້ງໂດຍ ${m.reporter_name}` : "ພະນັກງານແຈ້ງ"}</p>
                </div>
              ),
            },
            { header: "ລະດັບ", cell: (m) => <StatusBadge kind="prio" value={m.priority} /> },
            {
              header: "ສະຖານະ",
              cell: (m) =>
                isStaff ? (
                  <Select
                    className="!w-36 !py-1 text-xs"
                    value={m.status}
                    disabled={busy === `s-${m.id}`}
                    onChange={(e) => setStatus(m, e.target.value as MaintenanceStatus)}
                    options={opts(L.maint)}
                  />
                ) : (
                  <StatusBadge kind="maint" value={m.status} />
                ),
            },
            { header: "ວັນທີແຈ້ງ", cell: (m) => <span className="text-xs text-slate-500">{datetime(m.created_at)}</span> },
            ...(isAdmin
              ? [
                  {
                    header: "",
                    className: "text-right",
                    cell: (m: Maintenance) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={del.busy === `/maintenance/${m.id}`}
                        onClick={() => del.remove(`/maintenance/${m.id}`, "ລາຍການແຈ້ງສ້ອມນີ້", REFRESH)}
                      >
                        <Trash2 className="size-3.5 text-red-600" />
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>

      {creating && <MaintenanceForm onClose={() => setCreating(false)} />}
    </>
  );
}

/** POST /api/maintenance */
function MaintenanceForm({ onClose }: { onClose: () => void }) {
  const { isStaff, user } = useAuth();
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = { roomId: Number(v.roomId), issue: v.issue, priority: v.priority };
    if (isStaff && v.reportedBy) body.reportedBy = Number(v.reportedBy);
    const r = await run("save", () => api.post("/maintenance", body), {
      success: isStaff ? "ບັນທຶກແລ້ວ" : "ແຈ້ງສ້ອມແປງແລ້ວ — ພະນັກງານໄດ້ຮັບແຈ້ງເຕືອນ",
      refresh: REFRESH,
    });
    if (r) onClose();
  };
  return (
    <Modal open title="ແຈ້ງສ້ອມແປງ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="ຫ້ອງ" required>
          <RoomSelect name="roomId" required empty="-- ເລືອກຫ້ອງ --" defaultValue={user?.room_id ?? ""} />
        </Field>
        <Field label="ລາຍລະອຽດບັນຫາ" required>
          <Textarea name="issue" required maxLength={500} placeholder="ເຊັ່ນ: ແອບໍ່ເຢັນ, ນ້ຳຮົ່ວ, ໄຟດັບ..." />
        </Field>
        <Field label="ລະດັບຄວາມດ່ວນ">
          <Select name="priority" options={opts(L.prio)} defaultValue="medium" />
        </Field>
        {isStaff && (
          <Field label="ແຈ້ງແທນນັກສຶກສາ" hint="ບໍ່ເລືອກ = ພະນັກງານແຈ້ງເອງ">
            <StudentSelect name="reportedBy" empty="— ພະນັກງານແຈ້ງເອງ —" />
          </Field>
        )}
        <FormActions onCancel={onClose} loading={busy === "save"} submitText="ສົ່ງແຈ້ງສ້ອມ" />
      </form>
    </Modal>
  );
}
