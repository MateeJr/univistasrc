"use client";

import React, { useEffect, useState } from "react";

export interface FavoriteItem {
  id: string;
  from: string;
  fromCoord: string;
  to: string;
  toCoord: string;
  createdAt: string;
}

interface Props {
  onSelect: (fav: FavoriteItem) => void;
  refreshTrigger?: number; // change this value to force reload
}

const Favorite: React.FC<Props> = ({ onSelect, refreshTrigger }) => {
  const [list, setList] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        const data: FavoriteItem[] = await res.json();
        setList(data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  return (
    <div className="h-full rounded-lg bg-black text-white border border-purple-900 p-3 flex flex-col overflow-hidden">
      <div className="flex items-center justify-center mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-bold tracking-wider text-purple-300">FAVORITES</h3>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-purple-400">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Loading...</span>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-800/50 border border-gray-700 flex items-center justify-center mb-2">
            <span className="text-gray-500 text-xl">★</span>
          </div>
          <p className="text-center text-gray-500 text-xs">No favorites saved yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-purple-600">
          {list.map((f, index) => (
            <div
              key={f.id}
              className="group relative bg-gradient-to-r from-gray-900/80 to-gray-800/60 hover:from-gray-800/90 hover:to-gray-700/70 rounded-lg border border-gray-700/50 hover:border-purple-600/30 transition-all duration-200 overflow-hidden"
            >
              <button 
                onClick={() => onSelect(f)} 
                className="w-full p-2 text-left relative"
              >
                {/* Route indicator */}
                <div className="absolute left-1 top-1/2 transform -translate-y-1/2 flex flex-col items-center">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  <div className="w-0.5 h-3 bg-gradient-to-b from-green-400 to-red-400 my-0.5"></div>
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                </div>
                
                {/* Content */}
                <div className="ml-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-300 truncate max-w-[80%]" title={f.from}>
                      {f.from}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">#{index + 1}</span>
                  </div>
                  
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                  
                  <div className="text-xs font-medium text-red-300 truncate" title={f.to}>
                    {f.to}
                  </div>
                  
                  <div className="text-[10px] text-gray-400 truncate opacity-70">
                    {new Date(f.createdAt).toLocaleDateString('id-ID', { 
                      day: '2-digit', 
                      month: 'short' 
                    })}
                  </div>
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
              
              {/* Delete button */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm('Remove this favorite?')) return;
                  try {
                    await fetch(`/api/favorites/${f.id}`, { method: 'DELETE' });
                    setList(prev => prev.filter(item => item.id !== f.id));
                  } catch {}
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 hover:border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="Remove favorite"
              >
                <span className="text-red-400 text-[10px] font-bold">×</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorite; 