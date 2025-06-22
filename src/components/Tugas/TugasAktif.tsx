"use client";

import React, { useEffect, useState } from "react";
import TaskDetailModal from "./TaskDetailModal";
import TaskImagesModal from "./TaskImagesModal";

interface Task { id:string; description:string; from:string; to:string; deadline:string; drivers?:string[]; createdAt?:string; status?:string; waypoints?:{lng:number; lat:number}[] }

interface Account { deviceId:string; nama:string; bk:string }

// helper to parse deadline string that may be in 'DD/MM/YYYY HH:MM' or ISO format
const parseDeadline = (str:string): Date | null => {
  if(!str) return null;
  // detect dd/mm/yyyy
  if(/\d{2}\/\d{2}\/\d{4}/.test(str)){
    const [datePart,timePart] = str.split(' ');
    const [day,month,year] = datePart.split('/').map(Number);
    const [hour,min] = (timePart||'00:00').split(':').map(Number);
    const d = new Date(year, month-1, day, hour||0, min||0);
    return isNaN(d.getTime())?null:d;
  }
  const d = new Date(str);
  return isNaN(d.getTime())?null:d;
};

const statusColor = (s?:string)=>{
  if(s==='DIBATALKAN') return {text:'text-gray-400',border:'border-gray-600'};
  if(s==='SELESAI') return {text:'text-green-400',border:'border-green-500'};
  if(s==='TELAH DIKONIFIRMASI') return {text:'text-blue-400',border:'border-blue-500'};
  if(s?.startsWith('DIPROSES')) return {text:'text-red-400',border:'border-red-500'};
  return {text:'text-yellow-300',border:'border-yellow-500'}; // waiting
};

const TugasAktif: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Record<string,Account>>({});
  const [search, setSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [detailTask, setDetailTask] = useState<Task|null>(null);
  const [imagesTask, setImagesTask] = useState<Task|null>(null);
  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setDriverFilter('all');
  };

  const load=async()=>{
    try{
      const res=await fetch('http://66.96.230.177:3000/api/tasks');
      if(res.ok){ const data=await res.json(); setTasks(data); }
    }catch{}
  };

  const loadAccounts = async () => {
    try {
      const res = await fetch('http://66.96.230.177:3000/api/accounts');
      if(res.ok){ const list:Account[]=await res.json(); const map:Record<string,Account>={} ; list.forEach(a=>map[a.deviceId]=a); setAccounts(map); }
    }catch{}
  };

  useEffect(()=>{ load(); loadAccounts(); const id=setInterval(load,5000); return()=>clearInterval(id); },[]);

  const filteredTasks = tasks
    .filter(t => t.status !== 'DIBATALKAN' && t.status !== 'SELESAI')
    .filter(t => driverFilter === 'all' || (t.drivers||[]).includes(driverFilter))
    .filter(t => {
      if(!dateFilter) return true;
      const pd = parseDeadline(t.deadline);
      const dateStr = pd ? pd.toISOString().slice(0,10) : '';
      return dateStr === dateFilter;
    })
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return [t.description, t.from, t.to].some(f => f?.toLowerCase().includes(q));
    })
    .slice()
    .sort((a,b)=>{
      const ta = Date.parse(a.createdAt||a.id);
      const tb = Date.parse(b.createdAt||b.id);
      return tb - ta; // newest first
    });

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col gap-2 overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">TUGAS AKTIF</h3>
      <div className="flex flex-wrap items-center mb-2 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Cari tugas..."
          className="px-2 py-1 rounded bg-zinc-800 text-white text-xs flex-grow md:flex-grow-0 md:w-1/2"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e)=>setDateFilter(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-800 text-white text-xs"
        />
        <select
          value={driverFilter}
          onChange={(e)=>setDriverFilter(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-800 text-white text-xs"
        >
          <option value="all">Semua Driver</option>
          {Object.values(accounts).map(a=>(
            <option key={a.deviceId} value={a.deviceId}>{a.nama}</option>
          ))}
        </select>
        <button onClick={clearFilters} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Clear</button>
      </div>
      {filteredTasks.length===0 && <p className="text-gray-500 text-sm text-center">Tidak ada tugas</p>}
      {filteredTasks.map(t=>{
        const pd = parseDeadline(t.deadline);
        const dstr = pd ? pd.toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : t.deadline;
        const createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : '-';
        const clr=statusColor(t.status);
        return (
          <div key={t.id} className={`bg-gray-800/70 rounded-lg p-4 mb-3 shadow-lg hover:shadow-xl transition border ${clr.border}`} >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-purple-300 text-base truncate max-w-[60%]">{t.description}</h4>
              <div className="text-right flex flex-col items-end">
                <span className={`text-xs ${clr.text}`}>{t.status||'MENUNGGU KONFIRMASI'}</span>
                <span className="text-xs text-gray-400">#{t.id}</span>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex flex-wrap gap-1 items-start mt-1">
                <span className="text-gray-400 mr-1">Driver:</span>
                {(t.drivers||[]).map(id=>{
                  const acc=accounts[id];
                  return <span key={id} className="text-white inline-block bg-purple-700/60 px-2 py-0.5 rounded-md">{acc?`${acc.nama} (${acc.bk})`:id}</span>;
                })}
              </div>
              <div className="flex gap-1"><span className="text-gray-400">Berangkat:</span><span className="text-white flex-1 truncate">{t.from}</span></div>
              <div className="flex gap-1"><span className="text-gray-400">Destinasi:</span><span className="text-white flex-1 truncate">{t.to}</span></div>
              <div className="flex gap-1"><span className="text-gray-400">Deadline:</span><span className="text-red-400">{dstr}</span></div>
              <div className="flex gap-1"><span className="text-gray-400">Tanggal Dibuat:</span><span className="text-white">{createdStr}</span></div>
            </div>
            {t.status!=='DIBATALKAN' && (
              <div className="flex justify-end gap-2 flex-wrap">
                <button onClick={async()=>{
                  await fetch(`http://66.96.230.177:3000/api/tasks/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DIBATALKAN'})});
                  load();
                }} className="mt-2 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs">Batalkan Tugas</button>
                <button onClick={()=>setDetailTask(t)} className="mt-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Lihat Detail</button>
                <button onClick={()=>setImagesTask(t)} className="mt-2 px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs">Lihat Gambar</button>
              </div>
            )}
          </div>
        );
      })}
      {detailTask && (
        <TaskDetailModal task={detailTask} accounts={accounts} onClose={()=>setDetailTask(null)} />
      )}
      {imagesTask && (
        <TaskImagesModal task={imagesTask} onClose={()=>setImagesTask(null)} />
      )}
    </div>
  );
};

export default TugasAktif; 