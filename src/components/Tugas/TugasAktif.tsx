"use client";

import React, { useEffect, useState } from "react";
import TaskDetailModal from "./TaskDetailModal";
import { FaTrash, FaEye, FaImages } from "react-icons/fa";
import TaskImagesModal from "./TaskImagesModal";


interface Task { id:string; description:string; from:string; to:string; fromCoord?:string; toCoord?:string; deadline:string; drivers?:string[]; createdAt?:string; status?:string; waypoints?:{lng:number; lat:number}[]; distanceKm?:number; etaMin?:number; }

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full mx-4 border border-zinc-800 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4 tracking-wide">{title}</h3>
        <p className="text-gray-300/90 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600/90 hover:bg-red-500 text-white text-sm border border-red-700/40 focus:outline-none focus:ring-2 focus:ring-red-500/30"
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
  const [statuses, setStatuses] = useState<Record<string,'online'|'disconnected'|'offline'>>({});
  const [realTimeEtas, setRealTimeEtas] = useState<Record<string, Record<string, {etaMin: number, distanceKm: number, lastUpdated: number}>>>({});
  const [etaCalculating, setEtaCalculating] = useState<boolean>(false);

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
    // fetch all active tasks without pagination

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
          setHasMore(false);
        } else {
          // Fallback for old API response format
          const activeTasks = response.filter((t:any) => t.status !== 'DIBATALKAN' && t.status !== 'SELESAI');
          setTasks(activeTasks);
          setHasMore(false);
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

  // Function to get driver's current coordinates
  const getDriverLocation = async (deviceId: string): Promise<{lat: number, lng: number} | null> => {
    try {
      console.log(`📡 Fetching location for driver: ${deviceId}`);
      const detailRes = await fetch(`/api/accounts/${deviceId}`);
      if (!detailRes.ok) {
        console.log(`❌ API call failed for driver ${deviceId}: ${detailRes.status}`);
        return null;
      }
      const detail = await detailRes.json();
      console.log(`📊 Driver ${deviceId} detail:`, detail);
      
      // Check multiple possible location data structures
      let lat: number | null = null;
      let lng: number | null = null;
      
      // Try to get coordinates from various possible structures
      if (detail.track) {
        // Method 1: direct lat/lng in track
        if (detail.track.lat && detail.track.lng) {
          lat = parseFloat(detail.track.lat);
          lng = parseFloat(detail.track.lng);
        }
        // Method 2: latitude/longitude in track
        else if (detail.track.latitude && detail.track.longitude) {
          lat = parseFloat(detail.track.latitude);
          lng = parseFloat(detail.track.longitude);
        }
        // Method 3: location object in track
        else if (detail.track.location) {
          lat = parseFloat(detail.track.location.lat || detail.track.location.latitude);
          lng = parseFloat(detail.track.location.lng || detail.track.location.longitude);
        }
        // Method 4: coordinates array [lng, lat]
        else if (detail.track.coordinates && Array.isArray(detail.track.coordinates)) {
          lng = parseFloat(detail.track.coordinates[0]);
          lat = parseFloat(detail.track.coordinates[1]);
        }
      }
      
      // Also try direct on detail object
      if (!lat || !lng) {
        lat = lat || parseFloat(detail.lat || detail.latitude);
        lng = lng || parseFloat(detail.lng || detail.longitude);
      }
      
      // Check if we have valid coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.log(`❌ No valid location data for driver ${deviceId}. Available keys:`, Object.keys(detail.track || {}));
        return null;
      }
      
      const location = { lat, lng };
      console.log(`📍 Driver ${deviceId} location:`, location);
      return location;
    } catch (error) {
      console.error(`❌ Error fetching location for driver ${deviceId}:`, error);
      return null;
    }
  };

  // Function to calculate ETA using Mapbox Directions API
  const calculateETA = async (fromLat: number, fromLng: number, toCoord: string): Promise<{etaMin: number, distanceKm: number} | null> => {
    try {
      console.log(`🗺️ Calculating ETA from (${fromLat}, ${fromLng}) to ${toCoord}`);
      
      const [toLat, toLng] = toCoord.split(',').map(parseFloat);
      if (isNaN(toLat) || isNaN(toLng)) {
        console.log(`❌ Invalid destination coordinates: ${toCoord}`);
        return null;
      }

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        console.warn('❌ NEXT_PUBLIC_MAPBOX_TOKEN not found for ETA calculation');
        return null;
      }
      
      const coordsString = `${fromLng},${fromLat};${toLng},${toLat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${token}`;
      
      console.log(`📡 Making Mapbox API call: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`❌ Mapbox API call failed: ${res.status}`);
        return null;
      }
      
      const data = await res.json();
      console.log(`📊 Mapbox response:`, data);
      
      const route = data.routes?.[0];
      if (!route) {
        console.log('❌ No route found in Mapbox response');
        return null;
      }

      const result = {
        etaMin: Math.round(route.duration / 60),
        distanceKm: Math.round(route.distance / 100) / 10 // one decimal km
      };
      
      console.log(`✅ ETA calculation successful:`, result);
      return result;
    } catch (error) {
      console.error('❌ Error in ETA calculation:', error);
      return null;
    }
  };

  // Function to update real-time ETA for all active tasks
  const updateRealTimeEtas = async () => {
    console.log('🚗 Starting real-time ETA calculation...');
    if (loading) {
      console.log('⏳ Skipping ETA calculation - component is loading');
      return;
    }
    
    setEtaCalculating(true);
    
    const activeProcessingTasks = tasks.filter(task => 
      task.status?.startsWith('DIPROSES') && task.drivers && task.drivers.length > 0
    );

    console.log(`📋 Found ${activeProcessingTasks.length} active DIPROSES tasks`);
    if (activeProcessingTasks.length === 0) {
      setEtaCalculating(false);
      return;
    }

    const newEtas: Record<string, Record<string, {etaMin: number, distanceKm: number, lastUpdated: number}>> = { ...realTimeEtas };

    for (const task of activeProcessingTasks) {
      console.log(`🎯 Processing task: ${task.id} - ${task.description}`);
      console.log(`📍 Task destination (toCoord): ${task.toCoord}`);
      
      if (!task.drivers) continue;
      
      if (!newEtas[task.id]) {
        newEtas[task.id] = {};
      }

      for (const driverId of task.drivers) {
        console.log(`👤 Processing driver: ${driverId} (status: ${statuses[driverId]})`);
        
        // Only calculate for online/disconnected drivers
        if (statuses[driverId] === 'offline') {
          console.log(`❌ Skipping offline driver: ${driverId}`);
          continue;
        }

        const driverLocation = await getDriverLocation(driverId);
        console.log(`📍 Driver location:`, driverLocation);
        if (!driverLocation) continue;

        // Use task.toCoord as destination coordinates
        if (!task.toCoord) {
          console.log(`❌ Task ${task.id} missing toCoord`);
          continue;
        }
        
        const etaData = await calculateETA(driverLocation.lat, driverLocation.lng, task.toCoord);
        console.log(`⏱️ ETA calculation result:`, etaData);
        
        if (etaData) {
          newEtas[task.id][driverId] = {
            ...etaData,
            lastUpdated: Date.now()
          };
          console.log(`✅ Updated ETA for task ${task.id}, driver ${driverId}: ${etaData.etaMin} min`);
        }
      }
    }

    console.log('📊 Final ETA data:', newEtas);
    setRealTimeEtas(newEtas);
    setEtaCalculating(false);
  };

  // Set up 5-minute interval for real-time ETA calculations
  useEffect(() => {
    // Run initial calculation immediately when component mounts
    updateRealTimeEtas();

    const etaIntervalId = setInterval(() => {
      updateRealTimeEtas();
    }, 5 * 60 * 1000); // 5 minutes = 300,000ms

    return () => clearInterval(etaIntervalId);
  }, [tasks, statuses]); // Re-run when tasks or statuses change

  // Clean up real-time ETAs for tasks that are no longer in DIPROSES status
  useEffect(() => {
    const activeProcessingTaskIds = new Set(
      tasks.filter(task => task.status?.startsWith('DIPROSES')).map(task => task.id)
    );

    setRealTimeEtas(prevEtas => {
      const cleanedEtas: typeof prevEtas = {};
      
      // Only keep ETAs for tasks that are still in DIPROSES status
      Object.keys(prevEtas).forEach(taskId => {
        if (activeProcessingTaskIds.has(taskId)) {
          cleanedEtas[taskId] = prevEtas[taskId];
        }
      });
      
      return cleanedEtas;
    });
  }, [tasks]);

  const filteredTasks = tasks;

  return (
    <div className="h-full rounded-xl bg-gradient-to-b from-zinc-950 to-black p-4 text-white border border-zinc-800 shadow-xl/20 flex flex-col gap-3 overflow-auto">
      <h3 className="text-lg md:text-xl font-semibold tracking-wide text-purple-200 mb-1 text-center">TUGAS AKTIF</h3>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/80 bg-black/60 backdrop-blur p-2">
        <input
          type="text"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Cari tugas, lokasi, atau status (diproses, dikonfirmasi)..."
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
      {filteredTasks.length===0 && <p className="text-gray-500 text-sm text-center">Tidak ada tugas</p>}
      {filteredTasks.map((t,idx)=>{
        const pd = parseDeadline(t.deadline);
        const dstr = pd ? pd.toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : t.deadline;
        const createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('id-ID',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace('.',':') : '-';
        const clr=statusColor(t.status);
        return (
          <div key={t.id} className={`relative bg-zinc-900/60 rounded-xl p-4 mb-3 border ${clr.border} hover:border-purple-500/40 shadow-sm hover:shadow-md transition-all duration-200`} >
            {/* Order badge */}
            <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 ring-2 ring-purple-900/50 shadow flex items-center justify-center text-white text-xs font-semibold select-none">
              {idx+1}
            </div>
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-purple-200 text-base truncate max-w-[60%] tracking-wide">{t.description}</h4>
              <div className="text-right flex flex-col items-end">
                <span className={`text-xs font-semibold inline-block px-2 py-0.5 rounded-md border border-white/10 ${clr.text} ${clr.bg}`}>{t.status||'MENUNGGU KONFIRMASI'}</span>
                <span className="text-xs text-gray-400">#{t.id}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between text-sm">
              {/* Left side - Driver and Location Info */}
              <div className="space-y-1 flex-1 min-w-0 pr-4">
                <div className="flex flex-wrap gap-1 items-start">
                  <span className="text-gray-400 mr-1">Driver:</span>
                  {(t.drivers||[]).map(id=>{
                    const acc=accounts[id];
                    return (
                      <span key={id} className="text-white inline-flex items-center gap-1 bg-purple-700/40 border border-purple-500/20 px-2 py-0.5 rounded-md">
                        <span className={`w-2 h-2 rounded-full shadow-inner ${statuses[id]==='online'?'bg-green-400':statuses[id]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                        {acc?`${acc.nama} (${acc.bk})`:id}
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-1"><span className="text-gray-400">Berangkat:</span><span className="text-white flex-1 truncate">{t.from}</span></div>
                <div className="flex gap-1"><span className="text-gray-400">Destinasi:</span><span className="text-white flex-1 truncate">{t.to}</span></div>
                {(t.distanceKm !== undefined || t.etaMin !== undefined || realTimeEtas[t.id]) && (
                  <div className="flex gap-1">
                    <span className="text-gray-400">Estimasi Perjalanan:</span>
                    <div className="text-white flex-1">
                      {/* Static estimates from task creation */}
                      {(t.distanceKm !== undefined || t.etaMin !== undefined) && (
                        <div className="truncate">
                          <span className="text-green-400 font-medium">🟢 Awal: </span>
                          {t.distanceKm !== undefined && `${t.distanceKm} km`}
                          {t.distanceKm !== undefined && t.etaMin !== undefined && ' | '}
                          {t.etaMin !== undefined && `${t.etaMin} menit`}
                        </div>
                      )}
                      
                      {/* Real-time estimates for DIPROSES tasks */}
                      {t.status?.startsWith('DIPROSES') && (
                        <div className="mt-1">
                          {realTimeEtas[t.id] ? (
                            // Show actual ETA data when available
                            Object.entries(realTimeEtas[t.id]).map(([driverId, etaData]) => {
                              const driver = accounts[driverId];
                              const ageMinutes = Math.floor((Date.now() - etaData.lastUpdated) / 60000);
                              const timeText = ageMinutes === 0 ? 'baru saja' : `${ageMinutes} menit yang lalu`;
                              const etaDisplay = etaData.etaMin === 0 ? 'Sampai Destinasi' : `${etaData.distanceKm} km | ${etaData.etaMin} menit`;
                              return (
                                <div key={driverId} className="text-sm truncate">
                                  <span className="text-green-400 font-medium">🔴 LIVE: </span>
                                  <span className="text-yellow-300 font-medium">{etaDisplay}</span>
                                  <span className="text-gray-500 text-xs ml-1">({timeText})</span>
                                </div>
                              );
                            })
                          ) : (
                            // Show loading state when ETA data is not yet available
                            <div className="text-sm truncate">
                              <span className="text-green-400 font-medium">🔴 LIVE: </span>
                              <span className="text-gray-400">Sedang Menghitung...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  className="mt-2 h-9 w-9 inline-flex items-center justify-center rounded-md border border-red-700/30 bg-red-600/20 hover:bg-red-600/30 text-white transition-colors"
                  title="Batalkan Tugas"
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
              </div>
            )}
          </div>
        );
      })}

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