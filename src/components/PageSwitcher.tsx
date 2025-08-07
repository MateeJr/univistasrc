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
        "group relative flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full text-base md:text-xl transition-all duration-300 flex-shrink-0 " +
        (isActive
          ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-700/50 md:scale-110"
          : highlightDanger
          ? "animate-pulse bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-600/50"
          : highlight
          ? "animate-pulse bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-600/50"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white hover:scale-105")
      }
    >
      <Icon className="pointer-events-none" />
      
      {/* Enhanced tooltip with better positioning and styling */}
      <span className="
        pointer-events-none absolute 
        hidden md:block 
        left-full ml-4 
        whitespace-nowrap 
        rounded-lg 
        bg-zinc-900/95 backdrop-blur-sm
        border border-zinc-800/50
        px-3 py-1.5 
        text-sm font-medium
        opacity-0 scale-95
        transition-all duration-200
        group-hover:opacity-100 group-hover:scale-100
        shadow-xl
      ">
        {label}
      </span>
      
      {/* Active indicator dot */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
      )}
      
      {/* Notification badge */}
      {(highlight || highlightDanger) && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
      )}
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
    <>
      {/* Mobile wrapper for proper centering */}
      <div className="md:hidden w-full flex justify-center pt-4 pb-2">
        <nav
          className="
            z-50
            flex flex-row
            h-12 w-fit
            items-center justify-center
            gap-1.5
            px-2 py-1.5
            /* Floating appearance */
            bg-zinc-950/80 backdrop-blur-xl
            border border-zinc-800
            rounded-full
            shadow-2xl shadow-black/40
            /* Animation */
            transition-all duration-300
          "
      >
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 rounded-full md:rounded-2xl bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
        
          {/* Navigation items */}
          {navItems.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              highlight={item.href === '/notifikasi' && !hasPentingNew && hasStatusNew || (item.href === '/laporan' && hasLaporanNew)}
              highlightDanger={item.href === '/notifikasi' && hasPentingNew}
            />
          ))}
        </nav>
      </div>
      
      {/* Desktop navigation panel */}
      <nav
        className="
          hidden md:flex
          fixed z-50
          top-1/2 left-4 -translate-y-1/2
          flex-col
          h-auto max-h-[calc(100vh-2rem)]
          items-center justify-center
          gap-2
          px-3 py-4
          /* Floating appearance */
          bg-zinc-950/80 backdrop-blur-xl
          border border-zinc-800
          rounded-2xl
          shadow-2xl shadow-black/40
          /* Animation */
          transition-all duration-300
        "
      >
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
        
        {/* Navigation items */}
        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            {...item}
            highlight={item.href === '/notifikasi' && !hasPentingNew && hasStatusNew || (item.href === '/laporan' && hasLaporanNew)}
            highlightDanger={item.href === '/notifikasi' && hasPentingNew}
          />
        ))}
      </nav>
      
      {/* Optional: Add a subtle glow effect behind the panel - only on desktop */}
      <div className="hidden md:block fixed md:top-1/2 md:left-4 md:-translate-y-1/2 w-20 h-96 bg-purple-600/20 blur-3xl pointer-events-none -z-10" />
    </>
  );
} 