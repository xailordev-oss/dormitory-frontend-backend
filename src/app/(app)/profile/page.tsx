"use client";

import { CalendarDays, DoorOpen, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { L, date } from "@/lib/labels";
import { Badge, Button, Card, Field, Input, PageHeader, formValues } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";
import { useSlides } from "@/components/HeroSlider";

/**
 * ໂປຣໄຟລ໌: ເບິ່ງໄດ້ຢ່າງດຽວ (ຂໍ້ມູນສ່ວນຕົວ ແລະ ຮູບ ແກ້ໄດ້ໂດຍຜູ້ດູແລລະບົບ)
 * GET /api/auth/me · PUT /api/auth/change-password
 */
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const n = useNotifications();
  const { busy, run } = useAction();
  const { slides } = useSlides();

  if (!user) return null;

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = formValues(form);
    if (v.newPassword !== v.confirm) return toast.error("ລະຫັດຜ່ານໃໝ່ທັງສອງຊ່ອງບໍ່ກົງກັນ");
    const r = await run("pw", () => api.put("/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword }));
    if (r) {
      form.reset();
      // backend ຖອນ refresh token ທຸກອັນ → ໃຫ້ login ໃໝ່
      setTimeout(() => void logout(false), 1500);
    }
  };

  return (
    <>
      <PageHeader title="ໂປຣໄຟລ໌ຂອງຂ້ອຍ" />
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ບັດໂປຣໄຟລ໌: ຮູບປົກ (ຮູບທຳອິດຈາກໂຟນເດີ images) + ຮູບໂປຣໄຟລ໌ + ຂໍ້ມູນ */}
        <section className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-28 bg-gradient-to-br from-brand-600 to-brand-900">
            {slides[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slides[0].src} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
          </div>

          <div className="flex flex-col items-center px-6 pb-6 text-center">
            <div className="relative -mt-14">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" className="size-28 rounded-full object-cover ring-4 ring-white shadow-md" />
              ) : (
                <span className="flex size-28 items-center justify-center rounded-full bg-brand-100 text-4xl font-bold text-brand-700 ring-4 ring-white shadow-md">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900">{user.name}</h2>
            <p className="max-w-full truncate text-sm text-slate-500">{user.email}</p>
            <div className="mt-3">
              <Badge tone={user.role === "admin" ? "purple" : user.role === "staff" ? "blue" : "gray"}>{L.role[user.role]}</Badge>
            </div>

            <dl className="mt-6 w-full divide-y divide-slate-100 rounded-xl bg-slate-50 text-left text-sm">
              <InfoRow icon={<DoorOpen className="size-4" />} label="ຫ້ອງ">
                {user.room_number ? (
                  <>
                    {user.room_number}
                    {user.building_name && <span className="block text-xs font-normal text-slate-500">{user.building_name}</span>}
                  </>
                ) : (
                  <span className="font-normal text-slate-400">ຍັງບໍ່ມີຫ້ອງ</span>
                )}
              </InfoRow>
              <InfoRow icon={<Phone className="size-4" />} label="ເບີໂທ">
                {user.phone ?? <span className="font-normal text-slate-400">—</span>}
              </InfoRow>
              <InfoRow icon={<CalendarDays className="size-4" />} label="ສະໝັກເມື່ອ">
                {date(user.created_at)}
              </InfoRow>
            </dl>
            <p className="mt-4 text-xs text-slate-500">ຕ້ອງການປ່ຽນຂໍ້ມູນ ຫຼື ຮູບໂປຣໄຟລ໌ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ</p>
          </div>
        </section>

        <div className="space-y-6 lg:col-span-2">
          {user.role === "student" && !user.student_id && (
            <Card>
              <p className="text-sm text-amber-700">ບັນຊີຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ</p>
            </Card>
          )}

          <Card title="ປ່ຽນລະຫັດຜ່ານ">
            <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
              <Field label="ລະຫັດປັດຈຸບັນ" required>
                <Input name="currentPassword" type="password" required autoComplete="current-password" />
              </Field>
              <Field label="ລະຫັດໃໝ່" required hint="ຢ່າງໜ້ອຍ 8 ຕົວ">
                <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
              <Field label="ຢືນຢັນລະຫັດໃໝ່" required>
                <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
              <div className="sm:col-span-3">
                <Button type="submit" loading={busy === "pw"}>
                  ປ່ຽນລະຫັດຜ່ານ
                </Button>
                <span className="ml-3 text-xs text-slate-500">ປ່ຽນແລ້ວຕ້ອງເຂົ້າສູ່ລະບົບໃໝ່ທຸກອຸປະກອນ</span>
              </div>
            </form>
          </Card>

          <Card title="ການແຈ້ງເຕືອນ">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  ສຽງແຈ້ງເຕືອນ (ເປີດສະເໝີ){" "}
                  {n.soundReady ? <Badge tone="green">ພ້ອມ</Badge> : <Badge tone="yellow">ກົດໜ້າເວັບ 1 ເທື່ອເພື່ອເປີດ</Badge>}
                </span>
                <Button size="sm" variant="secondary" onClick={n.testSound}>
                  🔊 ທົດສອບສຽງ
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>ແຈ້ງເຕືອນຂອງ browser (ແຈ້ງແມ້ບໍ່ໄດ້ເປີດ tab ນີ້)</span>
                {n.browserPermission === "granted" ? (
                  <Badge tone="green">ເປີດແລ້ວ</Badge>
                ) : n.browserPermission === "denied" ? (
                  <Badge tone="red">ຖືກບລັອກ — ເປີດໃນການຕັ້ງຄ່າ browser</Badge>
                ) : n.browserPermission === "unsupported" ? (
                  <Badge>browser ບໍ່ຮອງຮັບ</Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void n.requestBrowserPermission()}>
                    ເປີດ
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/** ແຖວຂໍ້ມູນໃນບັດໂປຣໄຟລ໌ */
function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">{icon}</span>
      <dt className="flex-1 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}