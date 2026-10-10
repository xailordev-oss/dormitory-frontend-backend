"use client";

import { useState } from "react";
import { Empty } from "./ui";

/*
 * ກຣາຟແບບງ່າຍ (HTML/CSS ລ້ວນ ບໍ່ຕ້ອງໃຊ້ library)
 * - ສີດຽວ (brand) ເພາະທຸກກຣາຟມີ 1 ຊຸດຂໍ້ມູນ → ບໍ່ຕ້ອງມີ legend, ຫົວຂໍ້ Card ບອກວ່າແມ່ນຫຍັງ
 * - ແທ່ງບາງ ປາຍມົນ 4px, ຕົວເລກໃຊ້ສີຕົວອັກສອນ (ບໍ່ໃຊ້ສີແທ່ງ)
 * - hover → tooltip ສະແດງຄ່າ
 */

interface Item {
  label: string;
  value: number;
  detail?: string;
}

/** ແທ່ງແນວນອນ — ປຽບທຽບຂະໜາດລະຫວ່າງກຸ່ມ */
export function BarList({ items, max, unit = "", format }: { items: Item[]; max?: number; unit?: string; format?: (n: number) => string }) {
  if (!items.length) return <Empty text="ຍັງບໍ່ມີຂໍ້ມູນ" />;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  const fmt = format ?? ((n: number) => `${n.toLocaleString("en-US")}${unit}`);
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${fmt(it.value)}${it.detail ? ` · ${it.detail}` : ""}`}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{it.label}</span>
            <span className="font-medium text-slate-900 tabular-nums">{fmt(it.value)}</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className="h-full rounded bg-brand-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (it.value / top) * 100))}%` }} />
          </div>
          {it.detail && <p className="mt-0.5 text-xs text-slate-500">{it.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

/** ແທ່ງແນວຕັ້ງ — ການປ່ຽນແປງຕາມເວລາ (ລາຍເດືອນ) */
export function ColumnChart({ items, format }: { items: Item[]; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!items.length) return <Empty text="ຍັງບໍ່ມີລາຍຮັບໃນຊ່ວງນີ້" />;
  const top = Math.max(...items.map((i) => i.value), 1);
  const peak = items.reduce((a, b) => (b.value > a.value ? b : a));
  return (
    <div>
      <div className="relative flex h-56 items-end gap-1.5 border-b border-slate-200 pt-6">
        {items.map((it, i) => (
          <div
            key={it.label}
            className="relative flex h-full flex-1 items-end justify-center"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {(hover === i || (hover === null && it === peak)) && (
              <span className="absolute z-10 -translate-y-full rounded bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow" style={{ bottom: `${(it.value / top) * 100}%` }}>
                {it.label}: {format(it.value)}
              </span>
            )}
            <div
              className={`w-full max-w-10 rounded-t transition-all ${hover === i ? "bg-brand-800" : "bg-brand-600"}`}
              style={{ height: `${Math.max(1, (it.value / top) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {items.map((it) => (
          <span key={it.label} className="flex-1 truncate text-center text-[11px] text-slate-500">
            {it.label.slice(5) || it.label}
          </span>
        ))}
      </div>
    </div>
  );
}
