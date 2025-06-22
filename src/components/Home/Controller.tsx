"use client";

import React, { useState, useEffect } from "react";
import { useMap } from "@/components/Home/MapContext";
import { FiPlus, FiMinus, FiNavigation, FiCompass, FiRotateCw, FiRotateCcw } from "react-icons/fi";

const IconBtn: React.FC<{ title: string; onClick: () => void; icon: React.ReactNode; active?: boolean }> = ({ title, onClick, icon, active }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center text-xs ${active ? 'text-white' : 'text-gray-300 hover:text-white'}` }
  >
    <span className={`flex items-center justify-center h-10 w-10 rounded-full mb-1 ${active ? 'bg-purple-700' : 'bg-gray-800 hover:bg-gray-700'}`}>
      {icon}
    </span>
    {title}
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
    { id: 'streets', url: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
    { id: 'satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite' },
    { id: 'dark', url: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
  ];
  const setStyle = (idx:number) => {
    if (!map) return;
    setStyleIdx(idx);
    map.setStyle(styles[idx].url);
  };

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col gap-3 overflow-y-auto">
      <h3 className="text-center font-semibold">CONTROLLER</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <IconBtn title="Zoom In" onClick={zoomIn} icon={<FiPlus />} />
        <IconBtn title="Zoom Out" onClick={zoomOut} icon={<FiMinus />} />
        <IconBtn title="Rotate ↺" onClick={rotateLeft} icon={<FiRotateCcw />} />
        <IconBtn title="Rotate ↻" onClick={rotateRight} icon={<FiRotateCw />} />
        <IconBtn title="Tilt" onClick={togglePitch} icon={<FiCompass />} />
        {selected!=='MASTER' && (
          <IconBtn title="Navigate" onClick={() => setNavigate(!navigate)} icon={<FiNavigation />} active={navigate} />
        )}
      </div>

      <div className="flex justify-between bg-gray-800 rounded overflow-hidden text-xs">
        {styles.map((s, idx) => (
          <button
            key={s.id}
            className={`flex-1 py-2 ${idx===styleIdx ? 'bg-purple-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            onClick={() => setStyle(idx)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Controller; 