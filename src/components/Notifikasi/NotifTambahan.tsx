"use client";
import React, { useEffect, useRef, useState } from "react";

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

const API_BASE = "http://66.96.230.177:3000";

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
  const lastSeenRef = useRef<number>(0);

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

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tambahan-notifs`);
        if (res.ok) {
          const data: TambahanNotif[] = await res.json();
          setList(data);

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
          for (const n of data) {
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
    };

    // init last seen
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifTambahanLastSeen') || 0);
    }

    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">TAMBAHAN</h3>

      {/* filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-3 items-stretch">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto" />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto" />
        <button onClick={clearFilters} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm w-full sm:w-auto">Clear</button>
        <button onClick={deleteAll} className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-sm w-full sm:w-auto">Hapus Semua</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">Belum ada notifikasi tambahan</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-auto">
          {filtered.map((n, idx) => {
            const keyId = n.taskId || n.deviceId || idx;
            const isUnread = unreadIds.has(n.timestamp + keyId);
            const rowBase = idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900';
            const rowCls = isUnread ? 'animate-pulse bg-yellow-600 text-black' : rowBase;
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
              <div key={idx} className={`${rowCls} border-t border-gray-700 hover:bg-gray-700 px-2 py-1 text-sm flex items-center gap-2`}>
                <span className="text-gray-400 text-xs shrink-0 w-40 inline-block">{formatTs(n.timestamp)}</span>
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
