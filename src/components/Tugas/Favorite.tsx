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
    <div className="h-full rounded-lg bg-black text-white border border-purple-900 p-2 flex flex-col overflow-hidden">
      <h3 className="text-lg font-semibold text-center mb-2">FAVORITE</h3>
      {loading ? (
        <p className="text-center text-gray-400 text-sm">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-center text-gray-500 text-sm">Belum ada favorite tersimpan</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-auto">
          {list.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className="text-left bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700"
            >
              <div className="font-semibold text-purple-400 truncate" title={f.from}>{f.from}</div>
              <div className="text-xs text-gray-400 truncate" title={f.fromCoord}>{f.fromCoord}</div>
              <div className="font-semibold text-purple-400 mt-1 truncate" title={f.to}>{f.to}</div>
              <div className="text-xs text-gray-400 truncate" title={f.toCoord}>{f.toCoord}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorite; 