"use client";

import React, { useEffect, useState } from "react";
import { getTaskCompletionTime } from "../../utils/timeUtils";

interface Task { id:string; description:string; from:string; to:string; deadline:string; status?:string; photoReq?:string[]; startTimestamp?:string; endTimestamp?:string; completionTimeMs?:number; }

interface Props { task: Task; onClose: ()=>void; }

const TaskImagesModal: React.FC<Props> = ({ task, onClose }) => {
  const [images, setImages] = useState<string[]>([]);
  const [photoReq, setPhotoReq] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    const load = async ()=>{
      setLoading(true);
      try{
        const res = await fetch(`/api/tasks/${task.id}`);
        if(res.ok){
          const data = await res.json();
          setImages(data.images || []);
          setPhotoReq(data.photoReq || []);
        }
      }catch{}
      setLoading(false);
    };
    load();
  },[task.id]);

  // helper normalize
  const norm = (s:string)=> decodeURIComponent(s).toLowerCase().replace(/[^a-z0-9]/g,'');

  const mapped = photoReq.length ? photoReq.map(req=>{
    // More precise matching: find exact match first, then fallback to contains
    const normalizedReq = norm(req);

    // First try exact match (for cases like "fotosuratjalan" vs "fotosuratjalan2")
    let img = images.find(fn=> {
      const fnParts = fn.split('_');
      if (fnParts.length >= 3) {
        // Extract the label part from filename (remove timestamp, taskId, and extension)
        const labelPart = fnParts.slice(2, -1).join('').toLowerCase();
        const normalizedLabel = labelPart.replace(/[^a-z0-9]/g,'');
        return normalizedLabel === normalizedReq;
      }
      return false;
    });

    // If no exact match found, fallback to contains (for backward compatibility)
    if (!img) {
      img = images.find(fn=> norm(fn).includes(normalizedReq));
    }

    return { label:req, file:img };
  }) : images.map(i=>({label:i.split('_').slice(2,-1).join(' ')||i, file:i}));

  // helper to format timestamp - force Indonesia (WIB) timezone
  const fmtDate=(ms:number)=>{
    const d=new Date(ms);
    return d.toLocaleString('id-ID',{
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace('.',':');
  };

  // Image component that shows a spinner until the image has loaded
  const ImageWithLoader: React.FC<{src: string; alt: string}> = ({ src, alt }) => {
    const [loaded, setLoaded] = useState(false);
    return (
      <div className="relative w-full h-60">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            <svg
              className="w-10 h-10 text-purple-400 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`w-full h-60 object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  };

  const card = (label: string, file?: string) => {
    let ts = '-';
    if (file) {
      const fname = file.split('/').pop() || file;
      const parts = fname.split('_');
      const firstNum = parts.find(p => /^\d{13}$/.test(p));
      const lastPart = parts[parts.length - 1].split('.')[0];
      const numStr = firstNum || (/^\d{13}$/.test(lastPart) ? lastPart : null);
      if (numStr) ts = fmtDate(Number(numStr));
    }
    return (
      <div key={label} className="flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 shadow-sm">
        {file ? (
          <ImageWithLoader src={`/task-images/${file}`} alt={label} />
        ) : (
          <div className="w-full h-60 bg-zinc-800 flex items-center justify-center text-gray-500 text-sm">Tidak ada gambar</div>
        )}
        <div className="p-2 border-t border-zinc-800 text-center text-xs text-gray-200">
          <p>{label}</p>
          <p className="text-gray-400 mt-1">{ts}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-6xl bg-zinc-950 rounded-lg shadow-lg max-h-full flex flex-col">
        <button onClick={onClose} className="absolute top-3 right-4 text-xl text-gray-300 hover:text-white">✕</button>
        <h4 className="text-2xl font-semibold text-center text-purple-400 py-4 border-b border-purple-800">Detail Tugas &amp; Foto – #{task.id}</h4>

        {loading ? (
          <p className="text-center text-gray-400 py-10 w-full">Memuat...</p>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Desktop layout: Left info panel, Right images grid */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {/* Left info panel */}
              <div className="w-1/3 border-r border-purple-800 p-4 overflow-auto space-y-2">
                <p className="font-semibold text-purple-300">{task.description}</p>
                <p className="text-sm text-gray-400">Status: <span className={task.status==='SELESAI' || task.status==='TELAH DIKONIFIRMASI' ? 'text-green-400' : task.status?.startsWith('DIPROSES')?'text-blue-400': task.status==='DIBATALKAN'?'text-red-400':'text-yellow-300'}>{task.status||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-gray-400">Berangkat: <span className="text-gray-200">{task.from}</span></p>
                <p className="text-sm text-gray-400">Destinasi: <span className="text-gray-200">{task.to}</span></p>
                <p className="text-sm text-gray-400">Deadline: <span className="text-red-400">{task.deadline}</span></p>
                {task.status === 'SELESAI' && (() => {
                  const submittedAt = task.endTimestamp || null;
                  if(!submittedAt) return null;
                  const submitStr = new Date(submittedAt).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }).replace('.', ':');
                  return (
                    <p className="text-sm text-gray-400">Tanggal diSubmit: <span className="text-blue-400">{submitStr}</span></p>
                  );
                })()}
                {task.status === 'SELESAI' && (() => {
                  const completionTime = getTaskCompletionTime(task);
                  return completionTime ? (
                    <p className="text-sm text-gray-400">Waktu Penyelesaian: <span className="text-green-400">{completionTime}</span></p>
                  ) : null;
                })()}
                {photoReq.length>0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400 mb-1">Syarat Foto:</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {photoReq.map((f,i)=>{
                        const done = mapped.find(m=>m.label===f)?.file;
                        return <li key={i} className={done?'text-green-400':'text-gray-200'}>{done?'✔️ ':''}{f}</li>;
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right images grid */}
              <div className="flex-1 overflow-auto p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
                {mapped.length===0 && <p className="col-span-full text-center text-gray-500">Belum ada gambar</p>}
                {mapped.map(({label,file})=> card(label,file))}
              </div>
            </div>

            {/* Mobile layout: Images on top, Info on bottom */}
            <div className="flex md:hidden flex-col flex-1 overflow-hidden">
              {/* Top images grid */}
              <div className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 auto-rows-max">
                {mapped.length===0 && <p className="col-span-full text-center text-gray-500">Belum ada gambar</p>}
                {mapped.map(({label,file})=> card(label,file))}
              </div>

              {/* Bottom info panel */}
              <div className="border-t border-purple-800 p-4 space-y-2 bg-zinc-950">
                <p className="font-semibold text-purple-300">{task.description}</p>
                <p className="text-sm text-gray-400">Status: <span className={task.status==='SELESAI' || task.status==='TELAH DIKONIFIRMASI' ? 'text-green-400' : task.status?.startsWith('DIPROSES')?'text-blue-400': task.status==='DIBATALKAN'?'text-red-400':'text-yellow-300'}>{task.status||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-gray-400">Berangkat: <span className="text-gray-200">{task.from}</span></p>
                <p className="text-sm text-gray-400">Destinasi: <span className="text-gray-200">{task.to}</span></p>
                <p className="text-sm text-gray-400">Deadline: <span className="text-red-400">{task.deadline}</span></p>
                {task.status === 'SELESAI' && (() => {
                  const submittedAt = task.endTimestamp || null;
                  if(!submittedAt) return null;
                  const submitStr = new Date(submittedAt).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }).replace('.', ':');
                  return (
                    <p className="text-sm text-gray-400">Tanggal diSubmit: <span className="text-blue-400">{submitStr}</span></p>
                  );
                })()}
                {task.status === 'SELESAI' && (() => {
                  const completionTime = getTaskCompletionTime(task);
                  return completionTime ? (
                    <p className="text-sm text-gray-400">Waktu Penyelesaian: <span className="text-green-400">{completionTime}</span></p>
                  ) : null;
                })()}
                {photoReq.length>0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400 mb-1">Syarat Foto:</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {photoReq.map((f,i)=>{
                        const done = mapped.find(m=>m.label===f)?.file;
                        return <li key={i} className={done?'text-green-400':'text-gray-200'}>{done?'✔️ ':''}{f}</li>;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TaskImagesModal, (prev, next)=> prev.task.id===next.task.id); 