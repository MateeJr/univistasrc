"use client";

import React, { useEffect, useState } from "react";
import TaskDetailModal from "./TaskDetailModal";
import TaskImagesModal from "./TaskImagesModal";
import TrackingPlaybackModal from "./TrackingPlaybackModal";
import { FaTrash, FaDownload, FaEye, FaImages, FaPlay } from "react-icons/fa";
import { getTaskCompletionTime, getTaskCancellationTime } from "../../utils/timeUtils";

interface Task { id:string; description:string; from:string; to:string; deadline:string; drivers?:string[]; createdAt?:string; status?:string; waypoints?:{lng:number; lat:number}[]; startTimestamp?:string; endTimestamp?:string; completionTimeMs?:number; cancelledTimestamp?:string }

interface Account { deviceId:string; nama:string; bk:string }

// helper parse deadline string (DD/MM/YYYY HH:MM or ISO)
const parseDeadline = (str:string):Date|null=>{
  if(!str) return null;
  if(/\d{2}\/\d{2}\/\d{4}/.test(str)){
    const [datePart,timePart] = str.split(' ');
    const [day,month,year]=datePart.split('/').map(Number);
    const [hour,min] = (timePart||'00:00').split(':').map(Number);
    const d = new Date(year,month-1,day,hour||0,min||0);
    return isNaN(d.getTime())?null:d;
  }
  const d=new Date(str);
  return isNaN(d.getTime())?null:d;
};

