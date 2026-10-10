"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, clean, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Field, Input, formValues } from "@/components/ui";

/** POST /api/auth/register → ສະໝັກແລ້ວ login ໃຫ້ອັດຕະໂນມັດ */
export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (v.password !== v.confirm) return setError("ລະຫັດຜ່ານທັງສອງຊ່ອງບໍ່ກົງກັນ");
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ message: string; needsLinking: boolean }>(
        "/auth/register",
        clean({ name: v.name, email: v.email, password: v.password, phone: v.phone })
      );
      if (res.needsLinking) toast.warning(res.message, { duration: 10000 });
      else toast.success(res.message);
      await login(v.email, v.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 lg:text-2xl">ສະໝັກສະມາຊິກ (ນັກສຶກສາ)</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label="ຊື່ ແລະ ນາມສະກຸນ" required>
        <Input name="name" required maxLength={150} autoFocus />
      </Field>
      <Field label="ອີເມວ" required>
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="ເບີໂທ">
        <Input name="phone" maxLength={30} placeholder="020xxxxxxxx" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ລະຫັດຜ່ານ" required hint="ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="ຢືນຢັນລະຫັດຜ່ານ" required>
          <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
      </div>
      <Button type="submit" loading={busy} className="w-full">
        ສະໝັກສະມາຊິກ
      </Button>
      <p className="text-center text-sm text-slate-500">
        ມີບັນຊີແລ້ວ?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          ເຂົ້າສູ່ລະບົບ
        </Link>
      </p>
    </form>
  );
}
