import React, { useEffect, useRef, useState } from "react";
import { getIconPath, scaledSize } from "@/utils/iconUtil";
// @ts-ignore
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// @ts-ignore
import * as turf from "@turf/turf";
import { getTaskCompletionTime, getTaskCancellationTime, getStopViolationInfo } from "../../utils/timeUtils";

interface StopViolation {
  deviceId: string;
  driverName: string;
  lat: number;
  lng: number;
  durationMin: number;
  timestamp: string;
  violationNumber: number;
  resumeTimestamp?: string | null;
  actualStopDurationMs?: number | null;
}

interface Task { id:string; description:string; from:string; to:string; deadline:string; drivers?:string[]; status?:string; fromCoord?:string; toCoord?:string; photoReq?:string[]; travelReq?:{areaLarangan:boolean; keluarJalur:boolean; pinRadius:boolean}; keluarJalurRadius?:number; targetRadius?:number; photoDone?:string[]; waypoints?:{lng:number; lat:number}[]; startTimestamp?:string; endTimestamp?:string; completionTimeMs?:number; cancelledTimestamp?:string; stopViolations?:StopViolation[] }
interface Account { deviceId:string; nama:string; bk:string; icon?: string }

interface Props { task: Task; accounts: Record<string,Account>; onClose: ()=>void }

