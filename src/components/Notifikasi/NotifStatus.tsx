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

  const load = async () => {
    if (!dataReady) return; // Don't load until server time is ready

    setIsLoading(true);
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
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">STATUS</h3>

      {/* Filters */}
      <div className="mb-3">
        {/* Input fields */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Cari..."
            className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm"
          />
          <input
            type="date"
            value={filterDate}
            onChange={e=>setFilterDate(e.target.value)}
            className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm"
          />
        </div>

        {/* Buttons - 3 columns on mobile, inline on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
          <button
            onClick={clearFilters}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm"
          >
            Clear
          </button>
          <button
            onClick={deleteAll}
            className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-sm"
          >
            Hapus Semua
          </button>
          <button
            onClick={() => setShowRiwayat(true)}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
          >
            Semua Riwayat
          </button>
        </div>
      </div>

      {!dataReady || isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-2"></div>
          <p className="text-gray-400 text-sm">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">
          {search || filterDate ? 'Tidak ada notifikasi yang sesuai filter' : 'Belum ada notifikasi status hari ini'}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-purple-400 sticky top-0 bg-black">
              <th className="text-left px-2">Waktu</th>
              <th className="text-left px-2">Driver</th>
              <th className="text-left px-2">Pesan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n, idx) => {
              const rowBase = idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900';
              const isUnread = unreadIds.has(n.timestamp + n.deviceId);
              const rowCls = isUnread ? 'animate-pulse bg-yellow-600 text-black' : rowBase;

              const badge = (text: string, state: 'on' | 'off' | 'online' | 'offline' | 'disconnected') => {
                const clr = state === 'on' || state === 'online' ? 'green' : state==='disconnected'? 'yellow' : 'red';
                return (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold bg-${clr}-600 text-black`}>{text}</span>
                );
              };

              let messageElem: React.ReactNode = null;
              if (n.type === 'status') {
                messageElem = (
                  <span className="flex items-center gap-1">
                    Status {badge(n.from ?? '', n.from as any)} ➔ {badge(n.to ?? '', n.to as any)}
                    <button
                      onClick={() => alert('Kemungkinan Jaringan terputus atau HP Dimatikan')}
                      className="text-purple-300 hover:text-purple-200"
                      title="Info"
                    >
                      <FiInfo size={14} />
                    </button>
                  </span>
                );
              } else if (n.type === 'gps') {
                const fromLabel = n.from === 'on' ? 'Aktif' : 'Mati';
                const toLabel = n.to === 'on' ? 'Aktif' : 'Mati';
                messageElem = (
                  <span className="flex items-center gap-1">
                    GPS {badge(fromLabel, n.from as any)} ➔ {badge(toLabel, n.to as any)}
                    <button
                      onClick={() => alert('Kemungkinan besar settingan GPS Diubah Driver')}
                      className="text-yellow-300 hover:text-yellow-200"
                      title="Info"
                    >
                      <FiInfo size={14} />
                    </button>
                  </span>
                );
              } else if (n.type === 'battery') {
                messageElem = (
                  <span className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-600 text-black">Baterai Low</span>
                    ({n.level}%)
                    <button
                      onClick={() => alert('Kondisi Battery HP Driver dibawah 25%')}
                      className="text-red-300 hover:text-red-200"
                      title="Info"
                    >
                      <FiInfo size={14} />
                    </button>
                  </span>
                );
              }

              return (
                <tr key={idx} className={`border-t border-gray-700 hover:bg-gray-700 ${rowCls}`}>
                  <td className="px-2 py-1 whitespace-nowrap">{new Date(n.timestamp).toLocaleString('id-ID')}</td>
                  <td className="px-2 py-1">{n.nama}</td>
                  <td className="px-2 py-1">{messageElem}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default NotifStatus;
