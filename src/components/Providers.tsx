"use client";

import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";
import { ConfirmProvider } from "./ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
      </NotificationProvider>
    </AuthProvider>
  );
}
