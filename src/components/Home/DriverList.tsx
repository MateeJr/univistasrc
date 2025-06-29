"use client";

import React, { useState, useEffect } from "react";
import { FiPlus } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
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
      const res = await fetch('http://193.70.34.25:20096/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);

        // fetch ratings concurrently
        try {
          const scoreRes = await fetch('http://193.70.34.25:20096/api/score');
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
              const detailRes = await fetch(`http://193.70.34.25:20096/api/accounts/${d.deviceId}`);
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
    <div className="relative h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col items-center text-center">
      {/* Add Driver button */}
      <button
        title="Tambahkan Driver"
        className="cursor-pointer absolute top-2 right-2 p-2 rounded-full hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label="Tambahkan Driver"
        onClick={() => setOpen(true)}
      >
        <FiPlus size={20} />
      </button>
      <h3 className="text-lg font-semibold mb-2">LIST DRIVER</h3>

      {/* Search box */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari driver..."
        className="w-full mb-2 px-3 py-2 rounded bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
      />

      <div className="w-full space-y-2 overflow-y-auto">
        {/* Master buttons in two columns */}
        <div className="w-full flex gap-2">
          <button
            className={`flex-1 text-center py-2 rounded font-semibold text-white ${selectedId==='MASTER'?'bg-red-700':'bg-red-600'} hover:bg-red-500`}
            onClick={() => onSelect('MASTER')}
          >
            MASTER
          </button>
          <button
            className={`flex-1 text-center py-2 rounded font-semibold text-white ${selectedId==='MASTER_INFO'?'bg-orange-700':'bg-orange-600'} hover:bg-orange-500`}
            onClick={() => onSelect('MASTER_INFO')}
          >
            MASTER INFO
          </button>
        </div>
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
          .map((d) => (
            <div key={d.deviceId} className={`w-full flex items-center justify-between rounded p-2 hover:bg-gray-700 ${selectedId===d.deviceId?'bg-purple-700':'bg-gray-800'}`}>
              <button className="flex-1 text-left flex items-center gap-2" onClick={() => onSelect(d.deviceId)}>
                <span className={`w-3 h-3 rounded-full ${statuses[d.deviceId]==='online'?'bg-green-400':statuses[d.deviceId]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <FaStar className="text-yellow-400" size={12} />
                  <span className="text-xs text-yellow-300">{ratings[d.deviceId] ?? 5}</span>
                </span>
                <span className="font-semibold text-white flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {d.nama}
                </span>
                <span className="text-gray-400 ml-auto shrink-0 text-sm">({d.bk})</span>
              </button>
              <button title="Hapus" className="text-red-500 hover:text-red-400 px-2" onClick={() => setDeleteTarget({deviceId:d.deviceId,nama:d.nama})}>✕</button>
            </div>
          ))}
        {drivers.length === 0 && <p className="text-gray-500 text-sm">Belum ada driver</p>}
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
            await fetch(`http://193.70.34.25:20096/api/accounts/${deleteTarget.deviceId}`, { method: 'DELETE' });
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