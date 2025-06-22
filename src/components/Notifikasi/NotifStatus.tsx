"use client";
import React, { useEffect, useState, useRef } from "react";
import { FiInfo } from 'react-icons/fi';

interface StatusNotif {
  type: 'status' | 'gps' | 'battery';
  deviceId: string;
  nama: string;
  from?: string;
  to?: string;
  level?: number;
  timestamp: string;
}

const API_BASE = "http://193.70.34.25:20096";

const NotifStatus: React.FC = () => {
  const [list, setList] = useState<StatusNotif[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const lastSeenRef = useRef<number>(0);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status-notifs`);
      if (res.ok) {
        const data: StatusNotif[] = await res.json();
        setList(data);
        const newSet = new Set<string>();
        for(const n of data){
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
  };

  useEffect(() => {
    // init lastSeen from localStorage on client
    if (typeof window !== 'undefined') {
      lastSeenRef.current = Number(localStorage.getItem('notifStatusLastSeen') || 0);
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">STATUS</h3>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-3 items-stretch">
        <input
          type="text"
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Cari..."
          className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto"
        />
        <input
          type="date"
          value={filterDate}
          onChange={e=>setFilterDate(e.target.value)}
          className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto"
        />
        <button
          onClick={clearFilters}
          className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm w-full sm:w-auto"
        >
          Clear
        </button>
        <button
          onClick={deleteAll}
          className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-sm w-full sm:w-auto"
        >
          Hapus Semua
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">Belum ada notifikasi status</p>
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
