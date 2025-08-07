'use client';
import React, { useEffect, useState } from 'react';
import { FaStar, FaTrophy, FaPlus, FaMinus, FaSortAmountUp, FaSortAmountDown } from 'react-icons/fa';

interface Account {
  deviceId: string;
  nama: string;
  bk: string;
}

const Score: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [ascending, setAscending] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('\/api/accounts').then(r => r.json()),
      fetch('\/api/score').then(r => r.json()).catch(() => ({}))
    ]).then(([accs, scores]) => {
      setAccounts(accs);
      setRatings(scores);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const getRating = (id: string) => ratings[id] ?? 5;

  const sorted = [...accounts].sort((a, b) => {
    const diff = getRating(b.deviceId) - getRating(a.deviceId);
    if (diff !== 0) return ascending ? -diff : diff;
    return a.nama.localeCompare(b.nama);
  });

  const handleRatingChange = (deviceId: string, delta: number) => {
    const currentRating = getRating(deviceId);
    const newRating = Math.max(1, Math.min(5, currentRating + delta));
    
    fetch(`/api/score/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: newRating })
    })
    .then(r => {
      if (r.ok) {
        setRatings(prev => ({ ...prev, [deviceId]: newRating }));
        setAdjust(prev => ({ ...prev, [deviceId]: '' }));
      }
    })
    .catch(console.error);
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-yellow-600';
    return 'text-gray-500';
  };

  return (
    <div className="h-full rounded-xl bg-zinc-950/80 p-6 text-white flex flex-col gap-6 overflow-hidden border border-zinc-800">
      <h3 className="text-2xl font-bold text-center text-zinc-200">
        LEADERBOARD DRIVER
      </h3>
      
      {loading ? (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-zinc-500"></div>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-lg text-zinc-500 mt-8">Tidak ada data driver</p>
      ) : (
        <>
          <div className="flex justify-end mb-2">
            <button
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 text-sm"
              onClick={() => setAscending(p => !p)}
            >
              {ascending ? <FaSortAmountUp className="text-yellow-400" /> : <FaSortAmountDown className="text-yellow-400" />}
              {ascending ? 'Low → High' : 'High → Low'}
            </button>
          </div>
          <div className="overflow-y-auto w-full -mr-4 pr-4">
          <table className="min-w-full text-base">
            <thead className="sticky top-0 bg-zinc-950/80 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-300">#</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-300">Nama Driver</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-300">Rating</th>
                <th className="px-4 py-3 text-center font-semibold text-zinc-300">Atur Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sorted.map((acc, idx) => (
                <tr key={acc.deviceId} className="hover:bg-zinc-900/60 transition-colors duration-200">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-xl w-8 text-center ${idx > 2 ? 'text-zinc-500' : ''}`}>
                        {idx < 3 ? <FaTrophy className={getRankColor(idx + 1)} /> : idx + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap font-medium">{acc.nama}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <FaStar key={i} className={i < getRating(acc.deviceId) ? 'text-yellow-400' : 'text-zinc-600'} />
                      ))}
                      <span className="ml-2 text-zinc-400 text-sm">({getRating(acc.deviceId).toFixed(1)})</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        className="p-2 bg-zinc-800 hover:bg-rose-600 rounded-full text-white transition-colors duration-200 disabled:opacity-50"
                        onClick={() => handleRatingChange(acc.deviceId, -Number(adjust[acc.deviceId] || 0.1))}
                        disabled={getRating(acc.deviceId) <= 1}
                      >
                        <FaMinus size={12} />
                      </button>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={adjust[acc.deviceId] || '0.1'} 
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.]/g, '');
                          if(parseFloat(v) >= 0) setAdjust(prev => ({ ...prev, [acc.deviceId]: v }));
                        }} 
                        className="w-20 px-2 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-center font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600/40" 
                      />
                      <button 
                        className="p-2 bg-zinc-800 hover:bg-emerald-600 rounded-full text-white transition-colors duration-200 disabled:opacity-50"
                        onClick={() => handleRatingChange(acc.deviceId, Number(adjust[acc.deviceId] || 0.1))}
                        disabled={getRating(acc.deviceId) >= 5}
                      >
                        <FaPlus size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
};

export default Score; 