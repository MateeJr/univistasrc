"use client";

import React, { useEffect, useState } from "react";
import TaskDetailModal from "./TaskDetailModal";
import { FaTrash, FaEye, FaImages } from "react-icons/fa";
import TaskImagesModal from "./TaskImagesModal";


interface Task { id:string; description:string; from:string; to:string; deadline:string; drivers?:string[]; createdAt?:string; status?:string; waypoints?:{lng:number; lat:number}[] }

interface Account { deviceId:string; nama:string; bk:string }

// Confirmation Modal Component
const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Ya", cancelText = "Batal" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  if(s==='DIBATALKAN') return {text:'text-gray-400',border:'border-gray-600',bg:'bg-gray-600/30'};
  if(s==='SELESAI') return {text:'text-green-400',border:'border-green-500',bg:'bg-green-600/30'};
  if(s==='TELAH DIKONIFIRMASI') return {text:'text-blue-400',border:'border-blue-500',bg:'bg-blue-600/30'};
  if(s?.startsWith('DIPROSES')) return {text:'text-red-400',border:'border-red-500',bg:'bg-red-600/30'};
  return {text:'text-yellow-300',border:'border-yellow-500',bg:'bg-yellow-600/30'}; // waiting
};


const TugasAktif: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Record<string,Account>>({});
  const [search, setSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [detailTask, setDetailTask] = useState<Task|null>(null);
  const [imagesTask, setImagesTask] = useState<Task|null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    taskId: string;
    taskDescription: string;
  }>({ isOpen: false, taskId: '', taskDescription: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [offset, setOffset] = useState<number>(0);
  const LIMIT = 5;
  const [statuses, setStatuses] = useState<Record<string,'online'|'disconnected'|'offline'>>({});

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setDriverFilter('all');
    // Reset pagination when clearing filters
    setTasks([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();
  };

  const refreshData = async () => {
    if(loading) return;
    try {
      setLoading(true);
      const res = await fetch(buildApiUrl(0));
      if(res.ok){
        const response = await res.json();
        const fresh:Task[] = response.tasks || [];

        setTasks(prev => {
          const freshIds = new Set(fresh.map(t=>t.id));
          // Keep previous tasks that are still active and not in the fresh first page
          const remaining = prev.filter(t=>!freshIds.has(t.id) && t.status!=='SELESAI' && t.status!=='DIBATALKAN');
          return [...fresh, ...remaining];
        });

        setHasMore(response.hasMore);
        // Offset stays as is; if user loaded more, keep it
      }
    }catch(err){ console.error('refreshData',err); }
    finally { setLoading(false); }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DIBATALKAN' })
      });
      // Reset and reload from beginning after cancellation
      setTasks([]);
      setOffset(0);
      setHasMore(true);
      loadInitial();
      setConfirmModal({ isOpen: false, taskId: '', taskDescription: '' });
    } catch (error) {
      console.error('Error canceling task:', error);
    }
  };

  const openCancelConfirmation = (task: Task) => {
    setConfirmModal({
      isOpen: true,
      taskId: task.id,
      taskDescription: task.description
    });
  };

  const buildApiUrl = (offset: number) => {
    const params = new URLSearchParams();
    params.append('status', 'active');
    params.append('limit', LIMIT.toString());
    params.append('offset', offset.toString());

    if (search.trim()) params.append('search', search.trim());
    if (dateFilter) params.append('date', dateFilter);
    if (driverFilter && driverFilter !== 'all') params.append('driver', driverFilter);

    return `/api/tasks?${params.toString()}`;
  };

  const loadInitial=async()=>{
    setLoading(true);
    try{
      const res=await fetch(buildApiUrl(0));
      if(res.ok){
        const response=await res.json();
        if(response.tasks) {
          setTasks(response.tasks);
          setHasMore(response.hasMore);
          setOffset(LIMIT);
        } else {
          // Fallback for old API response format
          const activeTasks = response.filter((t:any) => t.status !== 'DIBATALKAN' && t.status !== 'SELESAI');
          setTasks(activeTasks.slice(0, LIMIT));
          setHasMore(activeTasks.length > LIMIT);
          setOffset(LIMIT);
        }
      }
    }catch{}
    setLoading(false);
  };

  const loadMore=async()=>{
    if(loading || !hasMore) return;
    setLoading(true);
    try{
      const res=await fetch(buildApiUrl(offset));
      if(res.ok){
        const response=await res.json();
        if(response.tasks) {
          setTasks(prev => [...prev, ...response.tasks]);
          setHasMore(response.hasMore);
          setOffset(prev => prev + LIMIT);
        } else {
          // Fallback for old API response format
          const activeTasks = response.filter((t:any) => t.status !== 'DIBATALKAN' && t.status !== 'SELESAI');
          const newTasks = activeTasks.slice(offset, offset + LIMIT);
          setTasks(prev => [...prev, ...newTasks]);
          setHasMore(offset + LIMIT < activeTasks.length);
          setOffset(prev => prev + LIMIT);
        }
      }
    }catch{}
    setLoading(false);
  };

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if(res.ok){
        const list:Account[]=await res.json();
        const map:Record<string,Account>={} ; list.forEach(a=>map[a.deviceId]=a); setAccounts(map);

        // compute online statuses similar to DriverList
        const statusObj: Record<string,'online'|'disconnected'|'offline'> = {};
        await Promise.all(
          list.map(async (d:any)=>{
            try{
              const detailRes = await fetch(`/api/accounts/${d.deviceId}`);
              if(detailRes.ok){
                const detail = await detailRes.json();
                const last = detail.track?.timestampMs ?? (detail.track?.lastUpdated ? Date.parse(detail.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
                const diffMin = (Date.now() - last) / 60000;
                if(diffMin < 2) statusObj[d.deviceId] = 'online';
                else if(diffMin < 10) statusObj[d.deviceId] = 'disconnected';
                else statusObj[d.deviceId] = 'offline';
              }
            }catch{}
          })
        );
        setStatuses(statusObj);
      }
    }catch{}
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // This one effect handles initial load, resetting on filter change, and the refresh interval.
  useEffect(() => {
    // Function to fetch the first page and prepend new tasks without a full refresh.
    setTasks([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();

    const intervalId = setInterval(()=>{
      if(!loading && !detailTask && !imagesTask && !confirmModal.isOpen){
        refreshData();
      }
    },10000);
    return () => clearInterval(intervalId);
  }, [search, dateFilter, driverFilter]);

  // refresh statuses every 10s
  useEffect(()=>{
    const id=setInterval(()=>{loadAccounts();},10000);
    return ()=> clearInterval(id);
  },[]);

  const filteredTasks = tasks;

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col gap-2 overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">TUGAS AKTIF</h3>
      <div className="flex flex-wrap items-center mb-2 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Cari tugas, lokasi, atau status (diproses, dikonfirmasi)..."
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
        <button onClick={refreshData} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Refresh</button>
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
                <span className={`text-xs font-semibold inline-block px-2 py-0.5 rounded-lg backdrop-blur-sm ${clr.text} ${clr.bg}`}>{t.status||'MENUNGGU KONFIRMASI'}</span>
                <span className="text-xs text-gray-400">#{t.id}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between text-sm">
              {/* Left side - Driver and Location Info */}
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap gap-1 items-start">
                  <span className="text-gray-400 mr-1">Driver:</span>
                  {(t.drivers||[]).map(id=>{
                    const acc=accounts[id];
                    return (
                      <span key={id} className="text-white inline-flex items-center gap-1 bg-purple-700/60 px-2 py-0.5 rounded-md">
                        <span className={`w-2 h-2 rounded-full ${statuses[id]==='online'?'bg-green-400':statuses[id]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                        {acc?`${acc.nama} (${acc.bk})`:id}
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-1"><span className="text-gray-400">Berangkat:</span><span className="text-white flex-1 truncate">{t.from}</span></div>
                <div className="flex gap-1"><span className="text-gray-400">Destinasi:</span><span className="text-white flex-1 truncate">{t.to}</span></div>
              </div>

              {/* Right side - Date and Time Info */}
              <div className="space-y-1 text-right mt-2 md:mt-0">
                <div className="text-gray-400 text-xs">Tanggal Dibuat: <span className="text-white">{createdStr}</span></div>
                <div className="text-gray-400 text-xs">Deadline: <span className="text-red-400">{dstr}</span></div>
              </div>
            </div>
            {t.status!=='DIBATALKAN' && (
              <div className="flex justify-end gap-2 flex-wrap">
                <button
                  onClick={() => openCancelConfirmation(t)}
                  className="mt-2 p-2 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
                  title="Batalkan Tugas"
                >
                  <FaTrash size={14} />
                </button>
                <button 
                  onClick={()=>setDetailTask(t)} 
                  className="mt-2 p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  title="Lihat Detail"
                >
                  <FaEye size={14} />
                </button>
                <button 
                  onClick={()=>setImagesTask(t)} 
                  className="mt-2 p-2 rounded-full bg-green-600 hover:bg-green-500 text-white transition-colors"
                  title="Lihat Gambar"
                >
                  <FaImages size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Load More Button - only show if there's more data AND we have loaded some tasks */}
      {hasMore && tasks.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'LOAD MORE'}
          </button>
        </div>
      )}

      {/* Loading indicator for initial load */}
      {loading && tasks.length === 0 && (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-400">Loading tasks...</div>
        </div>
      )}

      {detailTask && (
        <TaskDetailModal task={detailTask} accounts={accounts} onClose={()=>setDetailTask(null)} />
      )}
      {imagesTask && (
        <TaskImagesModal task={imagesTask} onClose={()=>setImagesTask(null)} />
      )}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, taskId: '', taskDescription: '' })}
        onConfirm={() => handleCancelTask(confirmModal.taskId)}
        title="Konfirmasi Pembatalan Tugas"
        message={`Apakah Anda yakin ingin membatalkan tugas "${confirmModal.taskDescription}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
      />
    </div>
  );
};

export default TugasAktif; 