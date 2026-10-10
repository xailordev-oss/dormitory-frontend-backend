"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { Button, Field, Input, formValues } from "@/components/ui";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.get("expired")) setError("ໝົດເວລາເຂົ້າສູ່ລະບົບ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່");
  }, [params]);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const me = await login(v.email, v.password);
      toast.success(`ຍິນດີຕ້ອນຮັບ ${me.name}`);
      router.replace(next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 lg:text-2xl">ເຂົ້າສູ່ລະບົບ</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label="ອີເມວ" required>
        <Input name="email" type="email" autoComplete="email" required autoFocus placeholder="name@example.com" />
      </Field>
      <Field label="ລະຫັດຜ່ານ" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-brand-600 hover:underline">
          ລືມລະຫັດຜ່ານ?
        </Link>
      </div>
      <Button type="submit" loading={busy} className="w-full">
        ເຂົ້າສູ່ລະບົບ
      </Button>
      <p className="text-center text-sm text-slate-500">
        ຍັງບໍ່ມີບັນຊີ?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          ສະໝັກສະມາຊິກ
        </Link>
      </p>
    </form>
  );
}
