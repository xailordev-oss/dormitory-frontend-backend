"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage, revalidate } from "./api";
import { useConfirm } from "@/components/ui";
import { playSound } from "./sound";

/**
 * ເອີ້ນ API ທີ່ປ່ຽນຂໍ້ມູນ (POST/PUT/PATCH/DELETE) ພ້ອມ:
 * - ສະຖານະ loading ແຍກຕາມປຸ່ມ (key)
 * - toast ສຳເລັດ/ລົ້ມເຫຼວ
 * - ໂຫຼດຂໍ້ມູນໜ້າທີ່ກ່ຽວຂ້ອງໃໝ່ (refresh = prefix ຂອງ path)
 */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      opts: { success?: string | ((r: T) => string); refresh?: string[] } = {}
    ): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        const msg = typeof opts.success === "function" ? opts.success(r) : opts.success ?? (r as any)?.message;
        if (msg) {
          toast.success(msg);
          playSound("success"); // ທຸກການກະທຳທີ່ສຳເລັດ (ຈອງ, ອະນຸມັດ, ຮັບເງິນ...) ມີສຽງຢືນຢັນ
        }
        if (opts.refresh?.length) await revalidate(...opts.refresh);
        return r;
      } catch (err) {
        toast.error(errorMessage(err));
        playSound("urgent");
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    []
  );

  return { busy, run };
}

/** ຕົວກອງ + ໜ້າ ສຳລັບລາຍການແບບແບ່ງໜ້າ */
export function useFilters<T extends Record<string, string>>(initial: T) {
  const [filters, setFilters] = useState<T>(initial);
  const [page, setPage] = useState(1);
  const set = useCallback((k: keyof T, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  }, []);
  const reset = useCallback(() => {
    setFilters(initial);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { filters, set, reset, page, setPage };
}

/**
 * ລຶບຂໍ້ມູນ ພ້ອມຢືນຢັນ. ຖ້າ backend ຕອບວ່າຕ້ອງໃຊ້ ?force=true (ມີປະຫວັດ)
 * → ຖາມຢືນຢັນອີກເທື່ອ ແລ້ວລຶບດ້ວຍ force
 */
export function useDelete() {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const remove = useCallback(
    async (path: string, label: string, refresh: string[]) => {
      const ok = await confirm({ title: "ຢືນຢັນການລຶບ", message: `ລຶບ ${label}?\nການກະທຳນີ້ຍ້ອນຄືນບໍ່ໄດ້`, danger: true, confirmText: "ລຶບ" });
      if (!ok) return false;
      setBusy(path);
      try {
        try {
          const r = await api.del<{ message?: string }>(path);
          toast.success(r?.message ?? "ລຶບສຳເລັດ");
        } catch (err) {
          const msg = errorMessage(err);
          if (!msg.includes("force=true")) throw err;
          const force = await confirm({ title: "ຕ້ອງການລຶບແທ້ບໍ?", message: msg, danger: true, confirmText: "ລຶບທັງໝົດ" });
          if (!force) return false;
          const r = await api.del<{ message?: string }>(`${path}${path.includes("?") ? "&" : "?"}force=true`);
          toast.success(r?.message ?? "ລຶບສຳເລັດ");
        }
        await revalidate(...refresh);
        return true;
      } catch (err) {
        toast.error(errorMessage(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [confirm]
  );

  return { busy, remove };
}
