"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X, AlertTriangle, Inbox } from "lucide-react";
import { L, TONE, type Tone } from "@/lib/labels";

/* ============================ ປຸ່ມ ============================ */

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs gap-1" : "px-4 py-2 text-sm gap-2";
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${sz} ${BTN[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ============================ ຟອມ ============================ */

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-100";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select({
  options,
  empty,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: [string | number, string][]; empty?: string }) {
  // ຕົວເລືອກທີ່ໂຫຼດຈາກ API ມາທີຫຼັງ: ໃຫ້ defaultValue ຍັງຖືກເລືອກຢູ່ (ຖ້າຜູ້ໃຊ້ຍັງບໍ່ໄດ້ປ່ຽນເອງ)
  const ref = useRef<HTMLSelectElement>(null);
  const touched = useRef(false);
  const { defaultValue, onChange } = props;
  useEffect(() => {
    if (ref.current && defaultValue !== undefined && props.value === undefined && !touched.current) {
      ref.current.value = String(defaultValue ?? "");
    }
  }, [options.length, defaultValue, props.value]);
  return (
    <select
      ref={ref}
      {...props}
      onChange={(e) => {
        touched.current = true;
        onChange?.(e);
      }}
      className={`${inputCls} ${props.className ?? ""}`}
    >
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** ອ່ານຄ່າຈາກ <form> ເປັນ object (ຕັດຊ່ອງວ່າງຫົວທ້າຍ) */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string") out[k] = v.trim();
  });
  return out;
}

/* ============================ ໂຄງໜ້າ ============================ */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const bg: Record<Tone, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    yellow: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    gray: "bg-slate-100 text-slate-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:gap-4 sm:p-5">
      {icon && <div className={`w-fit rounded-lg p-2.5 ${bg[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-lg leading-tight font-bold break-words text-slate-900 sm:text-xl 2xl:text-2xl">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/* ============================ Badge ============================ */

const BADGE: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

const EXTRA_LABEL: Record<string, string> = { overdue: "ເກີນກຳນົດ" };

/** Badge ສະຖານະ: kind = ກຸ່ມປ້າຍໃນ L (ເຊັ່ນ "booking"), value = ຄ່າສະຖານະ */
export function StatusBadge({ kind, value }: { kind: keyof typeof L; value: string }) {
  const label = (L[kind] as Record<string, string>)[value] ?? EXTRA_LABEL[value] ?? value;
  return <Badge tone={TONE[value] ?? "gray"}>{label}</Badge>;
}

/* ============================ ຕາຕະລາງ ============================ */

export interface Column<T> {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function Table<T extends { id: number | string }>({
  columns,
  rows,
  loading,
  empty = "ຍັງບໍ່ມີຂໍ້ມູນ",
}: {
  columns: Column<T>[];
  rows?: T[];
  loading?: boolean;
  empty?: string;
}) {
  if (loading && !rows) return <Loading />;
  if (!rows || rows.length === 0) return <Empty text={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`px-4 py-3 whitespace-nowrap ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/70">
              {columns.map((c, i) => (
                <td key={i} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (p: number) => void;
}) {
  if (!totalPages || totalPages <= 1) {
    return total !== undefined ? <p className="px-4 py-3 text-xs text-slate-500">ທັງໝົດ {total} ລາຍການ</p> : null;
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">
        ໜ້າ {page} / {totalPages}
        {total !== undefined && ` · ທັງໝົດ ${total} ລາຍການ`}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" /> ກ່ອນໜ້າ
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          ຕໍ່ໄປ <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ============================ ສະຖານະ ============================ */

export function Loading({ text = "ກຳລັງໂຫຼດ..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin" /> {text}
    </div>
  );
}

export function Empty({ text = "ຍັງບໍ່ມີຂໍ້ມູນ" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <Inbox className="size-8" />
      {text}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "ເກີດຂໍ້ຜິດພາດ";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" /> {msg}
      </span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          ລອງໃໝ່
        </Button>
      )}
    </div>
  );
}

/* ============================ Modal ============================ */

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-in rounded-xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="ປິດ">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** ປຸ່ມທ້າຍຟອມໃນ modal */
export function FormActions({ onCancel, loading, submitText = "ບັນທຶກ" }: { onCancel: () => void; loading?: boolean; submitText?: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        ຍົກເລີກ
      </Button>
      <Button type="submit" loading={loading}>
        {submitText}
      </Button>
    </div>
  );
}

/* ============================ ຢືນຢັນ (confirm) ============================ */

interface ConfirmOpts {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOpts) => {
    setState(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} title={state?.title ?? "ຢືນຢັນ"} onClose={() => close(false)}>
        <p className="text-sm whitespace-pre-line text-slate-600">{state?.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            ຍົກເລີກ
          </Button>
          <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {state?.confirmText ?? "ຕົກລົງ"}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm ຕ້ອງໃຊ້ພາຍໃນ <ConfirmProvider>");
  return ctx;
}

/* ============================ ແຖບຕົວກອງ ============================ */

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
