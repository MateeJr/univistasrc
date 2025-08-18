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

// Determine the task's submission date based on status/end/cancel timestamps
const getTaskSubmissionDate = (t: Task): Date | null => {
  let dateStr: string | undefined;
  if (t.status === 'SELESAI' && t.endTimestamp) {
    dateStr = t.endTimestamp;
  } else if (t.status === 'DIBATALKAN' && t.cancelledTimestamp) {
    dateStr = t.cancelledTimestamp;
  } else if (t.createdAt) {
    dateStr = t.createdAt;
  }
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// Map a submission date into a readable time-ago header
const getCheckpointLabel = (date: Date | null): string | null => {
  if (!date) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Calculate difference in days, ignoring time component
  const submissionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = startOfToday.getTime() - submissionDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return null; // Today or future dates have no header
  if (diffDays === 1) return 'Kemarin';
  if (diffDays <= 7) return 'Minggu Ini';
  if (diffDays <= 14) return 'Minggu Lalu';
  if (diffDays <= 30) return 'Bulan Ini';
  return 'Bulan Lalu'; // Older than 30 days
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

  const filteredTasks = tasks.sort((a, b) => {
    // Sort by submission date (endTimestamp for completed, cancelledTimestamp for cancelled)
    // Most recent submission date should be on top
    let aTime = 0;
    let bTime = 0;
    
    // For task a
    if (a.status === 'SELESAI' && a.endTimestamp) {
      aTime = new Date(a.endTimestamp).getTime();
    } else if (a.status === 'DIBATALKAN' && a.cancelledTimestamp) {
      aTime = new Date(a.cancelledTimestamp).getTime();
    } else if (a.createdAt) {
      // Fallback to created date if no submission date
      aTime = new Date(a.createdAt).getTime();
    }
    
    // For task b
    if (b.status === 'SELESAI' && b.endTimestamp) {
      bTime = new Date(b.endTimestamp).getTime();
    } else if (b.status === 'DIBATALKAN' && b.cancelledTimestamp) {
      bTime = new Date(b.cancelledTimestamp).getTime();
    } else if (b.createdAt) {
      // Fallback to created date if no submission date
      bTime = new Date(b.createdAt).getTime();
    }
    
    return bTime - aTime; // Descending order (most recent first)
  });

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
    <div className="h-full rounded-xl bg-gradient-to-b from-zinc-950 to-black p-4 text-white border border-zinc-800 shadow-xl/20 flex flex-col gap-3 overflow-auto">
      <h3 className="text-lg md:text-xl font-semibold tracking-wide text-purple-200 mb-1 text-center">TUGAS SELESAI</h3>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/80 bg-black/60 backdrop-blur p-2">
        <input
          type="text"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Cari tugas, lokasi, atau status (selesai, dibatalkan)..."
          className="h-9 px-3 py-2 rounded-md bg-zinc-900/70 text-white placeholder-zinc-500 text-xs border border-zinc-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-none transition flex-grow md:flex-grow-0 md:w-1/2"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e)=>setDateFilter(e.target.value)}
          className="h-9 px-3 py-2 rounded-md bg-zinc-900/70 text-white placeholder-zinc-500 text-xs border border-zinc-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-none transition"
        />
        <select
          value={driverFilter}
          onChange={(e)=>setDriverFilter(e.target.value)}
          className="h-9 px-3 py-2 rounded-md bg-zinc-900/70 text-white text-xs border border-zinc-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-none transition"
        >
          <option value="all">Semua Driver</option>
          {Object.values(accounts).map(a=>(
            <option key={a.deviceId} value={a.deviceId}>{a.nama}</option>
          ))}
        </select>
        <button onClick={clearFilters} className="h-9 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition">Clear</button>
        <button onClick={refreshData} className="h-9 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition">Refresh</button>
      </div>
      {filteredTasks.length===0 && !loading && <p className="text-gray-500 text-sm text-center">Tidak ada tugas selesai</p>}
      {(() => {
        let lastLabel: string | null = null;
        return filteredTasks.map(t=>{
          const submissionDate = getTaskSubmissionDate(t);
          const headerLabel = getCheckpointLabel(submissionDate);
          const showHeader = !!headerLabel && headerLabel !== lastLabel;
          if (headerLabel) lastLabel = headerLabel;
          const dParsed = parseDeadline(t.deadline);
          const dstr = dParsed ? dParsed.toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : t.deadline;
          const createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : '-';
          const clr = statusColor(t.status);
          return (
            <React.Fragment key={t.id}>
              {showHeader && (
                <div className="mt-3 mb-1 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-400">
                  <div className="h-px bg-zinc-800 flex-1" />
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-purple-200">{headerLabel}</span>
                  <div className="h-px bg-zinc-800 flex-1" />
                </div>
              )}
              <div className={`bg-zinc-900/60 rounded-xl p-4 mb-3 border ${clr.border} hover:border-purple-500/40 shadow-sm hover:shadow-md transition-all duration-200`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-purple-200 text-base truncate max-w-[60%] tracking-wide">{t.description}</h4>
                  <div className="text-right flex flex-col items-end">
                    <span className={`text-xs font-semibold inline-block px-2 py-0.5 rounded-md border border-white/10 ${clr.text} ${clr.bg}`}>{t.status}</span>
                    <span className="text-xs text-gray-400">#{t.id}</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row flex-wrap justify-between gap-2 text-sm">
                  {/* Left side - Driver and Location Info */}
                  <div className="space-y-1 flex-1 min-w-0 pr-4">
                    <div className="flex flex-wrap gap-1 items-start">
                      <span className="text-gray-400 mr-1">Driver:</span>
                      {(t.drivers||[]).map(id=>{ const acc=accounts[id]; return (
                        <span key={id} className="text-white inline-flex items-center gap-1 bg-purple-700/40 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          <span className={`w-2 h-2 rounded-full shadow-inner ${statuses[id]==='online'?'bg-green-400':statuses[id]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                          {acc?`${acc.nama} (${acc.bk})`:id}
                        </span>
                      ); })}
                    </div>
                    <div className="flex gap-1"><span className="text-gray-400">Berangkat:</span><span className="text-white flex-1 truncate">{t.from}</span></div>
                    <div className="flex gap-1"><span className="text-gray-400">Destinasi:</span><span className="text-white flex-1 truncate">{t.to}</span></div>
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
                    className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-red-700/30 bg-red-600/20 hover:bg-red-600/30 text-white transition-colors"
                    title="Hapus Tugas"
                  >
                    <FaTrash size={14} />
                  </button>
                  <button
                    onClick={()=>setDetailTask(t)}
                    className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-blue-700/30 bg-blue-600/20 hover:bg-blue-600/30 text-white transition-colors"
                    title="Lihat Detail"
                  >
                    <FaEye size={14} />
                  </button>
                  <button
                    onClick={()=>setImagesTask(t)}
                    className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-green-700/30 bg-green-600/20 hover:bg-green-600/30 text-white transition-colors"
                    title="Lihat Gambar"
                  >
                    <FaImages size={14} />
                  </button>
                  <button
                    onClick={()=>handleDownload(t.id)}
                    className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-purple-700/30 bg-purple-600/20 hover:bg-purple-600/30 text-white transition-colors"
                    title="Download"
                  >
                    <FaDownload size={14} />
                  </button>
                  {t.status === 'SELESAI' && (
                    <button
                      onClick={()=>setPlaybackTask(t)}
                      className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-orange-700/30 bg-orange-600/20 hover:bg-orange-600/30 text-white transition-colors"
                      title="Tracking Playback"
                    >
                      <FaPlay size={14} />
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        });
      })()}

      {/* Load More Button - only show if there's more data AND we have loaded some tasks */}
      {hasMore && tasks.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold shadow-md transition-colors"
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