const TugasSelesai: React.FC = () => {
  const [tasks,setTasks]=useState<Task[]>([]);
  const [accounts,setAccounts]=useState<Record<string,Account>>({});
  const [statuses,setStatuses]=useState<Record<string,'online'|'disconnected'|'offline'>>({});
  const [search,setSearch]=useState<string>('');
  const [driverFilter,setDriverFilter]=useState<string>('all');
  const [dateFilter,setDateFilter]=useState<string>('');
  const [imagesTask, setImagesTask] = useState<Task|null>(null);
  const [detailTask, setDetailTask] = useState<Task|null>(null);
  const [playbackTask, setPlaybackTask] = useState<Task|null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [offset, setOffset] = useState<number>(0);
  const LIMIT = 5;

  const clearFilters=()=>{
    setSearch('');
    setDateFilter('');
    setDriverFilter('all');
    // Reset pagination when clearing filters
    setTasks([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();
  };

  const refreshData=()=>{
    setTasks([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();
  };

  const buildApiUrl = (offset: number) => {
    const params = new URLSearchParams();
    params.append('status', 'completed');
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
      const r=await fetch(buildApiUrl(0));
      if(r.ok){
        const response=await r.json();
        if(response.tasks) {
          setTasks(response.tasks);
          setHasMore(response.hasMore);
          setOffset(LIMIT);
        } else {
          // Fallback for old API response format
          const completedTasks = response.filter((t:any)=>t.status==='DIBATALKAN' || t.status==='SELESAI');
          setTasks(completedTasks.slice(0, LIMIT));
          setHasMore(completedTasks.length > LIMIT);
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
      const r=await fetch(buildApiUrl(offset));
      if(r.ok){
        const response=await r.json();
        if(response.tasks) {
          setTasks(prev => [...prev, ...response.tasks]);
          setHasMore(response.hasMore);
          setOffset(prev => prev + LIMIT);
        } else {
          // Fallback for old API response format
          const completedTasks = response.filter((t:any)=>t.status==='DIBATALKAN' || t.status==='SELESAI');
          const newTasks = completedTasks.slice(offset, offset + LIMIT);
          setTasks(prev => [...prev, ...newTasks]);
          setHasMore(offset + LIMIT < completedTasks.length);
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
        const list:Account[]=await res.json(); const map:Record<string,Account>={}; list.forEach(a=>map[a.deviceId]=a); setAccounts(map);

        const statusObj:Record<string,'online'|'disconnected'|'offline'>={};
        await Promise.all(list.map(async(d:any)=>{
          try{
            const detailRes=await fetch(`/api/accounts/${d.deviceId}`);
            if(detailRes.ok){
              const detail=await detailRes.json();
              const last= detail.track?.timestampMs ?? (detail.track?.lastUpdated ? Date.parse(detail.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
              const diffMin=(Date.now()-last)/60000;
              if(diffMin<2) statusObj[d.deviceId]='online';
              else if(diffMin<10) statusObj[d.deviceId]='disconnected';
              else statusObj[d.deviceId]='offline';
            }
          }catch{}
        }));
        setStatuses(statusObj);
      }
    }catch{}
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const refreshTasks = async () => {
      if (loading || detailTask || imagesTask || playbackTask) return;
      try {
        const res = await fetch(buildApiUrl(0));
        if (res.ok) {
          const response = await res.json();
          const fetchedTasks: Task[] = response.tasks || [];
          if (fetchedTasks.length > 0) {
            setTasks(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const newTasks = fetchedTasks.filter(t => !existingIds.has(t.id));
              if (newTasks.length > 0) {
                setOffset(o => o + newTasks.length);
                return [...newTasks, ...prev];
              }
              return prev;
            });
          }
        }
      } catch (e) { console.error('Error refreshing tasks:', e); }
    };

    setTasks([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();

    const intervalId = setInterval(refreshTasks, 10000);
    return () => clearInterval(intervalId);
  }, [search, dateFilter, driverFilter]);

  useEffect(()=>{ const id=setInterval(()=>{loadAccounts();},10000); return ()=>clearInterval(id);},[]);

  const filteredTasks = tasks;

  const statusColor = (s?:string)=>{
    if(s==='DIBATALKAN') return {text:'text-gray-400',border:'border-gray-600',bg:'bg-gray-600/30'};
    if(s==='SELESAI') return {text:'text-green-400',border:'border-green-500',bg:'bg-green-600/30'};
    if(s==='TELAH DIKONIFIRMASI') return {text:'text-blue-400',border:'border-blue-500',bg:'bg-blue-600/30'};
    if(s?.startsWith('DIPROSES')) return {text:'text-red-400',border:'border-red-500',bg:'bg-red-600/30'};
    return {text:'text-yellow-300',border:'border-yellow-500',bg:'bg-yellow-600/30'};
  };
  

  const handleDownload = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.split('filename=')[1] || `task-${taskId}.zip`;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 100);
    } catch (error) {
      console.error('Download error:', error);
      alert('Gagal mendownload tugas. Silakan coba lagi.');
    }
  };

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col gap-2 overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center">TUGAS SELESAI</h3>
      <div className="flex flex-wrap items-center mb-2 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Cari tugas, lokasi, atau status (selesai, dibatalkan)..."
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
      {filteredTasks.length===0 && !loading && <p className="text-gray-500 text-sm text-center">Tidak ada tugas selesai</p>}
      {filteredTasks.map(t=>{
          const dParsed = parseDeadline(t.deadline);
          const dstr = dParsed ? dParsed.toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : t.deadline;
          const createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : '-';
          const clr = statusColor(t.status);
          return (
            <div key={t.id} className={`bg-gray-800/70 rounded-lg p-4 mb-3 shadow-lg border ${clr.border}`}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-purple-300 text-base truncate max-w-[60%]">{t.description}</h4>
                <div className="text-right flex flex-col items-end">
                  <span className={`text-xs font-semibold inline-block px-2 py-0.5 rounded-lg backdrop-blur-sm ${clr.text} ${clr.bg}`}>{t.status}</span>
                  <span className="text-xs text-gray-400">#{t.id}</span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row flex-wrap justify-between gap-2 text-sm">
                {/* Left side - Driver and Location Info */}
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap gap-1 items-start">
                    <span className="text-gray-400 mr-1">Driver:</span>
                    {(t.drivers||[]).map(id=>{ const acc=accounts[id]; return (
                      <span key={id} className="text-white inline-flex items-center gap-1 bg-purple-700/60 px-2 py-0.5 rounded-md">
                        <span className={`w-2 h-2 rounded-full ${statuses[id]==='online'?'bg-green-400':statuses[id]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                        {acc?`${acc.nama} (${acc.bk})`:id}
                      </span>
                    ); })}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1"><span className="text-gray-400">Berangkat:</span><span className="text-white flex-1 whitespace-normal break-words">{t.from}</span></div>
                  <div className="flex flex-col sm:flex-row gap-1"><span className="text-gray-400">Destinasi:</span><span className="text-white flex-1 whitespace-normal break-words">{t.to}</span></div>
                </div>

                {/* Right side - Date and Time Info */}
                <div className="space-y-1 text-left lg:text-right mt-2 lg:mt-0 w-full lg:w-56 flex-shrink-0">
                  {/* Created date */}
                  <div className="text-gray-400 text-xs">Tanggal Dibuat: <span className="text-white">{createdStr}</span></div>
                  {/* Submitted date (driver menekan selesai / dibatalkan) */}
                  {t.status==='SELESAI' && (() => {
                    const submittedAt = t.endTimestamp || null;
                    if(!submittedAt) return null;
                    const submitStr = new Date(submittedAt).toLocaleString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }).replace('.', ':');
                    return (
                      <div className="text-gray-400 text-xs">Tanggal diSubmit: <span className="text-blue-400">{submitStr}</span></div>
                    );
                  })()}
                  <div className="text-gray-400 text-xs">Deadline: <span className="text-red-400">{dstr}</span></div>
                  {t.status === 'SELESAI' && (() => {
                    const completionTime = getTaskCompletionTime(t);
                    return completionTime ? (
                      <div className="text-gray-400 text-xs">Waktu Penyelesaian: <span className="text-green-400">{completionTime}</span></div>
                    ) : null;
                  })()}
                  {t.status === 'DIBATALKAN' && (() => {
                    const cancellationTime = getTaskCancellationTime(t);
                    return cancellationTime ? (
                      <div className="text-gray-400 text-xs">Waktu Dibatalkan: <span className="text-red-400">{cancellationTime}</span></div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
                <button
                  onClick={async()=>{
                    if(!confirm('Hapus tugas ini secara permanen?')) return;
                    await fetch(`/api/tasks/${t.id}`,{method:'DELETE'});
                    // Reset and reload from beginning after deletion
                    setTasks([]);
                    setOffset(0);
                    setHasMore(true);
                    loadInitial();
                  }}
                  className="mt-2 p-2 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
                  title="Hapus Tugas"
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
                <button
                  onClick={()=>handleDownload(t.id)}
                  className="mt-2 p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  title="Download"
                >
                  <FaDownload size={14} />
                </button>
                {t.status === 'SELESAI' && (
                  <button
                    onClick={()=>setPlaybackTask(t)}
                    className="mt-2 p-2 rounded-full bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                    title="Tracking Playback"
                  >
                    <FaPlay size={14} />
                  </button>
                )}
              </div>
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
      {playbackTask && (
        <TrackingPlaybackModal task={playbackTask} accounts={accounts} onClose={()=>setPlaybackTask(null)} />
      )}
    </div>
  );
};

export default TugasSelesai;
