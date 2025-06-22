"use client";
import React, { useEffect, useRef, useState } from "react";

interface Notif { deviceId:string; nama:string; timestamp:string; lat?:number; lng?:number; type:string }

const API_BASE = "http://193.70.34.25:20096";

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

  // Load and poll
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/penting-notifs`);
        if (res.ok) {
          const data: Notif[] = await res.json();
          setList(data);

          // determine new/unread
          const newSet = new Set<string>();
          for (const n of data) {
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
    };
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">PENTING</h3>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-3 items-stretch">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto" />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-grow sm:flex-none px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm w-full sm:w-auto" />
        <button onClick={clearInputs} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm w-full sm:w-auto">Clear</button>
        <button onClick={deleteAll} className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-sm w-full sm:w-auto">Hapus Semua</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">Belum ada notifikasi penting</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-auto">
          {filtered.map((n, idx) => {
            const msg = n.type === 'route'
              ? 'keluar dari jalur yang ditentukan'
              : 'memasuki area larangan';
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
