import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ລະບົບຈັດການຫໍພັກ",
  description: "ຈອງຫ້ອງພັກ, ຈ່າຍຄ່າຫ້ອງ ແລະ ແຈ້ງສ້ອມແປງ ສຳລັບນັກສຶກສາ ແລະ ພະນັກງານຫໍພັກ",
  applicationName: "ລະບົບຈັດການຫໍພັກ",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

/** ສີແຖບ browser ເທິງມືຖື ໃຫ້ກົງກັບສີຂອງລະບົບ */
export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo">
      <body className="font-sans antialiased">
        
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}