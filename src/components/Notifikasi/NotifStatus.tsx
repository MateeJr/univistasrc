"use client";
import React, { useEffect, useState, useRef } from "react";
import { FiInfo } from 'react-icons/fi';
import RiwayatStatus from "./RiwayatStatus";

interface StatusNotif {
  type: 'status' | 'gps' | 'battery';
  deviceId: string;
  nama: string;
  from?: string;
  to?: string;
  level?: number;
  timestamp: string;
}

const API_BASE = "";

const NotifStatus: React.FC = () => {
  const [list, setList] = useState<StatusNotif[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const lastSeenRef = useRef<number>(0);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [serverToday, setServerToday] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with true for initial load
  const [dataReady, setDataReady] = useState<boolean>(false);
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

  const load = async () => {
    if (!dataReady) return; // Don't load until server time is ready

    if (isInitialLoadRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE}/api/status-notifs`);
      if (res.ok) {
        const data: StatusNotif[] = await res.json();
        console.log('[NotifStatus] Raw data count:', data.length, 'Server today:', serverToday);
        // Filter to show only today's notifications
        const todayData = data.filter(n => isToday(n.timestamp, serverToday));
        console.log('[NotifStatus] Today data count:', todayData.length);
        setList(todayData);

        const newSet = new Set<string>();
        for(const n of todayData){
          const ts = Date.parse(n.timestamp);
          if(ts>lastSeenRef.current){
            newSet.add(n.timestamp + n.deviceId);
          } else break;
        }
        if(newSet.size){
          setUnreadIds(prev=> new Set([...prev, ...newSet]));
          setTimeout(()=>{
            lastSeenRef.current = Date.now();
            if(typeof window!=='undefined')
              localStorage.setItem('notifStatusLastSeen', String(lastSeenRef.current));
            setUnreadIds(prev=>{
              const newPrev = new Set(prev);
              newSet.forEach(id=>newPrev.delete(id));
              return newPrev;
            });
          },3000);
        }
      }
    } catch {}
    setIsLoading(false);
    isInitialLoadRef.current = false;
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
        console.log('[NotifStatus] Server today:', todayStr, 'from timestamp:', data.ts);
        setServerToday(todayStr);
        setDataReady(true);
      }
    } catch {
      // Fallback to local time if server time fails
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      console.log('[NotifStatus] Fallback today:', todayStr);
      setServerToday(todayStr);
      setDataReady(true);
    }
  };

  useEffect(() => {
    // init lastSeen from localStorage on client
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifStatusLastSeen') || 0);
    }

    // Fetch server time first
    fetchServerTime();
  }, []);

  // Start loading data when server time is ready
  useEffect(() => {
    if (dataReady && serverToday) {
      load();
      const id = setInterval(load, 10000);
      return () => clearInterval(id);
    }
  }, [dataReady, serverToday]);

  const filtered = list.filter(n => {
    // search
    const msgParts = [n.nama, n.deviceId, n.from, n.to, n.type].join(' ').toLowerCase();
    if (search.trim() && !msgParts.includes(search.toLowerCase())) return false;

    // date range
    if (filterDate) {
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
      if (!(tsDate.getFullYear() === target.getFullYear() && tsDate.getMonth() === target.getMonth() && tsDate.getDate() === target.getDate())) {
        return false;
      }
    }
    return true;
  });

  const clearFilters = () => {
    setSearch('');
    setFilterDate('');
  };

  const deleteAll = async () => {
    if(!confirm('Hapus semua notifikasi?')) return;
    try{
      await fetch(`${API_BASE}/api/status-notifs`, {method:'DELETE'});
      setList([]);
      setUnreadIds(new Set());
    }catch{}
  };

  if (showRiwayat) {
    return <RiwayatStatus onClose={() => {
      setShowRiwayat(false);
      // Ensure we reload today's data when returning from Riwayat
      if (dataReady && serverToday) {
        load();
      }
    }} />;
  }

  return (
    <div className="h-full rounded-xl bg-zinc-950/80 p-4 text-white border border-zinc-800 flex flex-col overflow-hidden">
      <h3 className="text-lg font-semibold mb-3 text-center text-zinc-200">STATUS</h3>

      {/* Filters */}
      <div className="mb-3">
        {/* Input fields */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2 min-w-0">
          <input
            type="text"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Cari..."
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm min-w-0 placeholder:text-zinc-500"
          />
          <input
            type="date"
            value={filterDate}
            onChange={e=>setFilterDate(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm min-w-0"
          />
        </div>

        {/* Buttons - 3 columns on mobile, inline on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2">
          <button
            onClick={clearFilters}
            className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-white transition-colors backdrop-blur-sm text-sm"
          >
            Clear
          </button>
          <button
            onClick={deleteAll}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors backdrop-blur-sm text-sm"
          >
            Hapus Semua
          </button>
          <button
            onClick={() => setShowRiwayat(true)}
            className="px-3 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/40 text-white transition-colors backdrop-blur-sm text-sm"
          >
            Semua Riwayat
          </button>
        </div>
      </div>

      {!dataReady || (isLoading && list.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-500 mb-2"></div>
          <p className="text-zinc-400 text-sm">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center">
          {search || filterDate ? 'Tidak ada notifikasi yang sesuai filter' : 'Belum ada notifikasi status hari ini'}
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-w-0">
          {filtered.map((n, idx) => {
            const rowBase = idx % 2 === 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/50';
            const isUnread = unreadIds.has(n.timestamp + n.deviceId);
            const rowCls = isUnread ? 'animate-pulse bg-amber-900/40' : rowBase;

            const badge = (text: string, state: 'on' | 'off' | 'online' | 'offline' | 'disconnected') => {
              const clr = state === 'on' || state === 'online' ? 'green' : state==='disconnected'? 'yellow' : 'red';
              return (
                <span className={`px-2 py-1 rounded-md text-sm font-medium bg-${clr}-600 text-black min-w-[80px] text-center shrink-0`}>{text}</span>
              );
            };

            let messageElem: React.ReactNode = null;
            if (n.type === 'status') {
              messageElem = (
                <div className="flex flex-col gap-1 max-w-full">
                  <span className="font-medium">Status Perubahan</span>
                  <div className="flex flex-wrap items-center gap-2 max-w-full">
                    {badge(n.from ?? '', n.from as any)}
                    <span className="text-lg shrink-0">➔</span>
                    {badge(n.to ?? '', n.to as any)}
                    <button
                      onClick={() => alert('Kemungkinan Jaringan terputus atau HP Dimatikan')}
                      className="text-zinc-300 hover:text-white"
                      title="Info"
                    >
                      <FiInfo size={16} />
                    </button>
                  </div>
                </div>
              );
            } else if (n.type === 'gps') {
              const fromLabel = n.from === 'on' ? 'Aktif' : 'Mati';
              const toLabel = n.to === 'on' ? 'Aktif' : 'Mati';
              messageElem = (
                <div className="flex flex-col gap-1 max-w-full">
                  <span className="font-medium">GPS Perubahan</span>
                  <div className="flex flex-wrap items-center gap-2 max-w-full">
                    {badge(fromLabel, n.from as any)}
                    <span className="text-lg shrink-0">➔</span>
                    {badge(toLabel, n.to as any)}
                    <button
                      onClick={() => alert('Kemungkinan besar settingan GPS Diubah Driver')}
                      className="text-yellow-300 hover:text-yellow-200"
                      title="Info"
                    >
                      <FiInfo size={16} />
                    </button>
                  </div>
                </div>
              );
            } else if (n.type === 'battery') {
              messageElem = (
                <div className="flex flex-col gap-1 max-w-full">
                  <span className="font-medium">Status Baterai</span>
                  <div className="flex flex-wrap items-center gap-2 max-w-full">
                    <span className="px-2 py-1 rounded-md text-sm font-medium bg-red-600 text-black min-w-[120px] text-center shrink-0">Baterai Rendah</span>
                    <span className="text-sm">({n.level}%)</span>
                    <button
                      onClick={() => alert('Kondisi Battery HP Driver dibawah 25%')}
                      className="text-red-300 hover:text-red-200"
                      title="Info"
                    >
                      <FiInfo size={16} />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className={`p-4 rounded-xl ${rowCls} shadow-md hover:shadow-lg transition-shadow overflow-hidden`}>
                <div className="flex flex-col sm:flex-row sm:flex-nowrap flex-wrap items-start sm:items-center justify-between gap-4 min-w-0">
                  <div className="w-full sm:w-1/4 min-w-0">
                    <span className="font-medium text-zinc-400">Waktu:</span>
                    <p className="text-base break-words whitespace-normal">{new Date(n.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="w-full sm:w-1/4 min-w-0">
                    <span className="font-medium text-zinc-400">Driver:</span>
                    <p className="text-base break-words whitespace-normal">{n.nama}</p>
                  </div>
                  <div className="w-full sm:w-1/2 min-w-0">
                    {messageElem}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotifStatus;
