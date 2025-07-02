"use client";

import React, { useEffect, useState } from "react";
import { getIconPath, scaledSize } from "@/utils/iconUtil";
// @ts-ignore
import mapboxgl from "mapbox-gl";
import { useMap } from "@/components/Home/MapContext";

interface DriverInfoProps { deviceId?: string }

const iconLabels = ['Sepeda Motor','Mobil','Mobil Kecil','Truk','Truk Besar'];

const DriverInfo: React.FC<DriverInfoProps> = ({ deviceId }) => {
  const [info, setInfo] = useState<any>(null);
  const { map, setLastPos, styleIdx } = useMap();
  const markerRef = React.useRef<mapboxgl.Marker|null>(null);
  const [editingIcon,setEditingIcon] = useState(false);
  const [iconSelection,setIconSelection] = useState<string>('');

  useEffect(() => {
    if (!deviceId || deviceId==='MASTER') return;
    let timer: any;

    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/accounts/${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          setInfo(data);
          if(!editingIcon){
            setIconSelection(data.icon || '');
          }
        }
      } catch {}
    };

    fetchInfo();
    timer = setInterval(fetchInfo, 5000);

    return () => clearInterval(timer);
  }, [deviceId]);

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
    return <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col items-center justify-center">
      <h3 className="text-lg font-semibold mb-2 text-center w-full">INFO PERANGKAT</h3>
      Pilih driver
    </div>;
  }

  if (!info) {
    return <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col items-center justify-center"><h3 className="text-lg font-semibold mb-2 text-center w-full">INFO PERANGKAT</h3>Memuat...</div>;
  }

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center w-full">INFO PERANGKAT</h3>
      <h4 className="text-md font-semibold mb-4 text-center">
        <span className="inline-block px-3 py-1 rounded-lg bg-red-600/40 backdrop-blur-sm">{info.nama} ({info.bk})</span>
      </h4>
      {info.track ? (
        <div className="space-y-1 text-sm">
          {(() => {
            const rows: { label: string; value: string | number; color?: string }[] = [];

            // GPS Status
            const gpsStatusColor = info.track.gpsStatus === 'Aktif' ? 'text-green-400' : info.track.gpsStatus === 'Tidak Aktif' ? 'text-red-400' : 'text-gray-400';
            rows.push({ label: 'Status GPS', value: info.track.gpsStatus, color: gpsStatusColor });
            rows.push({ label: 'ID Perangkat', value: deviceId });
            

            // GPS Signal
            const sigColor = info.track.gpsSignal === 'Kuat' ? 'text-green-400' : info.track.gpsSignal === 'Normal' ? 'text-yellow-400' : info.track.gpsSignal === 'Lemah' ? 'text-red-400' : 'text-gray-400';
            rows.push({ label: 'Sinyal GPS', value: info.track.gpsSignal, color: sigColor });

            // Accuracy status
            const acc = info.track.accuracy;
            let accStatus = '-';
            let accColor = 'text-gray-400';
            if (acc != null) {
              if (acc <= 5) { accStatus = 'Sangat Akurat'; accColor = 'text-green-400'; }
              else if (acc <= 20) { accStatus = 'Akurat'; accColor = 'text-yellow-400'; }
              else { accStatus = 'Tidak Akurat'; accColor = 'text-red-400'; }
            }
            rows.push({ label: 'Akurasi', value: `${acc ?? '-'} m (${accStatus})`, color: accColor });

            rows.push({ label: 'Lintang', value: info.track.latitude?.toFixed?.(5) ?? '-' });
            rows.push({ label: 'Bujur', value: info.track.longitude?.toFixed?.(5) ?? '-' });

            // Battery
            const batt = info.track.batteryPct ?? 0;
            let battColor = 'text-red-400';
            if (batt > 75) battColor = 'text-green-400';
            else if (batt > 30) battColor = 'text-yellow-400';
            rows.push({ label: 'Baterai', value: `${batt}% ${info.track.charging ? '(charging)' : ''}`, color: battColor });

            // Ping
            const ping = info.track.pingMs;
            let pingStatus = '-';
            let pingColor = 'text-gray-400';
            if (ping != null) {
              if (ping < 50) { pingStatus = 'Kuat'; pingColor = 'text-green-400'; }
              else if (ping < 100) { pingStatus = 'Normal'; pingColor = 'text-yellow-400'; }
              else if (ping < 200) { pingStatus = 'Lemah'; pingColor = 'text-orange-400'; }
              else if (ping < 400) { pingStatus = 'Buruk'; pingColor = 'text-red-400'; }
              else { pingStatus = 'Sangat Buruk'; pingColor = 'text-red-600'; }
            }
            rows.push({ label: 'Ping', value: `${ping ?? '-'} ms (${pingStatus})`, color: pingColor });

            // Last update – red if driver considered offline (>10min)
            const lastMs = info.track?.timestampMs ?? (info.track?.lastUpdated ? Date.parse(info.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
            const diffMinLast = lastMs ? (Date.now() - lastMs) / 60000 : Infinity;

            // Format using browser's local timezone
            const lastStr = lastMs ? new Date(lastMs).toLocaleString('id-ID', {
              hour12: false,
            }) : '-';

            rows.push({ label: 'Data Terakhir', value: lastStr, color: diffMinLast >= 10 ? 'text-red-400' : undefined });

            return rows;
          })().map((row) => (
            <div key={row.label} className="flex justify-between border-b border-gray-800 py-1">
              <span className="text-gray-400">{row.label}</span>
              <span className={`font-medium ${row.color ?? 'text-white'}`}>{row.value}</span>
            </div>
          ))}

          {/* Jenis Kendaraan row */}
          <div className="flex justify-between border-b border-gray-800 py-1">
            <span className="text-gray-400">Jenis Kendaraan</span>
            {editingIcon ? (
              <span className="space-x-1">
                <select value={iconSelection} onChange={e=>setIconSelection(e.target.value)} className="bg-gray-700 text-white text-xs px-1 py-0.5 rounded">
                  <option value="">-</option>
                  {iconLabels.map(label=> <option key={label} value={label}>{label}</option>)}
                </select>
                <button onClick={async ()=>{
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
                }} className="text-green-400 text-xs">Simpan</button>
                <button onClick={()=>{setEditingIcon(false); setIconSelection(info.icon||'');}} className="text-red-400 text-xs">Batal</button>
              </span>
            ):(
              <span className="font-medium">
                {info.icon || '-'}
                <button onClick={()=>setEditingIcon(true)} className="text-blue-400 text-xs ml-2 underline">Ganti</button>
              </span>
            )}
          </div>

          {/* Warning message when last update is outdated (red) */}
          {(() => {
            const lastMs = info.track?.timestampMs ?? (info.track?.lastUpdated ? Date.parse(info.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
            const diffMinLast = lastMs ? (Date.now() - lastMs) / 60000 : Infinity;

            if (diffMinLast >= 10) {
              return (
                <div className="mt-3 p-2 bg-red-900/30 border border-red-500 rounded text-center">
                  <span className="text-red-400 font-semibold text-sm">TIDAK TERHUBUNG</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Belum ada data tracking</p>
      )}
    </div>
  );
};

export default DriverInfo; 