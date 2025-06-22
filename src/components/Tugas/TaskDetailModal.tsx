import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// @ts-ignore
import * as turf from "@turf/turf";

interface Task { id:string; description:string; from:string; to:string; deadline:string; drivers?:string[]; status?:string; fromCoord?:string; toCoord?:string; photoReq?:string[]; travelReq?:{areaLarangan:boolean; keluarJalur:boolean; pinRadius:boolean}; keluarJalurRadius?:number; targetRadius?:number; photoDone?:string[]; waypoints?:{lng:number; lat:number}[] }
interface Account { deviceId:string; nama:string; bk:string }

interface Props { task: Task; accounts: Record<string,Account>; onClose: ()=>void }

const TaskDetailModal:React.FC<Props> = ({task, accounts, onClose})=>{
  const mapRef = useRef<mapboxgl.Map|null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const [routeGeo,setRouteGeo] = useState<any>(null);
  const [areas,setAreas]=useState<any[]>([]);
  const [arrived,setArrived] = useState(false);
  const [taskStatus,setTaskStatus]=useState(task.status||'');

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

    return ()=>{ mapRef.current?.remove(); mapRef.current=null; document.head.removeChild(styleEl); };
  },[]);

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
          const res = await fetch(`http://66.96.230.177:3000/api/accounts/${devId}`);
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
            const img=document.createElement('img'); img.src='/truck.png'; img.style.width='28px'; img.style.height='28px';
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
          await fetch(`http://66.96.230.177:3000/api/tasks/${task.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DIPROSES - TELAH SAMPAI DI TITIK A'})});
          setTaskStatus('DIPROSES - TELAH SAMPAI DI TITIK A');
        }catch{}
      }

      if(reachedB && taskStatus==='DIPROSES - TELAH SAMPAI DI TITIK A'){
        try{
          await fetch(`http://66.96.230.177:3000/api/tasks/${task.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DIPROSES - TELAH SAMPAI DI TITIK TUJUAN'})});
          setTaskStatus('DIPROSES - TELAH SAMPAI DI TITIK TUJUAN');
        }catch{}
      }
    };
    fetchLoc();
    timer = setInterval(fetchLoc,5000);
    return ()=>{ clearInterval(timer); Object.values(driverMarkers.current).forEach(m=>m.remove()); driverMarkers.current={}; };
  },[task.id, waypoints]);

  // Poll task status every 10s to reflect updates from other clients/server
  useEffect(()=>{
    let id:NodeJS.Timeout;
    const poll=async()=>{
      try{
        const res=await fetch('http://66.96.230.177:3000/api/tasks');
        if(res.ok){ const list=await res.json(); const t=list.find((x:any)=>x.id===task.id); if(t && t.status) setTaskStatus(t.status); }
      }catch{}
    };
    poll();
    id=setInterval(poll,10000);
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
      fetch('http://66.96.230.177:3000/api/area-larangan').then(r=>r.ok?r.json():null).then(d=>{if(d) setAreas(d);}).catch(()=>{});
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

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 text-white rounded-lg w-full h-[85vh] md:h-[85vh] overflow-auto w-[90vw] md:w-[80vw]" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-purple-800 px-4 py-2">
          <h3 className="font-semibold">Detail Tugas</h3>
          <button onClick={onClose} className="text-red-400 hover:text-red-300">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div ref={mapContainer} className="w-full h-64 md:h-80 rounded border border-purple-800" />
          <div className="md:flex md:gap-6">
            <div className="md:flex-1">
              <div>
                <p className="font-semibold text-purple-300 mb-1">{task.description}</p>
                <p className="text-sm text-gray-400">ID: <span className="text-gray-100">{task.id}</span></p>
                <p className="text-sm text-gray-400">Status: <span className={taskStatus==='TELAH DIKONIFIRMASI'? 'text-green-400' : taskStatus?.startsWith('DIPROSES') ? 'text-blue-400' : taskStatus==='DIBATALKAN' ? 'text-red-400' : 'text-yellow-300'}>{taskStatus||'MENUNGGU KONFIRMASI'}</span></p>
                <p className="text-sm text-gray-400">Berangkat: <span className="text-gray-100">{task.from}</span></p>
                <p className="text-sm text-gray-400">Destinasi: <span className="text-gray-100">{task.to}</span></p>
                <p className="text-sm text-gray-400">Deadline: <span className="text-red-400">{task.deadline}</span></p>
                <div className="mt-2">
                  <p className="text-sm text-gray-400">Driver:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.drivers?.map(id=>{
                      const acc=accounts[id];
                      return <span key={id} className="bg-purple-700/60 px-2 py-0.5 rounded text-xs">{acc?`${acc.nama} (${acc.bk})`:id}</span>;
                    })}
                  </div>
                </div>
              </div>
            </div>
            {task.photoReq?.length ? (
              <div className="mt-2 md:mt-0 md:w-1/3 md:ml-auto">
                <p className="text-sm text-gray-400 mb-1">Syarat Foto:</p>
                <ul className="list-disc list-inside text-sm text-gray-100 space-y-0.5">
                  {task.photoReq.map((f,i)=>{
                    const done = task.photoDone?.includes(f);
                    return <li key={i}>{done?'✔️ ':''}{f}</li>;
                  })}
                </ul>
              </div>
            ):null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal; 