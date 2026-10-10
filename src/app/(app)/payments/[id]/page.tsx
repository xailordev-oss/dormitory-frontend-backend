"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import { L, date, datetime, money } from "@/lib/labels";
import type { PaymentDocument } from "@/lib/types";
import { Button, ErrorBox, Loading, StatusBadge } from "@/components/ui";

/** GET /api/payments/:id/invoice ແລະ /receipt — ພິມໄດ້ (Ctrl+P / ປຸ່ມພິມ) */
export default function PaymentDocPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const kind = params.get("kind") === "receipt" ? "receipt" : "invoice";
  const { data, error } = useApi<{ data: PaymentDocument }>(`/payments/${id}/${kind}`);

  const tab = (k: "invoice" | "receipt", label: string) => (
    <button
      onClick={() => router.replace(`/payments/${id}${k === "receipt" ? "?kind=receipt" : ""}`)}
      className={`rounded-lg px-4 py-2 text-sm font-medium ${kind === k ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/payments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" /> ກັບໄປລາຍການຊຳລະ
        </Link>
        <div className="flex gap-2">
          {tab("invoice", "ໃບແຈ້ງໜີ້")}
          {tab("receipt", "ໃບຮັບເງິນ")}
          <Button variant="secondary" onClick={() => window.print()} disabled={!data}>
            <Printer className="size-4" /> ພິມ
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <Doc d={data.data} />
      )}
    </>
  );
}

function Doc({ d }: { d: PaymentDocument }) {
  const isReceipt = d.kind === "receipt";
  return (
    <article className="print-area mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm text-slate-500">ລະບົບຈັດການຫໍພັກ</p>
          <h1 className="mt-1 text-2xl font-bold">{isReceipt ? "ໃບຮັບເງິນ" : "ໃບແຈ້ງໜີ້"}</h1>
          <p className="text-xs tracking-wide text-slate-400 uppercase">{isReceipt ? "Receipt" : "Invoice"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{d.documentNo ?? "—"}</p>
          <p className="text-slate-500">ອອກວັນທີ {date(d.issuedAt)}</p>
          <div className="mt-2 flex justify-end gap-1">
            <StatusBadge kind="pay" value={d.status} />
            {d.isOverdue && <StatusBadge kind="pay" value="overdue" />}
          </div>
        </div>
      </header>

      <section className="grid gap-6 py-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase">ນັກສຶກສາ</p>
          <p className="mt-1 font-medium">{d.student?.name ?? "—"}</p>
          <p className="text-slate-500">{d.student?.email}</p>
          <p className="text-slate-500">{d.student?.phone}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase">ຫ້ອງພັກ</p>
          <p className="mt-1 font-medium">{d.room ? `ຫ້ອງ ${d.room.roomNumber}` : "—"}</p>
          <p className="text-slate-500">{d.room?.buildingName}</p>
        </div>
      </section>

      <table className="w-full text-sm">
        <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">ລາຍການ</th>
            <th className="px-3 py-2">ເດືອນ</th>
            <th className="px-3 py-2 text-right">ຈຳນວນ</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-3">
              <p className="font-medium">{d.item.typeLabel}</p>
              {d.item.description && <p className="text-xs text-slate-500">{d.item.description}</p>}
            </td>
            <td className="px-3 py-3">{d.item.billingMonth ?? "—"}</td>
            <td className="px-3 py-3 text-right">{money(d.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="px-3 py-3 text-right font-semibold">
              ລວມທັງໝົດ
            </td>
            <td className="px-3 py-3 text-right text-lg font-bold">{money(d.amount)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-6 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">ວິທີຊຳລະ: </span>
          {L.method[d.method]}
        </p>
        <p>
          <span className="text-slate-500">ກຳນົດຊຳລະ: </span>
          {date(d.dueDate)}
        </p>
        {isReceipt && (
          <p className="sm:col-span-2">
            <span className="text-slate-500">ຊຳລະເມື່ອ: </span>
            {datetime(d.paidAt)}
          </p>
        )}
        {d.invoiceNo && isReceipt && (
          <p className="sm:col-span-2 text-xs text-slate-500">ອ້າງອີງໃບແຈ້ງໜີ້: {d.invoiceNo}</p>
        )}
      </section>

      <footer className="mt-10 flex justify-end text-center text-sm">
        <div className="w-48 border-t border-slate-300 pt-2 text-slate-500">{isReceipt ? "ຜູ້ຮັບເງິນ" : "ຜູ້ອອກໃບແຈ້ງໜີ້"}</div>
      </footer>
    </article>
  );
}
