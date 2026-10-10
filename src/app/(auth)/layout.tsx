import { Suspense } from "react";
import { Home } from "lucide-react";
import { Loading } from "@/components/ui";
import { HeroSlider } from "@/components/HeroSlider";

/** ຫົວຂໍ້ທີ່ວາງທັບຮູບ */
function Brand() {
  return (
    <div className="max-w-xl">
      <span className="mb-4 hidden rounded-2xl bg-white/15 p-2.5 ring-1 ring-white/25 backdrop-blur sm:inline-flex lg:mb-6">
        <Home className="size-6" />
      </span>
      <h1 className="text-2xl leading-snug font-bold sm:text-3xl lg:text-4xl">ລະບົບຈັດການຫໍພັກ</h1>
      <p className="mt-2 hidden text-white/80 sm:block lg:text-lg">ຈອງຫ້ອງ, ຈ່າຍຄ່າຫ້ອງ ແລະ ແຈ້ງສ້ອມແປງ ໄດ້ໃນບ່ອນດຽວ</p>
    </div>
  );
}

const HERO = "h-56 sm:h-72 lg:sticky lg:top-0 lg:h-screen";
const PAD = "p-5 pb-10 sm:p-8 sm:pb-12 lg:p-12";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.2fr_1fr] lg:bg-white">
      <HeroSlider
        className={HERO}
        padding={PAD}
        fallback={
          <div className={`flex flex-col justify-end bg-gradient-to-br from-brand-700 to-brand-900 text-white ${PAD} ${HERO}`}>
            <Brand />
          </div>
        }
      >
        <Brand />
      </HeroSlider>

      <div className="relative -mt-5 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
