"use client";

import React, { useEffect, useState } from "react";
import { getTaskCompletionTime } from "../../utils/timeUtils";

interface Task { id:string; description:string; from:string; to:string; deadline:string; status?:string; photoReq?:string[]; startTimestamp?:string; endTimestamp?:string; completionTimeMs?:number; }

interface PreviewImage {
  path: string;
  label: string;
  uploadedAt: string;
}

interface Props { task: Task; onClose: ()=>void; }

const TaskImagesModal: React.FC<Props> = ({ task, onClose }) => {
  const [images, setImages] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
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
          setPreviewImages(data.previewImages || []);
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
    const normalizedReq = norm(req);

    // First check final images
    let img = images.find(fn=> {
      const fnParts = fn.split('_');
      if (fnParts.length >= 3) {
        const labelPart = fnParts.slice(2, -1).join('').toLowerCase();
        const normalizedLabel = labelPart.replace(/[^a-z0-9]/g,'');
        return normalizedLabel === normalizedReq;
      }
      return false;
    });

    let isPreview = false;
    // If not found in final images, check preview images and get the NEWEST one
    if (!img) {
      const matchingPreviews = previewImages.filter(pi => norm(pi.label) === normalizedReq);
      if (matchingPreviews.length > 0) {
        // Sort by uploadedAt timestamp and get the newest
        const newestPreview = matchingPreviews.sort((a, b) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )[0];
        img = newestPreview.path;
        isPreview = true;
      }
    }

    // Fallback to contains matching with newest logic
    if (!img) {
      img = images.find(fn=> norm(fn).includes(normalizedReq));
      if (!img) {
        const matchingPreviews = previewImages.filter(pi => norm(pi.label).includes(normalizedReq));
        if (matchingPreviews.length > 0) {
          // Sort by uploadedAt timestamp and get the newest
          const newestPreview = matchingPreviews.sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          )[0];
          img = newestPreview.path;
          isPreview = true;
        }
      }
    }

    return { label:req, file:img, isPreview };
  }) : [
    // For non-photoReq tasks, show all images but deduplicate previews by label (newest only)
    ...images.map(i=>({label:i.split('_').slice(2,-1).join(' ')||i, file:i, isPreview: false})), 
    ...getUniqueNewestPreviews(previewImages).map(pi=>({label:pi.label, file:pi.path, isPreview: true}))
  ];

  // Helper function to get only the newest preview image for each label
  function getUniqueNewestPreviews(previews: PreviewImage[]): PreviewImage[] {
    const labelMap = new Map<string, PreviewImage>();
    
    previews.forEach(preview => {
      const existing = labelMap.get(preview.label);
      if (!existing || new Date(preview.uploadedAt).getTime() > new Date(existing.uploadedAt).getTime()) {
        labelMap.set(preview.label, preview);
      }
    });
    
    return Array.from(labelMap.values());
  }

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
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
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

  const card = (label: string, file?: string, isPreview = false) => {
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
      <div key={label} className="flex flex-col bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-800 shadow-sm relative">
        {/* Preview badge */}
        {isPreview && (
          <div className="absolute top-2 left-2 z-10 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-400/60">
            PREVIEW
          </div>
        )}
        {file ? (
          <ImageWithLoader src={`/task-images/${file}`} alt={label} />
        ) : (
          <div className="w-full h-60 bg-zinc-900 flex items-center justify-center text-zinc-500 text-sm">Tidak ada gambar</div>
        )}
        <div className="p-2 border-t border-zinc-800 text-center text-xs text-zinc-200">
          <p className="truncate" title={label}>{label}</p>
          <p className="text-zinc-400 mt-1">{ts}</p>
          {isPreview && (
            <p className="text-amber-400 mt-1 font-semibold">Belum disubmit</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-6xl bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl max-h-full flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-zinc-900/70 backdrop-blur-md border-b border-zinc-800">
          <h4 className="text-lg md:text-xl font-semibold text-zinc-200">Detail Tugas & Foto – #{task.id}</h4>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300">✕</button>
        </div>

        {loading ? (
          <p className="text-center text-zinc-400 py-10 w-full">Memuat...</p>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Desktop layout: Left info panel, Right images grid */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {/* Left info panel */}
              <div className="w-1/3 border-r border-zinc-800 p-4 overflow-auto space-y-2">
                <p className="font-semibold text-zinc-200">{task.description}</p>
                <p className="text-sm text-zinc-400">Status: <span className={task.status==='SELESAI' || task.status==='TELAH DIKONIFIRMASI' ? 'text-emerald-400' : task.status?.startsWith('DIPROSES')?'text-blue-400': task.status==='DIBATALKAN'?'text-rose-400':'text-amber-300'}>{task.status||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-zinc-400">Berangkat: <span className="text-zinc-200">{task.from}</span></p>
                <p className="text-sm text-zinc-400">Destinasi: <span className="text-zinc-200">{task.to}</span></p>
                <p className="text-sm text-zinc-400">Deadline: <span className="text-rose-400">{task.deadline}</span></p>
                {task.status === 'SELESAI' && (() => {
                  const submittedAt = task.endTimestamp || null;
                  if(!submittedAt) return null;
                  const submitStr = new Date(submittedAt).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }).replace('.', ':');
                  return (
                    <p className="text-sm text-zinc-400">Tanggal diSubmit: <span className="text-blue-400">{submitStr}</span></p>
                  );
                })()}
                {task.status === 'SELESAI' && (() => {
                  const completionTime = getTaskCompletionTime(task);
                  return completionTime ? (
                    <p className="text-sm text-zinc-400">Waktu Penyelesaian: <span className="text-emerald-400">{completionTime}</span></p>
                  ) : null;
                })()}
                {photoReq.length>0 && (
                  <div className="mt-2">
                    <p className="text-sm text-zinc-400 mb-1">Syarat Foto:</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {photoReq.map((f,i)=>{
                        const mappedItem = mapped.find(m=>m.label===f);
                        const done = mappedItem?.file;
                        const isPreview = mappedItem?.isPreview;
                        return <li key={i} className={done ? (isPreview ? 'text-amber-400' : 'text-emerald-400') : 'text-zinc-200'}>
                          {done ? (isPreview ? '🔶 ' : '✔️ ') : ''}{f}
                          {isPreview && <span className="text-xs ml-1">(preview)</span>}
                        </li>;
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right images grid */}
              <div className="flex-1 overflow-auto p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
                {mapped.length===0 && <p className="col-span-full text-center text-zinc-500">Belum ada gambar</p>}
                {mapped.map(({label,file,isPreview})=> card(label,file,isPreview))}
              </div>
            </div>

            {/* Mobile layout: Images on top, Info on bottom */}
            <div className="flex md:hidden flex-col flex-1 overflow-hidden">
              {/* Top images grid */}
              <div className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 auto-rows-max">
                {mapped.length===0 && <p className="col-span-full text-center text-zinc-500">Belum ada gambar</p>}
                {mapped.map(({label,file,isPreview})=> card(label,file,isPreview))}
              </div>

              {/* Bottom info panel */}
              <div className="border-t border-zinc-800 p-4 space-y-2 bg-zinc-950/90">
                <p className="font-semibold text-zinc-200">{task.description}</p>
                <p className="text-sm text-zinc-400">Status: <span className={task.status==='SELESAI' || task.status==='TELAH DIKONIFIRMASI' ? 'text-emerald-400' : task.status?.startsWith('DIPROSES')?'text-blue-400': task.status==='DIBATALKAN'?'text-rose-400':'text-amber-300'}>{task.status||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-zinc-400">Berangkat: <span className="text-zinc-200">{task.from}</span></p>
                <p className="text-sm text-zinc-400">Destinasi: <span className="text-zinc-200">{task.to}</span></p>
                <p className="text-sm text-zinc-400">Deadline: <span className="text-rose-400">{task.deadline}</span></p>
                {task.status === 'SELESAI' && (() => {
                  const submittedAt = task.endTimestamp || null;
                  if(!submittedAt) return null;
                  const submitStr = new Date(submittedAt).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }).replace('.', ':');
                  return (
                    <p className="text-sm text-zinc-400">Tanggal diSubmit: <span className="text-blue-400">{submitStr}</span></p>
                  );
                })()}
                {task.status === 'SELESAI' && (() => {
                  const completionTime = getTaskCompletionTime(task);
                  return completionTime ? (
                    <p className="text-sm text-zinc-400">Waktu Penyelesaian: <span className="text-emerald-400">{completionTime}</span></p>
                  ) : null;
                })()}
                {photoReq.length>0 && (
                  <div className="mt-2">
                    <p className="text-sm text-zinc-400 mb-1">Syarat Foto:</p>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {photoReq.map((f,i)=>{
                        const mappedItem = mapped.find(m=>m.label===f);
                        const done = mappedItem?.file;
                        const isPreview = mappedItem?.isPreview;
                        return <li key={i} className={done ? (isPreview ? 'text-amber-400' : 'text-emerald-400') : 'text-zinc-200'}>
                          {done ? (isPreview ? '🔶 ' : '✔️ ') : ''}{f}
                          {isPreview && <span className="text-xs ml-1">(preview)</span>}
                        </li>;
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