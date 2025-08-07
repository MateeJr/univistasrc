"use client";

import React, { useState, useEffect } from "react";
import { FiPlus, FiSearch, FiWifi, FiWifiOff } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { HiStatusOnline } from "react-icons/hi";
import AddDriver from "./AddDriver";
import ConfirmDelete from "./ConfirmDelete";

interface DriverListProps { onSelect: (id: string) => void; selectedId?: string; onDeleted?: (id:string)=>void }

const DriverList: React.FC<DriverListProps> = ({ onSelect, selectedId, onDeleted }) => {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<Array<{deviceId:string,nama:string,bk:string}>>([]);
  const [statuses, setStatuses] = useState<Record<string, 'online'|'disconnected'|'offline'>>({});
  const [deleteTarget, setDeleteTarget] = useState<null | {deviceId:string,nama:string}>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [search, setSearch] = useState<string>('');

  const loadDrivers = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);

        // fetch ratings concurrently
        try {
          const scoreRes = await fetch('/api/score');
          if (scoreRes.ok) {
            const scoreData = await scoreRes.json();
            setRatings(scoreData);
          }
        } catch {}

        // fetch status for each
        const statusObj: Record<string,'online'|'disconnected'|'offline'> = {};
        await Promise.all(
          data.map(async (d: any) => {
            try {
              const detailRes = await fetch(`/api/accounts/${d.deviceId}`);
              if (detailRes.ok) {
                const detail = await detailRes.json();
                const last = detail.track?.timestampMs ?? (detail.track?.lastUpdated ? Date.parse(detail.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
                const diffMin = (Date.now() - last) / 60000;
                if (diffMin < 2) statusObj[d.deviceId] = 'online';
                else if (diffMin < 10) statusObj[d.deviceId] = 'disconnected';
                else statusObj[d.deviceId] = 'offline';
              }
            } catch {}
          })
        );
        setStatuses(statusObj);
      }
    } catch {}
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  // refresh statuses & ratings every 10 seconds
  useEffect(() => {
    const id = setInterval(() => {
      loadDrivers();
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // reload list when modal closed after adding
  useEffect(() => {
    if (!open) {
      loadDrivers();
    }
  }, [open]);

  return (
    <div className="relative h-full rounded-xl bg-zinc-950/80 p-6 text-white border border-zinc-800 shadow-2xl backdrop-blur-xl flex flex-col">
      {/* Header with gradient background */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-zinc-900/40 rounded-xl blur-sm"></div>
        <div className="relative flex items-center justify-between">
          <h3 className="text-xl font-bold text-zinc-200">
            DRIVER DASHBOARD
          </h3>
          <button
            title="Tambahkan Driver"
            className="group relative p-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
            aria-label="Tambahkan Driver"
            onClick={() => setOpen(true)}
          >
            <FiPlus size={20} className="transform group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Modern Search box */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-purple-400" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drivers..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-600/50 focus:border-transparent backdrop-blur-sm transition-all duration-300"
        />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
        {/* Master buttons redesigned */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            className={`relative py-3 px-2 sm:py-4 sm:px-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 min-w-0 ${
              selectedId==='MASTER' 
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/30 ring-2 ring-red-400/50' 
                : 'bg-gradient-to-r from-red-600/50 to-red-500/50 hover:from-red-600/70 hover:to-red-500/70'
            }`}
            onClick={() => onSelect('MASTER')}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-red-600/20 rounded-xl blur-sm"></div>
            <span className="relative block text-sm sm:text-base break-words whitespace-normal leading-tight">MASTER</span>
          </button>
          <button
            className={`relative py-3 px-2 sm:py-4 sm:px-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 min-w-0 ${
              selectedId==='MASTER_INFO' 
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/30 ring-2 ring-red-400/50' 
                : 'bg-gradient-to-r from-red-600/50 to-red-500/50 hover:from-red-600/70 hover:to-red-500/70'
            }`}
            onClick={() => onSelect('MASTER_INFO')}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-red-600/20 rounded-xl blur-sm"></div>
            <span className="relative block text-sm sm:text-base break-words whitespace-normal leading-tight">MASTER INFO</span>
          </button>
        </div>

        {/* Driver cards with modern design */}
        <div className="space-y-2">
          {drivers
            .filter((d) => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return (
                d.nama.toLowerCase().includes(q) ||
                d.bk.toLowerCase().includes(q) ||
                d.deviceId.toLowerCase().includes(q)
              );
            })
            .sort((a,b)=>{
              const rank:{[k:string]:number}={online:0,disconnected:1,offline:2};
              const ra=rank[statuses[a.deviceId]||'offline'];
              const rb=rank[statuses[b.deviceId]||'offline'];
              if(ra!==rb) return ra-rb;
              return a.nama.localeCompare(b.nama);
            })
            .map((d) => (
              <div key={d.deviceId} className={`group relative rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
                selectedId===d.deviceId
                  ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/40'
                  : 'bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 backdrop-blur-sm'
              }`}>
                <div className="flex items-center justify-between p-4">
                  <button 
                    className="flex-1 text-left flex items-center gap-3"
                    onClick={() => onSelect(d.deviceId)}
                  >
                    {/* Status indicator with animated pulse */}
                    <div className="relative">
                      {statuses[d.deviceId]==='online' ? (
                        <>
                          <HiStatusOnline className="w-5 h-5 text-emerald-400" />
                          <div className="absolute inset-0 w-5 h-5 bg-emerald-400 rounded-full animate-ping opacity-30"></div>
                        </>
                      ) : statuses[d.deviceId]==='disconnected' ? (
                        <FiWifiOff className="w-5 h-5 text-amber-400" />
                      ) : (
                        <FiWifi className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    {/* Rating with stars */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 backdrop-blur-sm border border-amber-500/20">
                      <FaStar className="text-yellow-400" size={14} />
                      <span className="text-sm font-semibold text-yellow-300">{ratings[d.deviceId] ?? 5}</span>
                    </div>

                    {/* Driver info */}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-white block truncate text-lg">
                        {d.nama}
                      </span>
                      <span className="text-zinc-400 text-sm">ID: {d.bk}</span>
                    </div>
                  </button>

                  {/* Delete button with hover effect */}
                  <button 
                    title="Hapus" 
                    className="ml-3 p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all duration-200 transform hover:scale-110" 
                    onClick={() => setDeleteTarget({deviceId:d.deviceId,nama:d.nama})}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          
          {drivers.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center">
                <FiPlus className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-zinc-400 text-lg">No drivers available</p>
              <p className="text-zinc-500 text-sm mt-1">Add your first driver to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AddDriver open={open} onClose={() => setOpen(false)} />
      <ConfirmDelete
        open={deleteTarget!==null}
        driverName={deleteTarget?.nama || ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await fetch(`/api/accounts/${deleteTarget.deviceId}`, { method: 'DELETE' });
          } catch {}
          setDeleteTarget(null);
          loadDrivers();
          onDeleted?.(deleteTarget.deviceId);
        }}
      />
    </div>
  );
};

export default DriverList; 