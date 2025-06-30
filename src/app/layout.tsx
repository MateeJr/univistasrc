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
            <main className="mt-14 md:mt-0 md:ml-20">
              {children}
            </main>
          </InitialLoader>
        </ServerMonitor>
      </body>
    </html>
  );
}
