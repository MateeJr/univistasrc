import type { Metadata } from "next";
import "./globals.css";
import PageSwitcher from "@/components/PageSwitcher";
import FetchProxy from "@/components/FetchProxy";
import InitialLoader from "@/components/InitialLoader";
import ServerMonitor from "@/components/ServerMonitor";

// Load Outfit font via next/font for automatic optimization
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Univista Utama Dashboard",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.className}>
      <body className="bg-black text-gray-100 min-h-screen overflow-auto">
        <FetchProxy />
        <ServerMonitor>
          <InitialLoader>
            <PageSwitcher />
            {/* Watermark version info */}
            <div className="fixed bottom-1 left-1/2 -translate-x-1/2 text-[10px] md:text-xs text-gray-500 opacity-70 pointer-events-none select-none z-50 md:top-0.5 md:bottom-auto">
              Versi: v.0.6.0 · Terakhir Update: 23 Juli
            </div>
            <main className="mt-14 md:mt-0 md:ml-20">
              {children}
            </main>
          </InitialLoader>
        </ServerMonitor>
      </body>
    </html>
  );
}
