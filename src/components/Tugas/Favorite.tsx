"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((f) =>
      [f.from, f.to].some((v) => v?.toLowerCase().includes(q))
    );
  }, [list, query]);

  return (
    <div className="h-full rounded-xl bg-zinc-950/80 text-white border border-zinc-800 p-3 md:p-4 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-bold tracking-wider text-zinc-200">FAVORITES</h3>
        </div>
        <div className="relative w-1/2 min-w-[140px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search from/to..."
            className="w-full rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs px-7 py-1.5 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600/50 focus:border-transparent"
          />
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">⌕</span>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 hover:text-zinc-200"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
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
          <div className="w-12 h-12 rounded-full bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mb-2">
            <span className="text-zinc-500 text-xl">★</span>
          </div>
          <p className="text-center text-zinc-500 text-xs">No favorites saved yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
          {filtered.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
              No results for "{query}"
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-1">
              {filtered.map((f, index) => (
                <div
                  key={f.id}
                  className="relative rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition-colors duration-200 hover:border-purple-600/40"
                >
                  <button
                    onClick={() => onSelect(f)}
                    className="w-full p-2 pr-10 text-left"
                    title={`${f.from} → ${f.to}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex flex-col items-center">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                        <div className="w-0.5 h-3 bg-gradient-to-b from-green-400 to-red-400 my-0.5"></div>
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-green-300 truncate" title={f.from}>
                            {f.from}
                          </span>
                          <span className="shrink-0 text-[10px] text-zinc-500 font-mono">#{index + 1}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-red-300 truncate" title={f.to}>
                          {f.to}
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-400 truncate">
                          {new Date(f.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Remove this favorite?")) return;
                      try {
                        await fetch(`/api/favorites/${f.id}`, { method: "DELETE" });
                        setList((prev) => prev.filter((item) => item.id !== f.id));
                      } catch {}
                    }}
                    className="absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300"
                    title="Remove favorite"
                    aria-label="Remove favorite"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M9 3a1 1 0 0 0-1 1v1H5.5a.75.75 0 0 0 0 1.5h13a.75.75 0 0 0 0-1.5H16V4a1 1 0 0 0-1-1H9Zm-2 6.25a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-1.5 0v-8Zm4.25 0a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-1.5 0v-8Zm5.5 0a.75.75 0 0 0-1.5 0v8a.75.75 0 0 0 1.5 0v-8ZM10 5h4v1H10V5Zm-2 3h8l-.7 12.18A1.5 1.5 0 0 1 13.8 21H10.2a1.5 1.5 0 0 1-1.5-1.32L8 8Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Favorite; 