"use client";
import React, { useEffect, useRef, useState } from "react";
import RiwayatTambahan from "./RiwayatTambahan";

interface TambahanNotif {
  taskId?: string;
  description?: string;
  drivers?: string[];
  kind?: string;
  deviceId?: string;
  nama?: string;
  title?: string;
  type?: string;
  timestamp: string;
}

const API_BASE = "";

// format dd/mm/yyyy hh:mm
const formatTs = (ts: string) => {
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return ts;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const NotifTambahan: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [list, setList] = useState<TambahanNotif[]>([]);
  const [accounts, setAccounts] = useState<Record<string, { deviceId: string; nama: string; bk: string }>>({});
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [showKonfirmasi, setShowKonfirmasi] = useState(true);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [serverToday, setServerToday] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataReady, setDataReady] = useState<boolean>(false);
  const lastSeenRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  // Helper function to check if a notification is from today
  const isToday = (timestamp: string, todayStr: string): boolean => {
    if (!todayStr || !dataReady) return false; // Don't show anything until server time is ready

    let notifDate: Date;
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(timestamp)) {
      const [dPart] = timestamp.split(' ');
      const [d, m, y] = dPart.split('/').map(Number);
      notifDate = new Date(y, m - 1, d);
    } else {
      notifDate = new Date(timestamp);
    }

    const [todayY, todayM, todayD] = todayStr.split('-').map(Number);
    const today = new Date(todayY, todayM - 1, todayD);

    return notifDate.getFullYear() === today.getFullYear() &&
           notifDate.getMonth() === today.getMonth() &&
           notifDate.getDate() === today.getDate();
  };

  // Fetch server time to get today's date
  const fetchServerTime = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/server-time`);
      if (res.ok) {
        const data = await res.json();
        // Server returns { ts: timestamp } not { timestamp: ... }
        const serverDate = new Date(data.ts);
        const todayStr = `${serverDate.getFullYear()}-${String(serverDate.getMonth() + 1).padStart(2, '0')}-${String(serverDate.getDate()).padStart(2, '0')}`;
        setServerToday(todayStr);
        setDataReady(true);
      }
    } catch {
      // Fallback to local time if server time fails
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setServerToday(todayStr);
      setDataReady(true);
    }
  };

  const fetchData = async () => {
    if (!dataReady) return; // Don't load until server time is ready

    if (isInitialLoadRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE}/api/tambahan-notifs`);
      if (res.ok) {
        const data: TambahanNotif[] = await res.json();
        console.log('[NotifTambahan] Raw data count:', data.length, 'Server today:', serverToday);
        // Filter to show only today's notifications
        const todayData = data.filter(n => isToday(n.timestamp, serverToday));
        console.log('[NotifTambahan] Today data count:', todayData.length);

        // --- client-side dedup just in case ---
        const seen = new Set<string>();
        const uniqueToday: TambahanNotif[] = [];
        for (const n of todayData) {
          const key = n.taskId ? `task-${n.taskId}` : n.deviceId ? `lap-${n.deviceId}-${n.title}` : `${n.timestamp}-${n.description}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueToday.push(n);
          }
        }
        setList(uniqueToday);

        // also fetch notif config to respect konfirmasiSelesai toggle
        try {
          const cfgRes = await fetch(`${API_BASE}/api/notif-config`);
          if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            setShowKonfirmasi(!!cfg.konfirmasiSelesai);
          }
        } catch {}

        // determine unread
        const newSet = new Set<string>();
        for (const n of todayData) {
          const ts = Date.parse(n.timestamp);
          if (ts > lastSeenRef.current) newSet.add(n.timestamp + (n.taskId || n.deviceId || ''));
          else break;
        }
        if (newSet.size) {
          setUnreadIds(prev => new Set([...prev, ...newSet]));
          setTimeout(() => {
            lastSeenRef.current = Date.now();
            if (typeof window !== 'undefined')
              localStorage.setItem('notifTambahanLastSeen', String(lastSeenRef.current));
            setUnreadIds(prev => {
              const next = new Set(prev);
              newSet.forEach(id => next.delete(id));
              return next;
            });
          }, 3000);
        }
      }
    } catch {}
    setIsLoading(false);
    isInitialLoadRef.current = false;
  };

  // fetch & poll
  useEffect(() => {
    // fetch accounts once
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/accounts`);
        if (res.ok) {
          const list: { deviceId: string; nama: string; bk: string }[] = await res.json();
          const map: Record<string, { deviceId: string; nama: string; bk: string }> = {};
          list.forEach(a => (map[a.deviceId] = a));
          setAccounts(map);
        }
      } catch {}
    };

    fetchAccounts();

    // init last seen
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifTambahanLastSeen') || 0);
    }

    // Fetch server time first
    fetchServerTime();
  }, []);

  // Start loading data when server time is ready
  useEffect(() => {
    if (dataReady && serverToday) {
      fetchData();
      const id = setInterval(fetchData, 10000);
      return () => clearInterval(id);
    }
  }, [dataReady, serverToday]);

  // delete all notifs
  const deleteAll = async () => {
    if (!confirm('Hapus semua notifikasi?')) return;
    try { await fetch(`${API_BASE}/api/tambahan-notifs`, { method: 'DELETE' }); } catch {}
    setList([]);
    setUnreadIds(new Set());
  };

  const driverNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return '';
    const names = ids.map(id => accounts[id]?.nama || id);
    return names.join(', ');
  };

  const namaDriver = (deviceId?: string, nama?: string) => {
    if (nama) return nama;
    if (!deviceId) return '';
    return accounts[deviceId]?.nama || deviceId;
  };

  // filter list
  const filtered = list.filter(n => {
    if(!showKonfirmasi && !n.deviceId){ // hide task completion if disabled
      return false;
    }
    const msgParts = [n.description, n.taskId, ...(n.drivers || [])].join(' ').toLowerCase();
    const driverStr = driverNames(n.drivers).toLowerCase();
    if (search.trim() && ![msgParts, driverStr].some(s => s.includes(search.toLowerCase()))) return false;

    if (filterDate) {
      const [yy, mm, dd] = filterDate.split('-').map(Number);
      const target = new Date(yy, mm - 1, dd);
      const tsDate = new Date(n.timestamp);
      if (!(tsDate.getFullYear() === target.getFullYear() && tsDate.getMonth() === target.getMonth() && tsDate.getDate() === target.getDate()))
        return false;
    }
    return true;
  });

  const clearFilters = () => { setSearch(''); setFilterDate(''); };

  if (showRiwayat) {
    return <RiwayatTambahan onClose={() => {
      setShowRiwayat(false);
      // Ensure we reload today's data when returning from Riwayat
      if (dataReady && serverToday) {
        fetchData();
      }
    }} />;
  }

  return (
    <div className="h-full rounded-xl bg-zinc-950/80 p-4 text-white border border-zinc-800 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-3 text-center text-zinc-200">TAMBAHAN</h3>

      {/* filters */}
      <div className="mb-3">
        {/* Input fields */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm placeholder:text-zinc-500" />
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm" />
        </div>

        {/* Buttons - 3 columns on mobile, inline on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
          <button onClick={clearFilters} className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-white transition-colors backdrop-blur-sm text-sm">Clear</button>
          <button onClick={deleteAll} className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors backdrop-blur-sm text-sm">Hapus Semua</button>
          <button onClick={() => setShowRiwayat(true)} className="px-3 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/40 text-white transition-colors backdrop-blur-sm text-sm">Semua Riwayat</button>
        </div>
      </div>

      {!dataReady || (isLoading && list.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-500 mb-2"></div>
          <p className="text-zinc-400 text-sm">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center">
          {search || filterDate ? 'Tidak ada notifikasi yang sesuai filter' : 'Belum ada notifikasi tambahan hari ini'}
        </p>
      ) : (
        <div className="flex flex-col gap-1 overflow-auto">
          {filtered.map((n, idx) => {
            const keyId = n.taskId || n.deviceId || idx;
            const isUnread = unreadIds.has(n.timestamp + keyId);
            const rowBase = idx % 2 === 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/50';
            const rowCls = isUnread ? 'animate-pulse bg-amber-700/70 text-black' : rowBase;
            let content: React.ReactNode;
            if(n.deviceId){ // laporan
              const nama = namaDriver(n.deviceId, n.nama);
              content = (
                <span className="flex-1">
                  <span className={`font-semibold mr-1 ${isUnread ? 'text-black' : 'text-purple-400'}`}>{nama}</span>
                  mengirim laporan <span className="font-semibold">{n.title || n.type || '-'}</span>
                </span>
              );
            } else {
              content = (
                <span className="flex-1">
                  <span className={`font-semibold mr-1 ${isUnread ? 'text-black' : 'text-purple-400'}`}>{driverNames(n.drivers)}</span>
                  telah menyelesaikan tugas <span className="font-semibold">{n.description || '-'}</span>
                </span>
              );
            }

            return (
              <div key={idx} className={`${rowCls} border border-zinc-800 hover:bg-zinc-900 px-2 py-1 text-sm flex items-center gap-2 rounded-lg`}>
                <span className="text-zinc-400 text-xs shrink-0 w-40 inline-block">{formatTs(n.timestamp)}</span>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotifTambahan;