const TaskDetailModal:React.FC<Props> = ({task, accounts, onClose})=>{
  const mapRef = useRef<mapboxgl.Map|null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const [routeGeo,setRouteGeo] = useState<any>(null);
  const [areas,setAreas]=useState<any[]>([]);
  const [arrived,setArrived] = useState(false);
  const [taskStatus,setTaskStatus]=useState(task.status||'');
  const [photoReq,setPhotoReq]=useState<string[]>(task.photoReq||[]);
  const [photoDone,setPhotoDone]=useState<string[]>(task.photoDone||[]);
  const [stopViolations,setStopViolations]=useState<StopViolation[]>([]);

  const fromLL = task.fromCoord?.includes(',') ? task.fromCoord.split(',').map(Number) as [number,number] : null; // [lat,lng]
  const toLL = task.toCoord?.includes(',') ? task.toCoord.split(',').map(Number) as [number,number] : null;
  const waypoints = task.waypoints || [];
  const trackCoords = (task as any).track?.map((p: any)=>[p.lng,p.lat]) as [number,number][] | undefined;

  useEffect(()=>{
    if(!mapContainer.current || mapRef.current) return;
    if(!mapboxgl.accessToken){ mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN||""; }
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: fromLL? [fromLL[1],fromLL[0]] : [98.6785,3.597],
      zoom: 11,
    });

    // Hide Mapbox logo
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `.mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{display:none !important}`;
    document.head.appendChild(styleEl);

    // live driver markers handled separately
    if(fromLL){ new mapboxgl.Marker({color:'#3b82f6'}).setLngLat([fromLL[1],fromLL[0]]).addTo(mapRef.current); }
    if(toLL){ new mapboxgl.Marker({color:'#ef4444'}).setLngLat([toLL[1],toLL[0]]).addTo(mapRef.current); }

    // draw restricted areas once areas state ready
    if(task.travelReq?.areaLarangan && areas.length){
      const SRC='modal-restrict';
      const FILL='modal-restrict-fill';
      const OUT='modal-restrict-out';
      const fc:any={type:'FeatureCollection',features:areas.map(a=>({type:'Feature',geometry:{type:'Polygon',coordinates:[turf.circle([a.lng,a.lat],a.radius,{units:'meters',steps:64}).geometry.coordinates[0]]}}))};
      mapRef.current.addSource(SRC,{type:'geojson',data:fc});
      mapRef.current.addLayer({id:FILL,type:'fill',source:SRC,paint:{'fill-color':'#f87171','fill-opacity':0.2}});
      mapRef.current.addLayer({id:OUT,type:'line',source:SRC,paint:{'line-color':'#ef4444','line-width':2}});
    }

    mapRef.current.on('load', () => { mapRef.current?.resize(); });

    return ()=>{ mapRef.current?.remove(); mapRef.current=null; document.head.removeChild(styleEl); };
  },[]);

  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Live driver location markers
  const driverMarkers = useRef<Record<string,mapboxgl.Marker>>({});
  useEffect(()=>{
    if(!mapRef.current) return;
    let timer:NodeJS.Timeout;
    const fetchLoc = async ()=>{
      let reachedA=false;
      let reachedB=false;
      for(const devId of task.drivers || []){
        try{
          const res = await fetch(`/api/accounts/${devId}`);
          if(!res.ok) continue;
          const detail = await res.json();
          const lat = detail.track?.latitude;
          const lon = detail.track?.longitude;
          if(lat==null||lon==null) continue;

          // compute arrival to A
          if(fromLL && task.targetRadius){
            const distA = turf.distance([lon,lat],[fromLL[1],fromLL[0]],{units:'meters'}) as number;
            if(distA<=task.targetRadius){ reachedA=true; }
          }

          // compute arrival to B
          if(toLL && task.targetRadius){
            const distB = turf.distance([lon,lat],[toLL[1],toLL[0]],{units:'meters'}) as number;
            if(distB<=task.targetRadius){ reachedB=true; }
          }

          let mk = driverMarkers.current[devId];
          if(!mk){
            const img = document.createElement('img');
            img.src = getIconPath(accounts[devId]?.icon);
            const size = scaledSize(28, accounts[devId]?.icon);
            img.style.width = `${size}px`;
            img.style.height = `${size}px`;
            mk = new mapboxgl.Marker({element:img, anchor:'center'}).setLngLat([lon,lat]).addTo(mapRef.current!);
            driverMarkers.current[devId]=mk;
          }else{
            mk.setLngLat([lon,lat]);
          }
        }catch{}
      }
      setArrived(reachedA);

      if(reachedA && taskStatus.startsWith('DIPROSES') && !taskStatus.includes('TITIK A')){
        try{
          await fetch(`/api/tasks/${task.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DIPROSES - TELAH SAMPAI DI TITIK A'})});
          setTaskStatus('DIPROSES - TELAH SAMPAI DI TITIK A');
        }catch{}
      }

      if(reachedB && taskStatus==='DIPROSES - TELAH SAMPAI DI TITIK A'){
        try{
          await fetch(`/api/tasks/${task.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DIPROSES - TELAH SAMPAI DI TITIK TUJUAN'})});
          setTaskStatus('DIPROSES - TELAH SAMPAI DI TITIK TUJUAN');
        }catch{}
      }
    };
    fetchLoc();
    timer = setInterval(fetchLoc,5000);
    return ()=>{ clearInterval(timer); Object.values(driverMarkers.current).forEach(m=>m.remove()); driverMarkers.current={}; };
  },[task.id, waypoints]);

  // Poll task status and photo requirements every 10s to reflect updates from other clients/server
  useEffect(()=>{
    let id:NodeJS.Timeout;
    const poll=async()=>{
      try{
        const res=await fetch('/api/tasks');
        if(res.ok){
          const data=await res.json();
          // Handle both old and new API response formats
          let list;
          if (Array.isArray(data)) {
            list = data;
          } else if (data.tasks && Array.isArray(data.tasks)) {
            list = data.tasks;
          } else {
            return;
          }

          const t=list.find((x:any)=>x.id===task.id);
          if(t) {
            if(t.status) setTaskStatus(t.status);
            if(t.photoReq) setPhotoReq(t.photoReq);
            if(t.photoDone) setPhotoDone(t.photoDone);
          }
        }
      }catch{}
    };
    poll();
    id=setInterval(poll,10000);
    return ()=>clearInterval(id);
  },[task.id]);

  // Fetch stop violations
  useEffect(()=>{
    const fetchStopViolations = async ()=>{
      try{
        const res = await fetch(`/api/tasks/${task.id}/stop-violations`);
        if(res.ok){
          const violations = await res.json();
          setStopViolations(violations);
        }
      }catch(err){
        console.error('Error fetching stop violations:', err);
      }
    };
    fetchStopViolations();
    // Poll every 30 seconds to get updated violations
    const id = setInterval(fetchStopViolations, 30000);
    return ()=>clearInterval(id);
  },[task.id]);

  useEffect(()=>{
    const fetchRoute = async ()=>{
      if(!fromLL||!toLL) return;
      try{
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const coordsArr = [[fromLL[1],fromLL[0]], ...waypoints.map(w=>[w.lng,w.lat]), [toLL[1],toLL[0]]];
        const coordsStr = coordsArr.map(c=>c.join(',')).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${token}`;
        const res = await fetch(url);
        if(res.ok){ const data = await res.json(); setRouteGeo(data.routes[0].geometry); }
      }catch{}
    };
    fetchRoute();
  },[task.id, waypoints]);

  useEffect(()=>{
    if(!mapRef.current || !routeGeo) return;
    const map = mapRef.current;
    const srcId='route-src'; const layerId='route-layer';
    if(mapRef.current.getSource(srcId)){
      (mapRef.current.getSource(srcId) as mapboxgl.GeoJSONSource).setData({type:'Feature',geometry:routeGeo} as any);
    }else{
      mapRef.current.addSource(srcId,{type:'geojson',data:{type:'Feature',geometry:routeGeo} as any});
      mapRef.current.addLayer({id:layerId,type:'line',source:srcId,paint:{'line-color':'#3b82f6','line-width':4}});
    }

    // draw buffer deviation
    if(task.travelReq?.keluarJalur && task.keluarJalurRadius && task.keluarJalurRadius>0){
      const buf = turf.buffer({type:'Feature',geometry:routeGeo} as any, task.keluarJalurRadius,{units:'meters'});
      const bsrc='route-buf'; const bfill='route-buf-fill'; const bout='route-buf-out';
      if(!map.getSource(bsrc)){
        map.addSource(bsrc,{type:'geojson',data:buf as any});
        map.addLayer({id:bfill,type:'fill',source:bsrc,paint:{'fill-color':'#3b82f6','fill-opacity':0.1}});
        map.addLayer({id:bout,type:'line',source:bsrc,paint:{'line-color':'#ef4444','line-width':2}});
      }
    }

    // draw pin radius circles
    const addCircle=(coordStr:string,id:string)=>{
      if(!(task.travelReq?.pinRadius && task.targetRadius && task.targetRadius>=100 && coordStr.includes(','))) return;
      const [latStr,lngStr]=coordStr.split(','); const lat=parseFloat(latStr); const lng=parseFloat(lngStr);
      const circ=turf.circle([lng,lat], task.targetRadius,{units:'meters',steps:64});
      if(!map.getSource(id)){
        map.addSource(id,{type:'geojson',data:circ as any});
        map.addLayer({id:id+'-fill',type:'fill',source:id,paint:{'fill-color':'#a855f7','fill-opacity':0.15}});
        map.addLayer({id:id+'-out',type:'line',source:id,paint:{'line-color':'#a855f7','line-width':2}});
      }
    };
    addCircle(task.fromCoord||'', 'modal-pin-start');
    addCircle(task.toCoord||'', 'modal-pin-end');

    // Draw driver track if available
    const TRACK_SRC='track-line'; const TRACK_LAYER='track-line-layer';
    if(trackCoords && trackCoords.length>=2){
      const gj={type:'Feature',geometry:{type:'LineString',coordinates: trackCoords}} as any;
      if(!map.getSource(TRACK_SRC)){
        map.addSource(TRACK_SRC,{type:'geojson',data:gj});
        map.addLayer({id:TRACK_LAYER,type:'line',source:TRACK_SRC,paint:{'line-color':'#a855f7','line-width':3,'line-dasharray':[1,1]} });
      }else{
        (map.getSource(TRACK_SRC) as mapboxgl.GeoJSONSource).setData(gj);
      }
    } else {
      if(map.getLayer(TRACK_LAYER)) map.removeLayer(TRACK_LAYER);
      if(map.getSource(TRACK_SRC)) map.removeSource(TRACK_SRC);
    }
  },[routeGeo]);

  useEffect(()=>{
    if(task.travelReq?.areaLarangan){
      fetch('/api/area-larangan').then(r=>r.ok?r.json():null).then(d=>{if(d) setAreas(d);}).catch(()=>{});
    }
  },[task.travelReq]);

  // draw / update restricted areas when areas state changes
  useEffect(()=>{
    if(!mapRef.current) return;
    const map=mapRef.current;
    const SRC='modal-restrict'; const FILL='modal-restrict-fill'; const OUT='modal-restrict-out';
    if(task.travelReq?.areaLarangan && areas.length){
      const fc:any={type:'FeatureCollection',features:areas.map(a=>({type:'Feature',geometry:{type:'Polygon',coordinates:[turf.circle([a.lng,a.lat],a.radius,{units:'meters',steps:64}).geometry.coordinates[0]]}}))};
      if(!map.getSource(SRC)){
        map.addSource(SRC,{type:'geojson',data:fc});
        map.addLayer({id:FILL,type:'fill',source:SRC,paint:{'fill-color':'#f87171','fill-opacity':0.2}});
        map.addLayer({id:OUT,type:'line',source:SRC,paint:{'line-color':'#ef4444','line-width':2}});
      }else{
        (map.getSource(SRC) as mapboxgl.GeoJSONSource).setData(fc);
      }
    }else{
      if(map.getLayer(FILL)) map.removeLayer(FILL);
      if(map.getLayer(OUT)) map.removeLayer(OUT);
      if(map.getSource(SRC)) map.removeSource(SRC);
    }
  },[areas, task.travelReq]);

  // Add stop violation markers to map
  const stopViolationMarkers = useRef<mapboxgl.Marker[]>([]);
  useEffect(()=>{
    if(!mapRef.current) return;
    const map = mapRef.current;

    // Remove existing stop violation markers
    stopViolationMarkers.current.forEach(marker => marker.remove());
    stopViolationMarkers.current = [];

    // Add new stop violation markers
    stopViolations.forEach((violation, index) => {
      // Create red warning marker with number
      const el = document.createElement('div');
      el.className = 'stop-violation-marker';
      el.style.cssText = `
        width: 30px;
        height: 30px;
        background-color: #dc2626;
        border: 2px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      el.textContent = violation.violationNumber.toString();

      // Add popup on click
      el.addEventListener('click', () => {
        const stopInfo = getStopViolationInfo(violation);
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setLngLat([violation.lng, violation.lat])
          .setHTML(`
            <div style="color: black; padding: 8px; font-size: 12px;">
              <strong>Pelanggaran Berhenti #${violation.violationNumber}</strong><br/>
              Driver: ${violation.driverName}<br/>
              Durasi Limit: ${stopInfo.limitDuration}<br/>
              Waktu kembali jalan: <span style="color: ${stopInfo.hasResumed ? '#10b981' : '#f59e0b'}">${stopInfo.resumeTime}</span><br/>
              Durasi berhenti: <span style="color: ${stopInfo.hasResumed ? '#3b82f6' : '#f59e0b'}">${stopInfo.actualDuration}</span><br/>
              Mulai berhenti: ${stopInfo.startTime}
            </div>
          `)
          .addTo(map);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([violation.lng, violation.lat])
        .addTo(map);

      stopViolationMarkers.current.push(marker);
    });
  },[stopViolations]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 text-white rounded-lg w-full h-[85vh] md:h-[85vh] overflow-auto w-[90vw] md:w-[80vw]" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-purple-800 px-4 py-2">
          <h3 className="font-semibold">Detail Tugas</h3>
          <button onClick={onClose} className="text-red-400 hover:text-red-300">✕</button>
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-3 md:gap-4 md:h-[calc(85vh-60px)]">
          {/* Mobile: Map first, then info below */}
          <div className="order-2 md:order-1 md:w-1/3 flex-shrink-0 space-y-3 md:space-y-4 overflow-y-auto">
            <div>
              <p className="font-semibold text-purple-300 mb-2">{task.description}</p>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">ID: <span className="text-gray-100">{task.id}</span></p>
                <p className="text-sm text-gray-400">Status: <span className={taskStatus==='TELAH DIKONIFIRMASI'? 'text-green-400' : taskStatus?.startsWith('DIPROSES') ? 'text-blue-400' : taskStatus==='DIBATALKAN' ? 'text-red-400' : 'text-yellow-300'}>{taskStatus||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-gray-400">Berangkat: <span className="text-gray-100">{task.from}</span></p>
                <p className="text-sm text-gray-400">Destinasi: <span className="text-gray-100">{task.to}</span></p>
                <p className="text-sm text-gray-400">Deadline: <span className="text-red-400">{task.deadline}</span></p>
                {taskStatus === 'SELESAI' && (() => {
                  const completionTime = getTaskCompletionTime(task);
                  return completionTime ? (
                    <p className="text-sm text-gray-400">Waktu Penyelesaian: <span className="text-green-400">{completionTime}</span></p>
                  ) : null;
                })()}
                {taskStatus === 'DIBATALKAN' && (() => {
                  const cancellationTime = getTaskCancellationTime(task);
                  return cancellationTime ? (
                    <p className="text-sm text-gray-400">Waktu Dibatalkan: <span className="text-red-400">{cancellationTime}</span></p>
                  ) : null;
                })()}
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-400 mb-1">Driver:</p>
                <div className="flex flex-wrap gap-1">
                  {task.drivers?.map(id=>{
                    const acc=accounts[id];
                    return <span key={id} className="bg-purple-700/60 px-2 py-0.5 rounded text-xs">{acc?`${acc.nama} (${acc.bk})`:id}</span>;
                  })}
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">List Berhenti Driver:</p>
              {stopViolations?.length ? (
                <div className="space-y-2">
                  {stopViolations.map((violation,i)=>{
                    const stopInfo = getStopViolationInfo(violation);
                    return (
                      <div key={i} className="bg-red-900/30 border border-red-700 rounded p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            {violation.violationNumber}
                          </span>
                          <span className="text-red-400 text-sm font-medium">
                            {violation.driverName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">
                          Durasi Limit Berhenti: {stopInfo.limitDuration}
                        </p>
                        <p className="text-xs text-gray-300">
                          Waktu kembali jalan: <span className={stopInfo.hasResumed ? 'text-green-400' : 'text-yellow-400'}>
                            {stopInfo.resumeTime}
                          </span>
                        </p>
                        <p className="text-xs text-gray-300">
                          Durasi berhenti: <span className={stopInfo.hasResumed ? 'text-blue-400' : 'text-yellow-400'}>
                            {stopInfo.actualDuration}
                          </span>
                        </p>
                        <p className="text-xs text-gray-300">
                          Koordinat: {violation.lat.toFixed(5)}, {violation.lng.toFixed(5)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Mulai berhenti: {stopInfo.startTime}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Tidak ada rekaman berhenti</p>
              )}
            </div>
            {photoReq?.length ? (
              <div>
                <p className="text-sm text-gray-400 mb-2">Syarat Foto:</p>
                <ul className="list-disc list-inside text-sm text-gray-100 space-y-1">
                  {photoReq.map((f,i)=>{
                    const done = photoDone?.includes(f);
                    return <li key={i}>{done?'✔️ ':''}{f}</li>;
                  })}
                </ul>
              </div>
            ):null}
          </div>
          {/* Desktop: Info left, Map right */}
          <div className="order-1 md:order-2 w-full h-80 md:h-full md:flex-1">
            <div ref={mapContainer} className="w-full h-full rounded border border-purple-800" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal; 