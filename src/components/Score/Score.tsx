'use client';
import React, { useEffect, useState } from 'react';
import { FaStar } from 'react-icons/fa';

interface Account { deviceId:string; nama:string; bk:string; }

const Score: React.FC = () => {
  const [accounts,setAccounts]=useState<Account[]>([]);
  
  const [ratings,setRatings]=useState<Record<string,number>>({});
  const [adjust,setAdjust]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);

  const fetchRatings=()=>{
    fetch('http://193.70.34.25:20096/api/score').then(r=>r.json()).then(setRatings).catch(console.error);
  };
  
  useEffect(()=>{
    Promise.all([
      fetch('http://193.70.34.25:20096/api/accounts').then(r=>r.json()),
      fetch('http://193.70.34.25:20096/api/score').then(r=>r.json()).catch(()=>({}))
    ]).then(([accs,scores])=>{ setAccounts(accs); setRatings(scores); }).catch(console.error).finally(()=>setLoading(false));
  },[]);
  const getRating=(id:string)=> ratings[id]??5;
  const sorted = [...accounts].sort((a,b)=>{
    const diff = getRating(b.deviceId) - getRating(a.deviceId);
    if(diff!==0) return diff;
    return a.nama.localeCompare(b.nama);
  });
  return (
    <div className="h-full rounded-lg bg-black p-6 text-white border border-purple-900 flex flex-col gap-4 overflow-auto">
      <h3 className="text-lg font-semibold text-center">LEADERBOARD DRIVER</h3>
      {loading ? <p className="text-center text-sm text-gray-400">Loading...</p> : (
        sorted.length===0 ? <p className="text-center text-sm text-gray-500">Tidak ada data driver</p> : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-purple-700 text-sm">
              <thead className="bg-zinc-800/80">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Nama Driver</th>
                  <th className="px-4 py-2 text-left">Rating</th>
                  <th className="px-4 py-2 text-left">Atur Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-800">
                {sorted.map((acc,idx)=>(
                  <tr key={acc.deviceId} className={idx%2? 'bg-zinc-800/50':''}>
                    <td className="px-4 py-2">{idx+1}</td>
                    <td className="px-4 py-2 font-medium">{acc.nama}</td>
                    <td className="px-4 py-2">
                      {[1,2,3,4,5].map(i=> <FaStar key={i} className={i<=getRating(acc.deviceId)?'text-yellow-400 inline':'text-gray-600 inline'} />)}
                      <span className="ml-1">{getRating(acc.deviceId)}</span>
                    </td>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <input type="number" step="0.1" value={adjust[acc.deviceId]??''} onChange={e=>{
                        const v=e.target.value.replace(/[^0-9.]/g,'');
                        setAdjust(prev=>({...prev,[acc.deviceId]:v}));
                      }} className="w-16 px-1 py-0.5 rounded bg-zinc-800 text-center" />
                      <button className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded" onClick={()=>{
                        const delta=Number(adjust[acc.deviceId]||0); if(!delta) return;
                        const newRating=Math.min(5, getRating(acc.deviceId)+delta);
                        fetch(`http://193.70.34.25:20096/api/score/${acc.deviceId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:newRating})})
                          .then(r=>{if(r.ok){ setRatings(prev=>({...prev,[acc.deviceId]:newRating})); setAdjust(prev=>({...prev,[acc.deviceId]:''})); }})
                          .catch(console.error);
                      }}>+</button>
                      <button className="px-2 py-1 bg-rose-600 hover:bg-rose-700 rounded" onClick={()=>{
                        const delta=Number(adjust[acc.deviceId]||0); if(!delta) return;
                        const newRating=Math.max(1, getRating(acc.deviceId)-delta);
                        fetch(`http://193.70.34.25:20096/api/score/${acc.deviceId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:newRating})})
                          .then(r=>{if(r.ok){ setRatings(prev=>({...prev,[acc.deviceId]:newRating})); setAdjust(prev=>({...prev,[acc.deviceId]:''})); }})
                          .catch(console.error);
                      }}>-</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default Score; 