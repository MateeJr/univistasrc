"use client";

import React, { useEffect, useState } from "react";
// @ts-ignore
import mapboxgl from "mapbox-gl";
import { useMap } from "@/components/Home/MapContext";

interface DriverInfoProps { deviceId?: string }

const DriverInfo: React.FC<DriverInfoProps> = ({ deviceId }) => {
  const [info, setInfo] = useState<any>(null);
  const { map, setLastPos, styleIdx } = useMap();
  const markerRef = React.useRef<mapboxgl.Marker|null>(null);

  useEffect(() => {
    if (!deviceId || deviceId==='MASTER') return;
    let timer: any;

    const fetchInfo = async () => {
      try {
        const res = await fetch(`http://66.96.230.177:3000/api/accounts/${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          setInfo(data);
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
      el.src = '/truck.png';
      el.className = 'w-8 h-8';
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

  // Cleanup marker when deviceId changes to MASTER or undefined
  useEffect(() => {
    if (deviceId && deviceId !== 'MASTER') return; // nothing to do for valid driver

    // remove existing marker if any and clear info
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setInfo(null);
  }, [deviceId]);

  if (!deviceId || deviceId==='MASTER') {
    return <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col items-center justify-center">
      <h3 className="text-lg font-semibold mb-2 text-center w-full">DEVICE INFO</h3>
      Pilih driver
    </div>;
  }

  if (!info) {
    return <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col items-center justify-center"><h3 className="text-lg font-semibold mb-2 text-center w-full">DEVICE INFO</h3>Memuat...</div>;
  }

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 overflow-auto">
      <h3 className="text-lg font-semibold mb-2 text-center w-full">DEVICE INFO</h3>
      <h4 className="text-md font-semibold mb-4 text-center">{info.nama} ({info.bk})</h4>
      {info.track ? (
        <div className="space-y-1 text-sm">
          {(() => {
            const rows: { label: string; value: string | number; color?: string }[] = [];

            // GPS Status
            const gpsStatusColor = info.track.gpsStatus === 'Aktif' ? 'text-green-400' : info.track.gpsStatus === 'Tidak Aktif' ? 'text-red-400' : 'text-gray-400';
            rows.push({ label: 'GPS Status', value: info.track.gpsStatus, color: gpsStatusColor });

            // GPS Signal
            const sigColor = info.track.gpsSignal === 'Kuat' ? 'text-green-400' : info.track.gpsSignal === 'Normal' ? 'text-yellow-400' : info.track.gpsSignal === 'Lemah' ? 'text-red-400' : 'text-gray-400';
            rows.push({ label: 'GPS Signal', value: info.track.gpsSignal, color: sigColor });

            // Accuracy status
            const acc = info.track.accuracy;
            let accStatus = '-';
            let accColor = 'text-gray-400';
            if (acc != null) {
              if (acc <= 5) { accStatus = 'Sangat Akurat'; accColor = 'text-green-400'; }
              else if (acc <= 20) { accStatus = 'Akurat'; accColor = 'text-yellow-400'; }
              else { accStatus = 'Tidak Akurat'; accColor = 'text-red-400'; }
            }
            rows.push({ label: 'Accuracy', value: `${acc ?? '-'} m (${accStatus})`, color: accColor });

            rows.push({ label: 'Latitude', value: info.track.latitude?.toFixed?.(5) ?? '-' });
            rows.push({ label: 'Longitude', value: info.track.longitude?.toFixed?.(5) ?? '-' });

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
              rows.push({ label: 'Last Update', value: info.track.lastUpdated ?? '-', color: diffMinLast >= 10 ? 'text-red-400' : undefined });

            return rows;
          })().map((row) => (
            <div key={row.label} className="flex justify-between border-b border-gray-800 py-1">
              <span className="text-gray-400">{row.label}</span>
              <span className={`font-medium ${row.color ?? 'text-white'}`}>{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Belum ada data tracking</p>
      )}
    </div>
  );
};

export default DriverInfo; 