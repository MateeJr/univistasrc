'use client';
import React, { useEffect, useRef, useState } from 'react';

interface LaporanItem { id: string; deviceId:string; title:string; type:string; description:string; images:string[]; createdAt:string; }
interface Jenis { name:string; color:string; }

const Laporan: React.FC = () => {
  const [items, setItems] = useState<LaporanItem[]>([]);
  interface Account { deviceId:string; nama:string; bk:string; }
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [search,setSearch]=useState('');
  const [dateFilter,setDateFilter]=useState('');
  const [driverFilter,setDriverFilter]=useState('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [offset, setOffset] = useState<number>(0);
  const LIMIT = 5;
  const [jenisList,setJenisList]=useState<Jenis[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const clearFilters=()=>{
    setSearch('');
    setDateFilter('');
    setDriverFilter('all');
    // Reset pagination when clearing filters
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();
  };

  // fetch laporan list and accounts periodically
  // fetch jenis list once and on event
  useEffect(()=>{
    const loadJenis=()=>{
      fetch('\/api/jenis-laporan').then(r=>r.json()).then(setJenisList).catch(console.error);
    };
    loadJenis();
    const handler=(e: any)=>{
      const {name,color}=e.detail||{}; if(!name)return;
      setJenisList(prev=>prev.map(j=>j.name===name?{...j,color}:j));
    };
    window.addEventListener('jenisColorUpdated',handler);
    return ()=>window.removeEventListener('jenisColorUpdated',handler);
  },[]);

  const buildApiUrl = (offset: number) => {
    const params = new URLSearchParams();
    params.append('limit', LIMIT.toString());
    params.append('offset', offset.toString());

    if (search.trim()) params.append('search', search.trim());
    if (dateFilter) params.append('date', dateFilter);
    if (driverFilter && driverFilter !== 'all') params.append('driver', driverFilter);

    return `/api/laporan?${params.toString()}`;
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(0));
      if (res.ok) {
        const response = await res.json();
        if (response.laporan) {
          setItems(response.laporan);
          setHasMore(response.hasMore);
          setOffset(LIMIT);
        } else {
          // Fallback for old API response format
          setItems(response.slice(0, LIMIT));
          setHasMore(response.length > LIMIT);
          setOffset(LIMIT);
        }
      }
    } catch (error) {
      console.error('Error loading laporan:', error);
    }
    setLoading(false);
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(offset));
      if (res.ok) {
        const response = await res.json();
        if (response.laporan) {
          setItems(prev => [...prev, ...response.laporan]);
          setHasMore(response.hasMore);
          setOffset(prev => prev + LIMIT);
        } else {
          // Fallback for old API response format
          const newItems = response.slice(offset, offset + LIMIT);
          setItems(prev => [...prev, ...newItems]);
          setHasMore(offset + LIMIT < response.length);
          setOffset(prev => prev + LIMIT);
        }
      }
    } catch (error) {
      console.error('Error loading more laporan:', error);
    }
    setLoading(false);
  };

  // Auto-load more when the sentinel becomes visible (infinite scroll)
  useEffect(() => {
    if (!hasMore || items.length === 0) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !loading) {
        loadMore();
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, hasMore, loading]);

  useEffect(() => {
    fetch('\/api/accounts').then(res => res.json()).then(setAccounts).catch(console.error);
  }, []);

  useEffect(() => {
    const refreshLaporan = async () => {
      if (loading || preview) return;
      try {
        const res = await fetch(buildApiUrl(0));
        if (res.ok) {
          const response = await res.json();
          const fetchedLaporan: LaporanItem[] = response.laporan || [];
          if (fetchedLaporan.length > 0) {
            setItems(prev => {
              const existingIds = new Set(prev.map(i => i.id));
              const newItems = fetchedLaporan.filter(i => !existingIds.has(i.id));
              if (newItems.length > 0) {
                setOffset(o => o + newItems.length);
                return [...newItems, ...prev];
              }
              return prev;
            });
          }
        }
      } catch (e) { console.error('Error refreshing laporan:', e); }
    };

    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadInitial();

    const intervalId = setInterval(refreshLaporan, 5000);
    return () => clearInterval(intervalId);
  }, [search, dateFilter, driverFilter]);

  const getDriverInfo = (id:string) => accounts.find(a=>a.deviceId===id);

  const handleDelete = (item:LaporanItem) => {
    if(!confirm('Hapus laporan ini?')) return;
    fetch(`/api/laporan/${item.deviceId}/${item.id}`, {method:'DELETE'})
      .then(res=>{
        if(!res.ok) throw new Error('Failed');
        setItems(prev => prev.filter(i => i.id !== item.id));
      })
      .catch(e=>alert('Gagal hapus: '+e));
  };

  const handleDownload = async (item:LaporanItem) => {
    for(const img of item.images){
      const url = `/laporan-images/${item.deviceId}/${img}`;
      try{
        const res = await fetch(url);
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = img;
        document.body.appendChild(link);
        link.click();
        setTimeout(()=>{
          URL.revokeObjectURL(link.href);
          link.remove();
        }, 100);
      }catch(e){
        console.error('download', e);
        alert('Gagal download '+img);
      }
    }
  };

  const filteredItems = items;

  const getInitials = (name?: string) => {
    if (!name) return 'DR';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase() || 'DR';
  };

  return (
    <div className="h-full rounded-xl bg-zinc-950/80 p-4 md:p-6 text-white overflow-y-auto">
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 backdrop-blur-md bg-zinc-950/70 border-b border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <span className="pointer-events-none absolute left-2 top-1.5 text-zinc-400">🔎</span>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Cari laporan, judul, deskripsi..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-600/50 text-sm"
            />
          </div>
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={e=>setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-600/50 text-sm"
            />
          </div>
          <select
            value={driverFilter}
            onChange={e=>setDriverFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-600/50 text-sm"
          >
            <option value="all">Semua Driver</option>
            {accounts.map(a => (<option key={a.deviceId} value={a.deviceId}>{a.nama}</option>))}
          </select>
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-8 max-w-md">
            <div className="text-4xl mb-3">🗂️</div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-1">Belum ada laporan</h3>
            <p className="text-sm text-zinc-400 mb-4">Coba ubah filter atau tunggu laporan baru masuk.</p>
            <button onClick={clearFilters} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium">Bersihkan Filter</button>
          </div>
        </div>
      )}

      {/* Skeletons for initial loading */}
      {loading && items.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {Array.from({length:6}).map((_,i)=> (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  <div className="h-3 bg-zinc-800 rounded w-1/3" />
                </div>
              </div>
              <div className="h-24 rounded-lg bg-zinc-800 mb-3" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded bg-zinc-800" />
                <div className="h-8 w-20 rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards Grid */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {filteredItems.map(item => {
            const info = getDriverInfo(item.deviceId);
            const jenis = item.type ? jenisList.find(j=>j.name===item.type) : undefined;
            const badgeBg = jenis?.color || '#7239ea';
            return (
              <div key={item.id} className="group rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition-colors p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 text-[11px] font-bold grid place-items-center">
                      {getInitials(info?.nama)}
                    </div>
                    <div className="leading-tight">
                      <div className="font-medium text-zinc-100">{info?.nama || item.deviceId}</div>
                      <div className="text-xs text-zinc-400">{info?.bk || 'No. BK tidak tersedia'}</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {item.type && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full text-white/95 shadow"
                      style={{ backgroundColor: badgeBg, opacity: 0.9 }}
                    >
                      {item.type}
                    </span>
                  )}
                  <p className="text-sm text-purple-300/90 font-medium truncate" title={item.title}>{item.title}</p>
                </div>

                <p className="text-sm text-zinc-200/90 mb-3 max-h-24 overflow-hidden">{item.description}</p>

                {item.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {item.images.slice(0,6).map((img, idx) => (
                      <img
                        onClick={()=>setPreview(`/laporan-images/${item.deviceId}/${img}`)}
                        key={idx}
                        src={`/laporan-images/${item.deviceId}/${img}`}
                        alt="laporan"
                        className="aspect-square object-cover rounded-md border border-zinc-800 cursor-pointer hover:opacity-85"
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-zinc-400">Reported • {new Date(item.createdAt).toLocaleString()}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={()=>handleDownload(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-xs font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3 14.5A1.5 1.5 0 0 1 4.5 13h2.879l-1.94 1.94a.75.75 0 1 0 1.06 1.06L9 14.56v2.94a.75.75 0 0 0 1.5 0V14.56l1.5 1.5 1.94-1.94H16.5A1.5 1.5 0 0 1 18 14.5v2A1.5 1.5 0 0 1 16.5 18h-12A1.5 1.5 0 0 1 3 16.5v-2Z"/><path d="M10.53 12.28a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V3a.75.75 0 0 1 1.5 0v6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3Z"/></svg>
                      Download
                    </button>
                    <button
                      onClick={()=>handleDelete(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-xs font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 1 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 1 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-8" />

      {/* Manual Load More as fallback */}
      {hasMore && items.length > 0 && (
        <div className="flex justify-center mt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium"
          >
            {loading ? 'Memuat...' : 'Load lebih banyak'}
          </button>
        </div>
      )}

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={()=>setPreview(null)}>
          <button
            onClick={()=>setPreview(null)}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-sm hover:bg-zinc-800"
          >
            Tutup
          </button>
          <img src={preview} className="max-h-[90%] max-w-[90%] rounded-2xl shadow-2xl border border-zinc-700" />
        </div>
      )}
    </div>
  );
};

export default Laporan; 