'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconType } from "react-icons";
import { FaHome, FaTasks, FaFileAlt, FaChartBar, FaCog, FaPlus, FaBell, FaMap } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";

interface NavItem {
  label: string;
  href: string;
  Icon: IconType;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/", Icon: FaHome },
  { label: "Buat Tugas", href: "/buat-tugas", Icon: FaPlus },
  { label: "Tugas", href: "/tugas", Icon: FaTasks },
  { label: "Laporan", href: "/laporan", Icon: FaFileAlt },
  { label: "Notifikasi", href: "/notifikasi", Icon: FaBell },
  { label: "Score", href: "/score", Icon: FaChartBar },
  { label: "Settings", href: "/settings", Icon: FaCog },
  { label: "Map Mapping", href: "/mapping", Icon: FaMap },
];

function SidebarItem({ href, label, Icon, highlight, highlightDanger }: NavItem & { highlight?: boolean; highlightDanger?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={
        "group relative flex h-12 w-12 items-center justify-center rounded-lg text-xl transition-colors " +
        (isActive
          ? "bg-purple-800 text-white"
          : highlightDanger
          ? "animate-pulse bg-red-600 text-black"
          : highlight
          ? "animate-pulse bg-yellow-600 text-black"
          : "text-gray-400 hover:bg-purple-900 hover:text-white")
      }
    >
      <Icon className="pointer-events-none" />
      <span className="pointer-events-none absolute hidden md:block left-full ml-2 whitespace-nowrap rounded bg-gray-700 px-2 py-1 text-sm opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}

export default function PageSwitcher() {
  const [hasStatusNew, setHasStatusNew] = useState(false);
  const [hasPentingNew, setHasPentingNew] = useState(false);
  const [hasLaporanNew, setHasLaporanNew] = useState(false);
  const pathname = usePathname();

  // init lastSeen
  const lastSeenRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifStatusLastSeen') || 0);
      // ensure lastSeen laporan key exists
      if(!localStorage.getItem('laporanLastSeen')){
        localStorage.setItem('laporanLastSeen','0');
      }
    }
  }, []);

  // Poll server
  useEffect(() => {
    const poll = async () => {
      try {
        const res1 = await fetch('\/api/status-notifs');
        if (res1.ok) {
          const data = await res1.json();
          if (data.length) {
            const latestTs = Date.parse(data[0].timestamp);
            const lastSeenStatus = Number(localStorage.getItem('notifStatusLastSeen') || 0);
            setHasStatusNew(latestTs > lastSeenStatus);
          } else {
            setHasStatusNew(false);
          }
        } else {
          setHasStatusNew(false);
        }

        const res2 = await fetch('\/api/penting-notifs');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.length) {
            const latest2 = Date.parse(data2[0].timestamp);
            const lastSeenP = Number(localStorage.getItem('notifPentingLastSeen') || 0);
            setHasPentingNew(latest2 > lastSeenP);
          } else {
            setHasPentingNew(false);
          }
        } else {
          setHasPentingNew(false);
        }

        // Laporan check
        const res3 = await fetch('\/api/laporan');
        if(res3.ok){
          const data3 = await res3.json();
          if(data3 && data3.length){
            data3.sort((a:any,b:any)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const latestLap = new Date(data3[0].createdAt).getTime();
            const lastSeenLap = Number(localStorage.getItem('laporanLastSeen')||0);
            setHasLaporanNew(latestLap > lastSeenLap);
          }else{ setHasLaporanNew(false); }
        }else{ setHasLaporanNew(false);}
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  // Clear new flag when visiting /notifikasi
  useEffect(() => {
    if (pathname === '/notifikasi') {
      setHasStatusNew(false);
      setHasPentingNew(false);
      // record that notifications have been seen so subsequent polls don't mark them as new again
      if (typeof window !== 'undefined') {
        localStorage.setItem('notifStatusLastSeen', String(Date.now()));
        localStorage.setItem('notifPentingLastSeen', String(Date.now()));
      }
    }

    if(pathname === '/laporan'){
      setHasLaporanNew(false);
      if(typeof window !== 'undefined'){
        localStorage.setItem('laporanLastSeen', String(Date.now()));
      }
    }
  }, [pathname]);

  return (
    <nav
      className="fixed top-0 left-0 z-50 flex w-full h-14 flex-row items-center justify-center gap-4 border-b border-purple-900 bg-[#0d0014] md:h-screen md:w-20 md:flex-col md:border-b-0 md:border-r md:rounded-tr-lg md:rounded-br-lg py-2 md:py-4"
    >
      {navItems.map((item) => (
        <SidebarItem
          key={item.href}
          {...item}
          highlight={item.href === '/notifikasi' && !hasPentingNew && hasStatusNew || (item.href === '/laporan' && hasLaporanNew)}
          highlightDanger={item.href === '/notifikasi' && hasPentingNew}
        />
      ))}
    </nav>
  );
} 