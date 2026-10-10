"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FileText, Receipt, BellRing, CalendarPlus, Banknote } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useFilters } from "@/lib/hooks";
import { L, date, money, nextMonth, opts, today } from "@/lib/labels";
import type { GenerateResult, Paged, Payment, PaymentTotals } from "@/lib/types";
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
  StatCard,
  StatusBadge,
  Table,
  Textarea,
  formValues,
  useConfirm,
} from "@/components/ui";
import { StudentSelect } from "@/components/pickers";

const REFRESH = ["/payments", "/reports"];

export default function PaymentsPage() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffPayments /> : <MyPayments />;
}

/* ======================== ນັກສຶກສາ: GET /api/payments/student/:id ======================== */
function MyPayments() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const sid = user?.student_id;
  const { data, error, isLoading } = useApi<Paged<Payment> & PaymentTotals>(sid ? `/payments/student/${sid}?page=${page}&limit=20` : null);

  if (!sid) return <ErrorBox error={new Error("ບັນຊີນີ້ຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ")} />;
  return (
    <>
      <PageHeader title="ບິນ ແລະ ການຊຳລະຂອງຂ້ອຍ" description="ເມື່ອມີບິນໃໝ່ ຫຼື ຮັບເງິນແລ້ວ ທ່ານຈະໄດ້ຮັບແຈ້ງເຕືອນ" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ຊຳລະແລ້ວ" value={money(data?.totalPaid)} tone="green" />
        <StatCard label="ຄ້າງຊຳລະ" value={money(data?.totalPending)} tone="yellow" />
        <StatCard label="ເກີນກຳນົດ" value={money(data?.totalOverdue)} tone={data?.totalOverdue ? "red" : "gray"} />
      </div>
      {error && <ErrorBox error={error} />}
      <Card padded={false}>
        <Table loading={isLoading} rows={data?.data} empty="ຍັງບໍ່ມີບິນ" columns={paymentColumns(false)} />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      </Card>
      <p className="mt-3 text-xs text-slate-500">ຊຳລະເງິນໄດ້ທີ່ຫ້ອງການຫໍພັກ — ພະນັກງານຈະບັນທຶກ ແລະ ອອກໃບຮັບເງິນໃຫ້</p>
    </>
  );
}

