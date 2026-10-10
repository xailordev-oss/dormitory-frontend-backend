"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    // ລິ້ງຕັ້ງລະຫັດໃໝ່ຈາກອີເມວຂອງ backend ມີຮູບແບບ /#/reset-password?token=...
    const hash = window.location.hash;
    if (hash.startsWith("#/reset-password")) {
      router.replace(`/reset-password${hash.slice("#/reset-password".length)}`);
      return;
    }
    if (!loading) router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);
  return <Loading />;
}
