"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { Button, Field, Input, formValues } from "@/components/ui";

/** POST /api/auth/reset-password  (ລິ້ງຈາກອີເມວ: /reset-password?token=...) */
export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (v.newPassword !== v.confirm) return setError("ລະຫັດຜ່ານທັງສອງຊ່ອງບໍ່ກົງກັນ");
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ message: string }>("/auth/reset-password", { token: v.token, newPassword: v.newPassword });
      toast.success(res.message);
      router.replace("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 lg:text-2xl">ຕັ້ງລະຫັດຜ່ານໃໝ່</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label="Token" required hint="ມາຈາກລິ້ງໃນອີເມວ">
        <Input name="token" required defaultValue={params.get("token") ?? ""} />
      </Field>
      <Field label="ລະຫັດຜ່ານໃໝ່" required hint="ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ">
        <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="ຢືນຢັນລະຫັດຜ່ານໃໝ່" required>
        <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Button type="submit" loading={busy} className="w-full">
        ບັນທຶກລະຫັດຜ່ານໃໝ່
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand-600 hover:underline">
          ← ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ
        </Link>
      </p>
    </form>
  );
}
