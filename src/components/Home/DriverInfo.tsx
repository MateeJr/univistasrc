"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getIconPath, scaledSize } from "@/utils/iconUtil";
// @ts-ignore
import mapboxgl from "mapbox-gl";
import { useMap } from "@/components/Home/MapContext";
import SwitchDeviceModal from './SwitchDeviceModal';
import { FiSettings, FiWifi, FiWifiOff, FiBatteryCharging, FiBattery, FiMapPin, FiClock, FiActivity, FiSmartphone, FiTrash2 } from "react-icons/fi";
import { HiStatusOnline, HiStatusOffline } from "react-icons/hi";

interface DriverInfoProps { deviceId?: string }

const iconLabels = ['Sepeda Motor','Mobil','Mobil Kecil','Truk','Truk Besar'];

const DriverInfo: React.FC<DriverInfoProps> = ({ deviceId }) => {
  const [info, setInfo] = useState<any>(null);
  const { map, setLastPos, styleIdx } = useMap();
  const markerRef = React.useRef<mapboxgl.Marker|null>(null);
  const [editingIcon,setEditingIcon] = useState(false);
  const [iconSelection,setIconSelection] = useState<string>('');
  const [isSwitchModalOpen, setSwitchModalOpen] = useState(false);
  const [spoofedBy, setSpoofedBy] = useState<string[]>([]);

  const fetchDriverData = useCallback(async () => {
    if (!deviceId || deviceId === 'MASTER') return;
    try {
      // Fetch main driver info
      const res = await fetch(`/api/accounts/${deviceId}`);
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
        if (!editingIcon) {
          setIconSelection(data.icon || '');
        }
      }

      // Fetch spoofing info
      const spoofRes = await fetch(`/api/get-spoof/${deviceId}`);
      if (spoofRes.ok) {
        const spoofData = await spoofRes.json();
        setSpoofedBy(spoofData.spoofs || []);
      }

    } catch (e) {
      console.error("Failed to fetch driver data", e);
    }
  }, [deviceId, editingIcon]);


  useEffect(() => {
    if (!deviceId || deviceId==='MASTER') return;
    let timer: any;

    fetchDriverData();
    timer = setInterval(fetchDriverData, 5000);

    return () => clearInterval(timer);
  }, [deviceId, fetchDriverData]);

  // update marker when location changes
  useEffect(() => {
    if (!map) return;
    if (!info?.track?.latitude || !info.track.longitude) return;
    const lngLat: [number, number] = [info.track.longitude, info.track.latitude];

    if (!markerRef.current) {
      const el = document.createElement('img');
      el.src = getIconPath(info.icon);
      const size = scaledSize(32, info.icon);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    setLastPos(lngLat);

    // adjust icon filter for dark theme (idx 2)
    if (markerRef.current?.getElement()) {
      (markerRef.current.getElement() as HTMLElement).style.filter = styleIdx === 2 ? 'invert(1)' : 'none';
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [info, map, setLastPos, styleIdx]);

  // Cleanup marker whenever the selected driver changes. This guarantees that
  // the previous driver's marker (if any) is always removed, eliminating the
  // possibility of duplicate truck icons appearing when switching between
  // drivers or returning to the MASTER view.
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Clear the cached info so that a fresh fetch will run for the new deviceId.
    setInfo(null);
  }, [deviceId]);

  if (!deviceId || deviceId==='MASTER') {
    return (
      <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6 text-white border border-purple-500/30 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl blur-sm"></div>
          <h3 className="relative text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent text-center">
            INFO PERANGKAT
          </h3>
        </div>
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 flex items-center justify-center">
          <FiSmartphone className="w-8 h-8 text-purple-400" />
        </div>
        <p className="text-slate-400 text-lg">Pilih driver</p>
        <p className="text-slate-500 text-sm mt-1">Pilih dari daftar driver untuk melihat informasi perangkat</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6 text-white border border-purple-500/30 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl blur-sm"></div>
          <h3 className="relative text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent text-center">
            INFO PERANGKAT
          </h3>
        </div>
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-r from-purple-600/30 to-blue-600/30 flex items-center justify-center animate-pulse">
          <FiActivity className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
        <p className="text-slate-400 text-lg">Memuat...</p>
      </div>
    );
  }

  const handleClearSpoof = async () => {
    if (!deviceId) return;
    if (confirm('Anda yakin ingin menghapus penggantian perangkat untuk driver ini?')) {
        try {
            const res = await fetch('/api/clear-spoof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId }),
            });
            if (!res.ok) throw new Error('Failed to clear spoof.');
            alert('Penggantian perangkat berhasil dihapus.');
            fetchDriverData(); // Refresh data
        } catch (err) {
            alert(err);
        }
    }
  };

  const lastMs = info.track?.timestampMs ?? (info.track?.lastUpdated ? Date.parse(info.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
  const diffMinLast = lastMs ? (Date.now() - lastMs) / 60000 : Infinity;
  const isOffline = diffMinLast >= 10;
  const effectiveGpsStatus = isOffline ? 'Tidak Aktif' : info.track.gpsStatus;

  return (
    <>
    <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6 text-white border border-purple-500/30 shadow-2xl backdrop-blur-xl overflow-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-purple-600">
      {/* Header */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl blur-sm"></div>
        <div className="relative">
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent text-center mb-3">
            INFO PERANGKAT
          </h3>
          <div className="text-center">
            <span className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-red-600/40 to-red-500/40 backdrop-blur-sm border border-red-500/30 font-semibold">
              {info.nama} ({info.bk})
            </span>
          </div>
        </div>
      </div>
      
      {info.track ? (
        <div className="space-y-4">
          {isOffline && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/40 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2">
                <HiStatusOffline className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-bold text-lg">TERPUTUS</span>
              </div>
              <p className="text-red-300 text-sm text-center mt-1">Perangkat telah offline lebih dari 10 menit</p>
            </div>
          )}
          {/* Status Cards Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* GPS Status */}
            <div className={`p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
              effectiveGpsStatus === 'Aktif' 
                ? 'bg-emerald-500/20 border-emerald-500/30' 
                : 'bg-red-500/20 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {effectiveGpsStatus === 'Aktif' ? (
                  <HiStatusOnline className="w-4 h-4 text-emerald-400" />
                ) : (
                  <HiStatusOffline className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs text-slate-400">Status GPS</span>
              </div>
              <span className={`font-semibold ${
                effectiveGpsStatus === 'Aktif' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {effectiveGpsStatus}
              </span>
            </div>

            {/* Battery */}
            <div className={`p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
              (info.track.batteryPct ?? 0) > 75 
                ? 'bg-emerald-500/20 border-emerald-500/30' 
                : (info.track.batteryPct ?? 0) > 30 
                  ? 'bg-yellow-500/20 border-yellow-500/30'
                  : (info.track.batteryPct ?? 0) > 10 
                    ? 'bg-orange-500/20 border-orange-500/30'
                    : 'bg-red-500/20 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {info.track.charging ? (
                  <FiBatteryCharging className="w-4 h-4 text-blue-400" />
                ) : (
                  <FiBattery className="w-4 h-4" />
                )}
                <span className="text-xs text-slate-400">Baterai</span>
              </div>
              <span className={`font-semibold ${
                (info.track.batteryPct ?? 0) > 75 
                  ? 'text-emerald-400' 
                  : (info.track.batteryPct ?? 0) > 30 
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }`}>
                {info.track.batteryPct ?? 0}%{info.track.charging ? ' ⚡' : ''}
              </span>
            </div>
          </div>

          {/* Detailed Information */}
          <div className="space-y-2">
            {(() => {
              const rows: { label: string; value: string | number; color?: string; icon?: React.ReactNode }[] = [];

              rows.push({ 
                label: 'ID Perangkat', 
                value: deviceId, 
                icon: <FiSmartphone className="w-4 h-4" /> 
              });
              
              // GPS Signal
              const sigColor = info.track.gpsSignal === 'Kuat' ? 'text-emerald-400' : info.track.gpsSignal === 'Normal' ? 'text-yellow-400' : info.track.gpsSignal === 'Lemah' ? 'text-red-400' : 'text-slate-400';
              rows.push({ 
                label: 'Sinyal GPS', 
                value: info.track.gpsSignal, 
                color: sigColor,
                icon: info.track.gpsSignal === 'Kuat' ? <FiWifi className="w-4 h-4" /> : <FiWifiOff className="w-4 h-4" />
              });

              // Accuracy status
              const acc = info.track.accuracy;
              let accStatus = '-';
              let accColor = 'text-slate-400';
              if (acc != null) {
                if (acc <= 5) { accStatus = 'Sangat Akurat'; accColor = 'text-emerald-400'; }
                else if (acc <= 20) { accStatus = 'Akurat'; accColor = 'text-yellow-400'; }
                else { accStatus = 'Tidak Akurat'; accColor = 'text-red-400'; }
              }
              rows.push({ 
                label: 'Akurasi', 
                value: `${acc ?? '-'} m (${accStatus})`, 
                color: accColor,
                icon: <FiMapPin className="w-4 h-4" />
              });

              rows.push({ 
                label: 'Lintang', 
                value: info.track.latitude?.toFixed?.(5) ?? '-',
                icon: <FiMapPin className="w-4 h-4" />
              });
              
              rows.push({ 
                label: 'Bujur', 
                value: info.track.longitude?.toFixed?.(5) ?? '-',
                icon: <FiMapPin className="w-4 h-4" />
              });

              // Ping
              const ping = info.track.pingMs;
              let pingStatus = '-';
              let pingColor = 'text-slate-400';
              if (ping != null) {
                if (ping < 50) { pingStatus = 'Sangat Baik'; pingColor = 'text-emerald-400'; }
                else if (ping < 100) { pingStatus = 'Baik'; pingColor = 'text-yellow-400'; }
                else if (ping < 200) { pingStatus = 'Cukup'; pingColor = 'text-orange-400'; }
                else if (ping < 400) { pingStatus = 'Buruk'; pingColor = 'text-red-400'; }
                else { pingStatus = 'Sangat Buruk'; pingColor = 'text-red-600'; }
              }
              rows.push({ 
                label: 'Ping Jaringan', 
                value: `${ping ?? '-'} ms (${pingStatus})`, 
                color: pingColor,
                icon: <FiActivity className="w-4 h-4" />
              });

              // Spoofed Device Info
              if (spoofedBy.length > 0) {
                rows.push({ 
                  label: 'Digantikan oleh', 
                  value: '',
                  icon: <FiSettings className="w-4 h-4" />
                });
                spoofedBy.forEach(id => {
                  rows.push({ 
                    label: `Perangkat`, 
                    value: id, 
                    color: 'text-yellow-400',
                    icon: <FiSmartphone className="w-4 h-4" />
                  });
                })
              }

              // Last update – red if driver considered offline (>10min)
              const lastStr = lastMs ? new Date(lastMs).toLocaleString('id-ID', {
                hour12: false,
              }) : '-';

              rows.push({ 
                label: 'Update Terakhir', 
                value: lastStr, 
                color: diffMinLast >= 10 ? 'text-red-400' : undefined,
                icon: <FiClock className="w-4 h-4" />
              });

              return rows;
            })().map((row) => (
              <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-purple-400">{row.icon}</span>
                  <span className="text-slate-400 font-medium">{row.label}</span>
                </div>
                <span className={`font-semibold text-right flex-shrink-0 ${row.color ?? 'text-white'}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => setSwitchModalOpen(true)} 
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25 font-semibold"
            >
              <FiSettings className="w-4 h-4" />
              Ganti Perangkat
            </button>
            {spoofedBy.length > 0 && (
              <button 
                onClick={handleClearSpoof} 
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25 font-semibold"
              >
                <FiTrash2 className="w-4 h-4" />
                Hapus
              </button>
            )}
          </div>

          {/* Vehicle Type Section */}
          <div className="p-4 rounded-xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiSettings className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400 font-medium">Jenis Kendaraan</span>
              </div>
              {editingIcon ? (
                <div className="flex items-center gap-2">
                  <select 
                    value={iconSelection} 
                    onChange={e=>setIconSelection(e.target.value)} 
                    className="bg-slate-700 text-white text-sm px-3 py-1 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-</option>
                    {iconLabels.map(label=> <option key={label} value={label}>{label}</option>)}
                  </select>
                  <button 
                    onClick={async ()=>{
                      try{
                        const res = await fetch(`/api/accounts/${deviceId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({icon:iconSelection})});
                        if(res.ok){
                          setInfo((prev:any)=>({...prev, icon: iconSelection}));
                          if(markerRef.current?.getElement()){
                            const elImg = markerRef.current.getElement() as HTMLImageElement;
                            elImg.src = getIconPath(iconSelection);
                            const newSize = scaledSize(32, iconSelection);
                            elImg.style.width = `${newSize}px`;
                            elImg.style.height = `${newSize}px`;
                          }
                          setEditingIcon(false);
                        }
                      }catch{}
                    }} 
                    className="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-all duration-200 text-sm font-medium"
                  >
                    Simpan
                  </button>
                  <button 
                    onClick={()=>{setEditingIcon(false); setIconSelection(info.icon||'');}} 
                    className="px-3 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all duration-200 text-sm font-medium"
                  >
                    Batal
                  </button>
                </div>
              ):(
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{info.icon || '-'}</span>
                  <button 
                    onClick={()=>setEditingIcon(true)} 
                    className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all duration-200 text-sm font-medium"
                  >
                    Ubah
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 flex items-center justify-center">
            <FiMapPin className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-slate-400 text-lg">Tidak ada data tracking</p>
          <p className="text-slate-500 text-sm mt-1">Menunggu perangkat mengirim data lokasi</p>
        </div>
      )}
    </div>
    <SwitchDeviceModal
        isOpen={isSwitchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
        driver={info ? { deviceId, nama: info.nama } : null}
        onSwitch={fetchDriverData}
      />
    </>
  );
};

export default DriverInfo; 