"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { Button, Field, Input, formValues } from "@/components/ui";

/** POST /api/auth/forgot-password */
export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; resetToken?: string } | null>(null);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await api.post("/auth/forgot-password", { email: formValues(e.currentTarget).email }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 lg:text-2xl">ລືມລະຫັດຜ່ານ</h2>
      {result ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result.message}</p>
          {result.resetToken && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">ໂໝດພັດທະນາ (ບໍ່ໄດ້ຕັ້ງ SMTP):</p>
              <Link href={`/reset-password?token=${result.resetToken}`} className="text-brand-600 underline">
                ກົດທີ່ນີ້ເພື່ອຕັ້ງລະຫັດຜ່ານໃໝ່
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">ປ້ອນອີເມວທີ່ໃຊ້ສະໝັກ ລະບົບຈະສົ່ງລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້</p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Field label="ອີເມວ" required>
            <Input name="email" type="email" required autoFocus />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            ສົ່ງລິ້ງຕັ້ງລະຫັດໃໝ່
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand-600 hover:underline">
          ← ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ
        </Link>
      </p>
    </div>
  );
}
