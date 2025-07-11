"use client";

import React, { useState, useEffect } from "react";
import { useMap } from "@/components/Home/MapContext";
import { FiPlus, FiMinus, FiNavigation, FiCompass, FiRotateCw, FiRotateCcw, FiMap, FiSun, FiMoon } from "react-icons/fi";

const IconBtn: React.FC<{ title: string; onClick: () => void; icon: React.ReactNode; active?: boolean }> = ({ title, onClick, icon, active }) => (
  <button
    onClick={onClick}
    className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
      active 
        ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/25 text-white' 
        : 'bg-slate-800/50 hover:bg-slate-700/70 text-slate-300 hover:text-white backdrop-blur-sm border border-slate-600/30 hover:border-purple-500/30'
    }`}
  >
    <span className="flex items-center justify-center">
      {icon}
    </span>
    <span className="text-xs font-medium">{title}</span>
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-blue-400/20 rounded-xl blur-sm"></div>
    )}
  </button>
);

interface ControllerProps { selected?: string; }

const Controller: React.FC<ControllerProps> = ({ selected }) => {
  const { map, lastPos, styleIdx, setStyleIdx } = useMap();
  const [navigate, setNavigate] = useState(false);

  // follow driver when navigate mode is on and lastPos updates
  useEffect(() => {
    if (!navigate || !map || !lastPos) return;
    map.flyTo({ center: lastPos, zoom: Math.max(map.getZoom(), 14) });
  }, [lastPos, navigate, map]);
  

  const zoomIn = () => map?.zoomIn();
  const zoomOut = () => map?.zoomOut();
  // legacy refocus removed
  const rotateLeft = () => map?.rotateTo(map.getBearing() - 15, { duration: 200 });
  const rotateRight = () => map?.rotateTo(map.getBearing() + 15, { duration: 200 });
  const togglePitch = () => {
    if (!map) return;
    const current = map.getPitch();
    map.easeTo({ pitch: current === 0 ? 60 : 0 });
  };

  const styles = [
    { id: 'streets', url: 'mapbox://styles/mapbox/streets-v12', label: 'Streets', icon: <FiMap className="w-4 h-4" /> },
    { id: 'satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite', icon: <FiSun className="w-4 h-4" /> },
    { id: 'dark', url: 'mapbox://styles/mapbox/dark-v11', label: 'Dark', icon: <FiMoon className="w-4 h-4" /> },
  ];
  const setStyle = (idx:number) => {
    if (!map) return;
    setStyleIdx(idx);
    map.setStyle(styles[idx].url);
  };

  return (
    <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6 text-white border border-purple-500/30 shadow-2xl backdrop-blur-xl flex flex-col gap-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl blur-sm"></div>
        <h3 className="relative text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent text-center">
          MAP CONTROLS
        </h3>
      </div>

      {/* Control Buttons Grid */}
      <div className="grid grid-cols-3 gap-3">
        <IconBtn title="Zoom In" onClick={zoomIn} icon={<FiPlus className="w-5 h-5" />} />
        <IconBtn title="Zoom Out" onClick={zoomOut} icon={<FiMinus className="w-5 h-5" />} />
        <IconBtn title="Rotate ↺" onClick={rotateLeft} icon={<FiRotateCcw className="w-5 h-5" />} />
        <IconBtn title="Rotate ↻" onClick={rotateRight} icon={<FiRotateCw className="w-5 h-5" />} />
        <IconBtn title="Tilt" onClick={togglePitch} icon={<FiCompass className="w-5 h-5" />} />
        {selected!=='MASTER' && (
          <IconBtn title="Navigate" onClick={() => setNavigate(!navigate)} icon={<FiNavigation className="w-5 h-5" />} active={navigate} />
        )}
      </div>

      {/* Map Style Selector */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 text-center">Map Style</h4>
        <div className="grid grid-cols-3 gap-2">
          {styles.map((s, idx) => (
            <button
              key={s.id}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                idx===styleIdx 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/25 text-white' 
                  : 'bg-slate-800/50 hover:bg-slate-700/70 text-slate-300 hover:text-white backdrop-blur-sm border border-slate-600/30 hover:border-purple-500/30'
              }`}
              onClick={() => setStyle(idx)}
            >
              <span className="flex items-center justify-center">
                {s.icon}
              </span>
              <span className="text-xs font-medium">{s.label}</span>
              {idx===styleIdx && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-blue-400/20 rounded-xl blur-sm"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Status */}
      {selected!=='MASTER' && navigate && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2">
            <FiNavigation className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold text-sm">Navigation Active</span>
          </div>
          <p className="text-emerald-300 text-xs text-center mt-1">Following selected driver</p>
        </div>
      )}
    </div>
  );
};

export default Controller; 