function paymentColumns(staff: boolean, actions?: (p: Payment) => React.ReactNode) {
  return [
    { header: "ເລກບິນ", cell: (p: Payment) => <span className="text-xs text-slate-500">{p.invoice_no ?? `#${p.id}`}</span> },
    ...(staff
      ? [
          {
            header: "ນັກສຶກສາ",
            cell: (p: Payment) => (
              <div>
                <p className="font-medium">{p.student_name}</p>
                <p className="text-xs text-slate-500">{p.room_number ? `ຫ້ອງ ${p.room_number}` : ""}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "ລາຍການ",
      cell: (p: Payment) => (
        <div>
          <p>{p.description || L.ptype[p.type]}</p>
          <p className="text-xs text-slate-500">
            {L.ptype[p.type]} {p.billing_month && `· ${p.billing_month}`}
          </p>
        </div>
      ),
    },
    { header: "ຈຳນວນ", className: "text-right", cell: (p: Payment) => <span className="font-semibold">{money(p.amount)}</span> },
    { header: "ກຳນົດຊຳລະ", cell: (p: Payment) => date(p.due_date) },
    {
      header: "ສະຖານະ",
      cell: (p: Payment) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge kind="pay" value={p.status} />
          {Number(p.is_overdue) === 1 && <StatusBadge kind="pay" value="overdue" />}
        </div>
      ),
    },
    {
      header: "",
      className: "text-right",
      cell: (p: Payment) => (
        <div className="flex justify-end gap-1">
          {actions?.(p)}
          <Link href={`/payments/${p.id}`} title="ໃບແຈ້ງໜີ້">
            <Button size="sm" variant="ghost">
              <FileText className="size-3.5" />
            </Button>
          </Link>
          {(p.status === "paid" || p.status === "refunded") && (
            <Link href={`/payments/${p.id}?kind=receipt`} title="ໃບຮັບເງິນ">
              <Button size="sm" variant="ghost">
                <Receipt className="size-3.5 text-emerald-600" />
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];
}

/* ======================== Admin / Staff: GET /api/payments ======================== */
function StaffPayments() {
  const { isAdmin } = useAuth();
  const params = useSearchParams();
  const f = useFilters({
    status: params.get("status") ?? "",
    method: "",
    type: "",
    studentId: params.get("studentId") ?? "",
    billingMonth: "",
    overdue: params.get("overdue") ?? "",
    from: "",
    to: "",
  });
  const urlOverdue = params.get("overdue");
  useEffect(() => {
    if (urlOverdue !== null) f.set("overdue", urlOverdue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOverdue]);

  const { data, error, isLoading, mutate } = useApi<Paged<Payment> & { summary: PaymentTotals }>(
    `/payments${qs({ ...f.filters, page: f.page, limit: 20 })}`
  );
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [generating, setGenerating] = useState(false);
  const { busy, run } = useAction();
  const confirm = useConfirm();

  const setStatus = async (p: Payment, status: "failed" | "refunded" | "pending") => {
    const msg = { failed: "ໝາຍວ່າຊຳລະລົ້ມເຫຼວ", refunded: "ຄືນເງິນ (refund)", pending: "ປ່ຽນກັບເປັນຄ້າງຊຳລະ" }[status];
    if (!(await confirm({ message: `${msg}: ${p.student_name} ${money(p.amount)}?`, danger: status !== "pending" }))) return;
    await run(`s-${p.id}`, () => api.put(`/payments/${p.id}/status`, { status }), { refresh: REFRESH });
  };

  const remind = async () => {
    if (!(await confirm({ message: "ສົ່ງແຈ້ງເຕືອນຫາທຸກຄົນທີ່ມີບິນເກີນກຳນົດ?", confirmText: "ສົ່ງແຈ້ງເຕືອນ" }))) return;
    await run("remind", () => api.post("/payments/send-reminders"), { refresh: ["/notifications"] });
  };

  return (
    <>
      <PageHeader
        title="ການຊຳລະເງິນ"
        actions={
          <>
            {isAdmin && (
              <>
                <Button variant="secondary" onClick={remind} loading={busy === "remind"}>
                  <BellRing className="size-4" /> ແຈ້ງເຕືອນຄ້າງຈ່າຍ
                </Button>
                <Button variant="secondary" onClick={() => setGenerating(true)}>
                  <CalendarPlus className="size-4" /> ອອກບິນລາຍເດືອນ
                </Button>
              </>
            )}
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> ບັນທຶກລາຍການ
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ຊຳລະແລ້ວ (ຕາມຕົວກອງ)" value={money(data?.summary?.totalPaid)} tone="green" />
        <StatCard label="ຄ້າງຊຳລະ" value={money(data?.summary?.totalPending)} tone="yellow" />
        <StatCard label="ເກີນກຳນົດ" value={money(data?.summary?.totalOverdue)} tone="red" />
      </div>

      <FilterBar>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.pay)} empty="ທຸກສະຖານະ" />
        <Select value={f.filters.type} onChange={(e) => f.set("type", e.target.value)} options={opts(L.ptype)} empty="ທຸກປະເພດ" />
        <Select value={f.filters.method} onChange={(e) => f.set("method", e.target.value)} options={opts(L.method)} empty="ທຸກວິທີຊຳລະ" />
        <StudentSelect value={f.filters.studentId} onChange={(e) => f.set("studentId", e.target.value)} empty="ນັກສຶກສາທຸກຄົນ" />
        <Select value={f.filters.overdue} onChange={(e) => f.set("overdue", e.target.value)} options={[["true", "ສະເພາະເກີນກຳນົດ"]]} empty="ທັງໝົດ" />
        <Input type="month" value={f.filters.billingMonth} onChange={(e) => f.set("billingMonth", e.target.value)} title="ເດືອນຂອງບິນ" />
        <Input type="date" value={f.filters.from} onChange={(e) => f.set("from", e.target.value)} title="ຈາກວັນທີ" />
        <Input type="date" value={f.filters.to} onChange={(e) => f.set("to", e.target.value)} title="ຮອດວັນທີ" />
        <Button variant="ghost" onClick={f.reset}>
          ລ້າງຕົວກອງ
        </Button>
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          empty="ບໍ່ມີລາຍການ"
          columns={paymentColumns(true, (p) => (
            <>
              {(p.status === "pending" || p.status === "failed") && (
                <Button size="sm" variant="success" onClick={() => setPaying(p)}>
                  <Banknote className="size-3.5" /> ຮັບເງິນ
                </Button>
              )}
              {p.status === "pending" && (
                <Button size="sm" variant="ghost" loading={busy === `s-${p.id}`} onClick={() => setStatus(p, "failed")}>
                  ລົ້ມເຫຼວ
                </Button>
              )}
              {p.status === "failed" && (
                <Button size="sm" variant="ghost" loading={busy === `s-${p.id}`} onClick={() => setStatus(p, "pending")}>
                  ຄ້າງຊຳລະ
                </Button>
              )}
              {isAdmin && p.status === "paid" && (
                <Button size="sm" variant="ghost" loading={busy === `s-${p.id}`} onClick={() => setStatus(p, "refunded")}>
                  ຄືນເງິນ
                </Button>
              )}
            </>
          ))}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>

      {creating && <PaymentForm onClose={() => setCreating(false)} />}
      {paying && <ReceiveModal payment={paying} onClose={() => setPaying(null)} />}
      {generating && <GenerateModal onClose={() => setGenerating(false)} />}
    </>
  );
}

/** PUT /api/payments/:id/status → paid (ອອກເລກໃບຮັບເງິນ + ແຈ້ງນັກສຶກສາ) */
function ReceiveModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const r = await run("pay", () => api.put(`/payments/${payment.id}/status`, { status: "paid", method: v.method }), {
      success: "ຮັບເງິນສຳເລັດ — ອອກໃບຮັບເງິນ ແລະ ແຈ້ງນັກສຶກສາແລ້ວ",
      refresh: REFRESH,
    });
    if (r) onClose();
  };
  return (
    <Modal open title="ຮັບຊຳລະເງິນ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium">{payment.student_name}</p>
          <p className="text-slate-500">{payment.description || L.ptype[payment.type]}</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{money(payment.amount)}</p>
        </div>
        <Field label="ວິທີຊຳລະ" required>
          <Select name="method" options={opts(L.method)} defaultValue={payment.method} />
        </Field>
        <FormActions onCancel={onClose} loading={busy === "pay"} submitText="ຢືນຢັນຮັບເງິນ" />
      </form>
    </Modal>
  );
}

/** POST /api/payments */
function PaymentForm({ onClose }: { onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = {
      studentId: Number(v.studentId),
      amount: Number(v.amount),
      method: v.method,
      type: v.type,
      status: v.status,
    };
    if (v.billingMonth) body.billingMonth = v.billingMonth;
    if (v.dueDate) body.dueDate = v.dueDate;
    if (v.description) body.description = v.description;
    const r = await run("save", () => api.post("/payments", body), { refresh: REFRESH });
    if (r) onClose();
  };
  return (
    <Modal open title="ບັນທຶກລາຍການຊຳລະ / ອອກບິນ" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ນັກສຶກສາ" required className="sm:col-span-2">
          <StudentSelect name="studentId" required empty="-- ເລືອກນັກສຶກສາ --" />
        </Field>
        <Field label="ຈຳນວນເງິນ (ກີບ)" required>
          <Input name="amount" type="number" min={1} required />
        </Field>
        <Field label="ປະເພດ">
          <Select name="type" options={opts(L.ptype)} defaultValue="rent" />
        </Field>
        <Field label="ວິທີຊຳລະ" required>
          <Select name="method" options={opts(L.method)} defaultValue="cash" />
        </Field>
        <Field label="ສະຖານະ" hint="ຊຳລະແລ້ວ = ອອກໃບຮັບເງິນທັນທີ">
          <Select name="status" options={[["pending", L.pay.pending], ["paid", L.pay.paid]]} defaultValue="pending" />
        </Field>
        <Field label="ເດືອນຂອງບິນ">
          <Input name="billingMonth" type="month" />
        </Field>
        <Field label="ກຳນົດຊຳລະ">
          <Input name="dueDate" type="date" />
        </Field>
        <Field label="ລາຍລະອຽດ" className="sm:col-span-2">
          <Textarea name="description" maxLength={255} rows={2} />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} />
        </div>
      </form>
    </Modal>
  );
}

/** POST /api/payments/generate-monthly — ເບິ່ງຕົວຢ່າງ (dryRun) ກ່ອນ ແລ້ວຈຶ່ງອອກບິນຈິງ */
function GenerateModal({ onClose }: { onClose: () => void }) {
  const { busy, run } = useAction();
  const [preview, setPreview] = useState<GenerateResult | null>(null);
  const [body, setBody] = useState<Record<string, unknown> | null>(null);

  const doPreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const b = { month: v.month, dueDay: Number(v.dueDay), type: v.type, splitRoom: v.splitRoom === "on" };
    setBody(b);
    const r = await run("preview", () => api.post<GenerateResult>("/payments/generate-monthly", { ...b, dryRun: true }), { success: "" });
    if (r) setPreview(r);
  };

  const doGenerate = async () => {
    if (!body) return;
    const r = await run("gen", () => api.post<GenerateResult>("/payments/generate-monthly", body), {
      refresh: REFRESH,
    });
    if (r) onClose();
  };

  return (
    <Modal open title="ອອກບິນຄ່າເຊົ່າລາຍເດືອນ" onClose={onClose} wide>
      <form onSubmit={doPreview} className="grid gap-4 sm:grid-cols-4">
        <Field label="ເດືອນ" required>
          <Input name="month" type="month" required defaultValue={nextMonth()} />
        </Field>
        <Field label="ກຳນົດຈ່າຍວັນທີ" hint="1–28">
          <Input name="dueDay" type="number" min={1} max={28} defaultValue={5} />
        </Field>
        <Field label="ປະເພດ">
          <Select name="type" options={opts(L.ptype)} defaultValue="rent" />
        </Field>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" name="splitRoom" className="size-4" /> ຫານລາຄາຫ້ອງຕາມຈຳນວນຄົນ
        </label>
        <div className="sm:col-span-4">
          <Button type="submit" variant="secondary" loading={busy === "preview"}>
            ເບິ່ງຕົວຢ່າງກ່ອນ
          </Button>
        </div>
      </form>

      {preview && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            ຈະອອກບິນ <b>{preview.created}</b> ລາຍການ · ລວມ <b>{money(preview.totalAmount)}</b> · ກຳນົດຈ່າຍ {preview.dueDate}
            {preview.skipped > 0 && ` · ຂ້າມ ${preview.skipped} ຄົນ (ມີບິນເດືອນນີ້ແລ້ວ)`}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            <Table
              rows={preview.data.map((d) => ({ ...d, id: d.studentId }))}
              empty="ບໍ່ມີໃຜຕ້ອງອອກບິນ"
              columns={[
                { header: "ນັກສຶກສາ", cell: (d) => d.studentName },
                { header: "ຫ້ອງ", cell: (d) => d.roomNumber },
                { header: "ຈຳນວນ", className: "text-right", cell: (d) => money(d.amount) },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              ປິດ
            </Button>
            <Button onClick={doGenerate} loading={busy === "gen"} disabled={preview.created === 0}>
              ອອກບິນ {preview.created} ລາຍການ + ແຈ້ງນັກສຶກສາ
            </Button>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">ອອກໃຫ້ນັກສຶກສາທີ່ສະຖານະ &quot;ພັກຢູ່&quot; ແລະ ມີຫ້ອງ. ແລ່ນຊ້ຳໄດ້ປອດໄພ — ຄົນທີ່ມີບິນແລ້ວຈະຖືກຂ້າມ. ວັນນີ້: {today()}</p>
    </Modal>
  );
}
