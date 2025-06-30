'use client';
import React, { useEffect, useState } from 'react';

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

  return (
    <div className="h-full rounded-lg bg-zinc-900 p-6 text-white overflow-y-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari laporan..." className="px-2 py-1 rounded bg-zinc-800 text-white text-xs flex-grow md:flex-grow-0 md:w-1/2" />
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="px-2 py-1 rounded bg-zinc-800 text-white text-xs" />
        <select value={driverFilter} onChange={e=>setDriverFilter(e.target.value)} className="px-2 py-1 rounded bg-zinc-800 text-white text-xs">
          <option value="all">Semua Driver</option>
          {accounts.map(a => (<option key={a.deviceId} value={a.deviceId}>{a.nama}</option>))}
        </select>
        <button onClick={clearFilters} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Clear</button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-lg">Belum ada laporan</p>
        </div>
      ) : (
        filteredItems.map(item => (
        <div key={item.id} className="rounded-2xl border border-purple-600 bg-zinc-800 p-4 shadow-md">
          {(()=>{const info=getDriverInfo(item.deviceId);return (
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-xl text-purple-200">{info?.nama || item.deviceId}</h3>
              <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          );})()}
          <div className="flex items-center gap-2 mb-2">
            {item.type && (()=>{const jenis=jenisList.find(j=>j.name===item.type);const bg=jenis?.color||'#7239ea';return (
               <span className="text-xs px-2 py-0.5 rounded-md text-purple-100 whitespace-nowrap" style={{backgroundColor:bg,opacity:0.8}}>{item.type}</span>
             )})()}
            <p className="text-sm text-purple-400">{item.title}</p>
          </div>
          {(()=>{const info=getDriverInfo(item.deviceId);return (
            <p className="text-sm text-gray-300 mb-1">Driver: <span className="font-medium text-gray-100">{info?.nama ?? 'Unknown'}</span> <span className="ml-2 text-xs text-gray-400">{info?.bk}</span></p>
          );})()}
          <p className="text-xs text-gray-500 mb-1">Reported at: {new Date(item.createdAt).toLocaleString()}</p>
          <p className="text-sm mb-3">{item.description}</p>
          <div className="flex space-x-2 overflow-x-auto mb-4 pb-2">
            {item.images.map((img, idx) => (
              <img onClick={()=>setPreview(`/laporan-images/${item.deviceId}/${img}`)} key={idx} src={`/laporan-images/${item.deviceId}/${img}`} alt="laporan" className="h-24 w-24 object-cover rounded-lg border border-purple-700 cursor-pointer hover:opacity-80" />
            ))}
          </div>
          <div className="flex space-x-3">
            <button onClick={()=>handleDownload(item)} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm">Download</button>
            <button onClick={()=>handleDelete(item)} className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-sm">Delete</button>
          </div>
        </div>
        ))
      )}

      {/* Load More Button - only show if there's more data AND we have loaded some items */}
      {hasMore && items.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'LOAD MORE'}
          </button>
        </div>
      )}

      {/* Loading indicator for initial load */}
      {loading && items.length === 0 && (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-400">Loading laporan...</div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={()=>setPreview(null)}>
          <img src={preview} className="max-h-[90%] max-w-[90%] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default Laporan; 