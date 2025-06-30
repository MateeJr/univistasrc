"use client";
import React, { useEffect, useRef, useState } from "react";
import RiwayatPenting from "./RiwayatPenting";

interface Notif { deviceId:string; nama:string; timestamp:string; lat?:number; lng?:number; type:string }

const API_BASE = "";

const formatTs=(ts:string)=>{
  const parse=(str:string):Date|null=>{
    if(/\d{2}\/\d{2}\/\d{4}/.test(str)){
      const [datePart,timePart] = str.split(' ');
      const [d,m,y]=datePart.split('/').map(Number);
      const [h,mi]= (timePart||'00:00').split(':').map(Number);
      const dt=new Date(y,m-1,d,h||0,mi||0); return isNaN(dt.getTime())?null:dt;
    }
    const dt=new Date(str); return isNaN(dt.getTime())?null:dt;
  };
  const d=parse(ts);
  if(!d) return ts;
  const pad=(n:number)=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const NotifPenting: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [list, setList] = useState<Notif[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [serverToday, setServerToday] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataReady, setDataReady] = useState<boolean>(false);

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

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/penting-notifs`);
      if (res.ok) {
        const data: Notif[] = await res.json();
        console.log('[NotifPenting] Raw data count:', data.length, 'Server today:', serverToday);
        // Filter to show only today's notifications
        const todayData = data.filter(n => isToday(n.timestamp, serverToday));
        console.log('[NotifPenting] Today data count:', todayData.length);
        setList(todayData);

        // determine new/unread
        const newSet = new Set<string>();
        for (const n of todayData) {
          const ts = Date.parse(n.timestamp);
          if (ts > lastSeenRef.current) {
            newSet.add(n.timestamp + n.deviceId);
          } else {
            break; // list is sorted newest first
          }
        }
        if (newSet.size) {
          setUnreadIds(prev => new Set([...prev, ...newSet]));

          // mark as read after pulse period (3s)
          setTimeout(() => {
            lastSeenRef.current = Date.now();
            if (typeof window !== 'undefined')
              localStorage.setItem('notifPentingLastSeen', String(lastSeenRef.current));
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
  };

  // Initial setup
  useEffect(() => {
    // init lastSeen from localStorage on client
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifPentingLastSeen') || 0);
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

  // Store last seen on unmount
  const lastSeenRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = Number(localStorage.getItem('notifPentingLastSeen') || 0);
      lastSeenRef.current = stored;
    }
  }, []);

  // Filtering
  const filtered = list.filter(n => {
    const matchesSearch = search ? (n.nama?.toLowerCase().includes(search.toLowerCase()) || n.deviceId.toLowerCase().includes(search.toLowerCase())) : true;
    const matchesDate = filterDate ? (() => {
      const [yy, mm, dd] = filterDate.split('-').map(Number);
      const target = new Date(yy, mm - 1, dd);
      let tsDate: Date;
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(n.timestamp)) {
        const [dPart] = n.timestamp.split(' ');
        const [d, m, y] = dPart.split('/').map(Number);
        tsDate = new Date(y, m - 1, d);
      } else {
        tsDate = new Date(n.timestamp);
      }
      return tsDate.getFullYear() === target.getFullYear() &&
             tsDate.getMonth() === target.getMonth() &&
             tsDate.getDate() === target.getDate();
    })() : true;
    return matchesSearch && matchesDate;
  });

  // Clear & delete
  const clearInputs = () => { setSearch(""); setFilterDate(""); };
  const deleteAll = async () => {
    if (!confirm("Hapus semua notifikasi?")) return;
    try { await fetch(`${API_BASE}/api/penting-notifs`, { method: "DELETE" }); } catch {}
    setList([]);
  };

  if (showRiwayat) {
    return <RiwayatPenting onClose={() => {
      setShowRiwayat(false);
      // Ensure we reload today's data when returning from Riwayat
      if (dataReady && serverToday) {
        fetchData();
      }
    }} />;
  }

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">PENTING</h3>

      <div className="mb-3">
        {/* Input fields */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm" />
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm" />
        </div>

        {/* Buttons - 3 columns on mobile, inline on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
          <button onClick={clearInputs} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">Clear</button>
          <button onClick={deleteAll} className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-sm">Hapus Semua</button>
          <button onClick={() => setShowRiwayat(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm">Semua Riwayat</button>
        </div>
      </div>

      {!dataReady || isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-2"></div>
          <p className="text-gray-400 text-sm">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">
          {search || filterDate ? 'Tidak ada notifikasi yang sesuai filter' : 'Belum ada notifikasi penting hari ini'}
        </p>
      ) : (
        <div className="flex flex-col gap-1 overflow-auto">
          {filtered.map((n, idx) => {
            const getMsg = (type: string) => {
              switch(type) {
                case 'route': return 'keluar dari jalur yang ditentukan';
                case 'restricted': return 'memasuki area larangan';
                case 'speed': return `melebihi kecepatan (${(n as any).speed || 'N/A'} km/jam)`;
                case 'stop': return `berhenti terlalu lama (${(n as any).durationMin || 'N/A'} menit)`;
                case 'oli': return 'perlu mengganti oli';
                default: return `notifikasi penting (${type})`;
              }
            };
            const msg = getMsg(n.type);
            const isUnread = unreadIds.has(n.timestamp + n.deviceId);
            const rowCls = isUnread ? 'animate-pulse bg-yellow-600 text-black' : 'bg-gray-800/70';
            return (
              <div key={idx} className={`${rowCls} border border-red-600 rounded px-2 py-1 text-sm flex items-center gap-2`}>
                <span className="text-gray-400 text-xs shrink-0 w-40 inline-block">{formatTs(n.timestamp)}</span>
                <span className="flex-1"><span className={`font-semibold mr-1 ${isUnread ? 'text-black' : 'text-red-400'}`}>{n.nama}</span>{msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotifPenting;
