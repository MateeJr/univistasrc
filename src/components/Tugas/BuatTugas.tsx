"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMap } from "@/components/Home/MapContext";
import { FiSearch } from "react-icons/fi";
import { GoPin } from "react-icons/go";
import { FaAnchor } from "react-icons/fa";
// @ts-ignore
import mapboxgl from "mapbox-gl";
// @ts-ignore
import * as turf from "@turf/turf";

interface Driver { deviceId: string; nama: string; bk: string }

const BuatTugas: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string,'online'|'disconnected'|'offline'>>({});
  const selectorRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [fromCoord, setFromCoord] = useState<string>("");
  const [toCoord, setToCoord] = useState<string>("");
  const [deadlineDate, setDeadlineDate] = useState<string>(()=>{
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth()+1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [deadlineTime, setDeadlineTime] = useState<string>("");

  // Photo requirements
  const [photoTypes, setPhotoTypes] = useState<string[]>([]);
  const [photoReq, setPhotoReq] = useState<Record<string, boolean>>({});

  // Travel requirements
  const [travelReq, setTravelReq] = useState({ areaLarangan: true, keluarJalur: false, pinRadius: true });
  const [keluarJalurRadius, setKeluarJalurRadius] = useState<number>(0);
  const [targetRadius, setTargetRadius] = useState<number>(100);
  const [areas, setAreas] = useState<any[]>([]);

  // Waypoints for adjustable route
  const [waypoints, setWaypoints] = useState<{lng: number, lat: number}[]>([]);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [anchorEditMode, setAnchorEditMode] = useState(false);
  const anchorControlRef = useRef<any>(null);
  // Reference for the persistent note control
  const noteControlRef = useRef<any>(null);

  const { map } = useMap();

  // marker references
  const fromMarkerRef = useRef<mapboxgl.Marker|null>(null);
  const toMarkerRef = useRef<mapboxgl.Marker|null>(null);
  const routeAddedRef = useRef(false);
  const [fromSet, setFromSet] = useState(false);
  const [toSet, setToSet] = useState(false);

  // Which field is currently awaiting a pin from the map ('from' | 'to' | null)
  const [pinMode, setPinMode] = useState<null | 'from' | 'to'>(null);

  // Map click handler for pinning coordinates
  useEffect(() => {
    if (!map || pinMode === null || anchorEditMode) return;

    const clickHandler = (e: mapboxgl.MapMouseEvent & { lngLat: mapboxgl.LngLat }) => {
      const { lat, lng } = e.lngLat;
      const coordStr = `${lat.toFixed(5)},${lng.toFixed(5)}`;

      if (pinMode === 'from') {
        setFromCoord(coordStr);
        fromMarkerRef.current?.remove();
        fromMarkerRef.current = new mapboxgl.Marker({ color: '#3b82f6' }).setLngLat([lng, lat]).addTo(map);
        setFromSet(true);
      } else if (pinMode === 'to') {
        setToCoord(coordStr);
        toMarkerRef.current?.remove();
        toMarkerRef.current = new mapboxgl.Marker({ color: '#ef4444' }).setLngLat([lng, lat]).addTo(map);
        setToSet(true);
      }
      setPinMode(null);
    };

    map.once('click', clickHandler);
    return () => {
      map.off('click', clickHandler as any);
    };
  }, [pinMode, map, anchorEditMode]);

  // Add custom map control for editing anchors
  useEffect(() => {
    if (!map) return;

    class AnchorControl {
        private _map: mapboxgl.Map | undefined;
        private _container!: HTMLElement;
        public _button: HTMLButtonElement | undefined;

        onAdd(map: mapboxgl.Map) {
            this._map = map;
            this._container = document.createElement('div');
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            this._button = document.createElement('button');
            this._button.className = 'mapboxgl-ctrl-icon';
            this._button.type = 'button';
            this._button.title = "Edit Route Anchors";
            this._button.style.display = 'flex';
            this._button.style.alignItems = 'center';
            this._button.style.justifyContent = 'center';

            const icon = document.createElement('span');
            icon.innerHTML = `<svg viewBox="0 0 24 24" height="1em" width="1em" fill="#7e22ce" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;
            this._button.appendChild(icon);
            
            this._button.onclick = () => setAnchorEditMode(p => !p);
            this._container.appendChild(this._button);
            return this._container;
        }

        onRemove() {
            if(this._container.parentNode) this._container.parentNode.removeChild(this._container);
            this._map = undefined;
        }

        setActive(isActive: boolean) {
            if (this._button) {
                this._button.style.backgroundColor = isActive ? '#9333ea' : '#fff';
                const svg = this._button.querySelector('svg');
                if(svg) svg.style.fill = isActive ? '#fff' : '#7e22ce';
            }
        }
    }

    if (!anchorControlRef.current) {
        const control = new AnchorControl();
        anchorControlRef.current = control;
        map.addControl(control, 'bottom-left');
    }
    
    // ---------- SIMPLE OVERLAY NOTE (center top) ----------
    if (!noteControlRef.current) {
        const el = document.createElement('div');
        el.textContent = 'Pastikan jalur biru A - B terbentuk di map sebelum buat tugas (Jika tidak terbentuk, atur ulang koordinat)';
        el.style.position = 'absolute';
        el.style.top = '10px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.padding = '4px 10px';
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.color = '#fff';
        el.style.fontSize = '12px';
        el.style.borderRadius = '6px';
        el.style.pointerEvents = 'none';
        el.style.whiteSpace = 'normal';
        el.style.textAlign = 'center';
        el.style.wordBreak = 'break-word';
        el.style.zIndex = '10';

        map.getContainer().appendChild(el);
        noteControlRef.current = el;
    }

    return () => {
        if (map && anchorControlRef.current) {
            try { map.removeControl(anchorControlRef.current); } catch (e) {}
            anchorControlRef.current = null;
        }
        if (map && noteControlRef.current) {
            try { map.getContainer().removeChild(noteControlRef.current); } catch {}
            noteControlRef.current = null;
        }
    };
  }, [map]);

  useEffect(() => {
    if (anchorControlRef.current) {
        anchorControlRef.current.setActive(anchorEditMode);
    }
  }, [anchorEditMode]);

  // Click on route to add anchor points
  useEffect(() => {
    if (!map || !anchorEditMode || !routeAddedRef.current || pinMode !== null) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
        if ((e.originalEvent.target as HTMLElement).closest('.mapboxgl-marker')) return;

        const routeSource = map.getSource('route-line') as mapboxgl.GeoJSONSource;
        if (!routeSource) return;

        const routeGeoJSON = (routeSource as any)._data;
        if (!routeGeoJSON) return;

        const clickedPoint = turf.point([e.lngLat.lng, e.lngLat.lat]);
        const snapped = turf.pointOnLine(routeGeoJSON, clickedPoint, { units: 'meters' });

        const newWaypoint = {
            lng: snapped.geometry.coordinates[0],
            lat: snapped.geometry.coordinates[1],
        };

        // This just adds to the end. For more complex logic, we'd need to find the insert index.
        setWaypoints(prev => [...prev, newWaypoint]);
    };

    map.on('click', handleMapClick);
    map.getCanvas().style.cursor = 'crosshair';

    return () => {
        map.off('click', handleMapClick);
        map.getCanvas().style.cursor = '';
    };
  }, [map, anchorEditMode, pinMode]);

  // Sync waypoint markers with state
  useEffect(() => {
    if (!map) return;

    // This effect handles its own cleanup, so no need to sync with parent cleanup
    waypointMarkersRef.current.forEach(marker => marker.remove());
    waypointMarkersRef.current = [];

    if (!anchorEditMode) return;

    const newMarkers = waypoints.map((wp, index) => {
        const markerEl = document.createElement('div');
        markerEl.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="%23a855f7"><circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/></svg>')`;
        markerEl.style.width = '24px';
        markerEl.style.height = '24px';
        markerEl.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker({
            element: markerEl,
            draggable: true,
        })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);

        marker.on('dragend', () => {
            const newLngLat = marker.getLngLat();
            setWaypoints(prev => {
                const updated = [...prev];
                updated[index] = { lng: newLngLat.lng, lat: newLngLat.lat };
                return updated;
            });
        });

        marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            setWaypoints(prev => prev.filter((_, i) => i !== index));
        });

        return marker;
    });

    waypointMarkersRef.current = newMarkers;

    return () => {
      waypointMarkersRef.current.forEach(marker => marker.remove());
      waypointMarkersRef.current = [];
    }

  }, [map, waypoints, anchorEditMode]);

  // Helper to regenerate today's string when needed (e.g., clearing form)
  const formatToday = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fetch drivers and statuses
  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const res = await fetch("/api/accounts");
        const data: Driver[] = res.ok ? await res.json() : [];

        // Store drivers
        setDrivers(data);

        // Determine statuses
        const statusObj: Record<string,'online'|'disconnected'|'offline'> = {};
        await Promise.all(
          data.map(async (d) => {
            try {
              const detailRes = await fetch(`/api/accounts/${d.deviceId}`);
              if (!detailRes.ok) return;
              const detail = await detailRes.json();
              const last = detail.track?.timestampMs ?? (detail.track?.lastUpdated ? Date.parse(detail.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) : 0);
              const diffMin = (Date.now() - last) / 60000;
              if (diffMin < 2) statusObj[d.deviceId] = 'online';
              else if (diffMin < 10) statusObj[d.deviceId] = 'disconnected';
              else statusObj[d.deviceId] = 'offline';
            } catch {}
          })
        );
        setStatuses(statusObj);
      } catch {}
    };

    loadDrivers();
    const id = setInterval(loadDrivers, 60000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!selectorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // inject style for white calendar/time icons once
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator {
        filter: invert(1);
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Draw route when both coords available
  useEffect(() => {
    if(!map || !map.isStyleLoaded()) return;

    const parse = (coord:string)=>{
      const parts = coord.split(',');
      if(parts.length!==2) return null;
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if(Number.isNaN(lat)||Number.isNaN(lng)) return null;
      return [lng, lat] as [number,number];
    };

    const fromLL = parse(fromCoord);
    const toLL = parse(toCoord);

    if(!fromSet || !toSet) {
      if(waypoints.length > 0) setWaypoints([]);
    }

    if(fromSet && toSet && fromLL && toLL){
      const fetchRoute = async () => {
        try {
          const routePoints = [fromLL, ...waypoints.map(w => [w.lng, w.lat]), toLL];
          const coordsString = routePoints.map(c=>c.join(',')).join(';');

          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${token}`;
          const res = await fetch(url);
          if(!res.ok) throw new Error('dir api');
          const data = await res.json();
          const route=data.routes?.[0];
          const coords = route?.geometry?.coordinates;
          if(!coords) return;

          const geojson = { type:'Feature', geometry:{ type:'LineString', coordinates:coords } } as any;

          if(!map.getSource('route-line')){
            map.addSource('route-line', { type:'geojson', data: geojson });
            map.addLayer({ id:'route-line-layer', type:'line', source:'route-line', paint:{ 'line-color':'#3b82f6','line-width':4 }});
          } else {
            const src = map.getSource('route-line') as mapboxgl.GeoJSONSource;
            src.setData(geojson);
          }
          routeAddedRef.current = true;

          if(route?.distance){ setDistanceKm(Math.round(route.distance/100)/10); } // one decimal km
          if(route?.duration){ setEtaMin(Math.round(route.duration/60)); }
        } catch {}
      };

      fetchRoute();
    } else {
      if(routeAddedRef.current){
        if(map.getLayer('route-line-layer')) map.removeLayer('route-line-layer');
        if(map.getSource('route-line')) map.removeSource('route-line');
        routeAddedRef.current=false;
      }
      setDistanceKm(null); setEtaMin(null);
    }
  }, [fromCoord, toCoord, map, fromSet, toSet, waypoints]);

  // Photo requirements
  useEffect(() => {
    const loadFoto = async () => {
      try {
        const res = await fetch('/api/jenis-foto');
        const data: string[] = res.ok ? await res.json() : [];
        setPhotoTypes(data);
        const init: Record<string, boolean> = {};
        data.forEach(n=> init[n]=false); // Changed to false (unchecked by default)
        setPhotoReq(init);
      } catch {}
    };
    loadFoto();
  }, []);

  // Load server configs (areas, radii)
  useEffect(()=>{
    const fetchAll = async () => {
      try{
        const r1 = await fetch('/api/area-larangan');
        if(r1.ok){ setAreas(await r1.json()); }
        const r2 = await fetch('/api/keluar-jalur');
        if(r2.ok){ const d=await r2.json(); setKeluarJalurRadius(Number(d.value)||0); }
        const r3 = await fetch('/api/target-radius');
        if(r3.ok){ const d=await r3.json(); setTargetRadius(Math.max(100,Number(d.value)||100)); }
      }catch{}
    };
    fetchAll();
  },[]);

  // Draw Restricted Areas
  useEffect(()=>{
    if(!map || !map.isStyleLoaded()) return;
    const SRC='bt-restricted'; const FILL='bt-restricted-fill'; const OUT='bt-restricted-out';
    if(!travelReq.areaLarangan || !areas.length){
      if(map.getLayer(FILL)) map.removeLayer(FILL);
      if(map.getLayer(OUT)) map.removeLayer(OUT);
      if(map.getSource(SRC)) map.removeSource(SRC);
      return;
    }
    const fc:any = {type:'FeatureCollection',features: areas.map(a=>({type:'Feature',geometry:{type:'Polygon',coordinates:[turf.circle([a.lng,a.lat],a.radius,{units:'meters',steps:64}).geometry.coordinates[0]]}}))};
    if(!map.getSource(SRC)){
      map.addSource(SRC,{type:'geojson',data:fc});
      map.addLayer({id:FILL,type:'fill',source:SRC,paint:{'fill-color':'#f87171','fill-opacity':0.2}});
      map.addLayer({id:OUT,type:'line',source:SRC,paint:{'line-color':'#ef4444','line-width':2}});
    }else{
      (map.getSource(SRC) as mapboxgl.GeoJSONSource).setData(fc);
    }
  },[travelReq.areaLarangan,areas,map]);

  // Draw keluarluar buffer and pin radius when route available
  const bufferSrc='bt-route-buf'; const bufferFill='bt-route-buf-fill'; const bufferOut='bt-route-buf-out';
  const pinStart='bt-pin-start'; const pinEnd='bt-pin-end';

  // Effect for buffer around route (requires route-line)
  useEffect(()=>{
    if(!map || !map.isStyleLoaded()) return;
    if(!map.getSource('route-line')){
      if(map.getSource(bufferSrc)){ if(map.getLayer(bufferFill)) map.removeLayer(bufferFill); if(map.getLayer(bufferOut)) map.removeLayer(bufferOut); map.removeSource(bufferSrc);} 
      return;
    }
    const routeGeo = (map.getSource('route-line') as mapboxgl.GeoJSONSource).serialize().data as any;
    if(travelReq.keluarJalur && keluarJalurRadius>0){
      const buf = turf.buffer(routeGeo, keluarJalurRadius,{units:'meters'});
      if(!map.getSource(bufferSrc)){
        map.addSource(bufferSrc,{type:'geojson',data:buf});
        map.addLayer({id:bufferFill,type:'fill',source:bufferSrc,paint:{'fill-color':'#3b82f6','fill-opacity':0.1}});
        map.addLayer({id:bufferOut,type:'line',source:bufferSrc,paint:{'line-color':'#ef4444','line-width':2}});
      }else{ (map.getSource(bufferSrc) as mapboxgl.GeoJSONSource).setData(buf); }
    }else{
      if(map.getLayer(bufferFill)) map.removeLayer(bufferFill);
      if(map.getLayer(bufferOut)) map.removeLayer(bufferOut);
      if(map.getSource(bufferSrc)) map.removeSource(bufferSrc);
    }
  },[travelReq.keluarJalur,keluarJalurRadius,map]);

  // Effect for pin radius circles independent of buffer
  useEffect(()=>{
    if(!map || !map.isStyleLoaded()) return;
    const handlePin=(coordStr:string,id:string)=>{
      if(!(travelReq.pinRadius && targetRadius>=100 && coordStr.includes(','))){
        if(map.getSource(id)){ ['-fill','-out'].forEach(s=>{if(map.getLayer(id+s)) map.removeLayer(id+s);}); map.removeSource(id);} return;
      }
      const [latStr,lngStr]=coordStr.split(','); const lat=parseFloat(latStr); const lng=parseFloat(lngStr);
      const circ = turf.circle([lng,lat], targetRadius,{units:'meters',steps:64});
      if(!map.getSource(id)){
        map.addSource(id,{type:'geojson',data:circ});
        map.addLayer({id:id+'-fill',type:'fill',source:id,paint:{'fill-color':'#a855f7','fill-opacity':0.15}});
        map.addLayer({id:id+'-out',type:'line',source:id,paint:{'line-color':'#a855f7','line-width':2}});
      }else{ (map.getSource(id) as mapboxgl.GeoJSONSource).setData(circ); }
    };
    handlePin(fromCoord,pinStart);
    handlePin(toCoord,pinEnd);
  },[travelReq.pinRadius,targetRadius,fromCoord,toCoord,map]);

  // Determine if form is valid
  const isValid = selected.length > 0
    && description.trim() !== ''
    && from.trim() !== ''
    && fromCoord.trim() !== ''
    && to.trim() !== ''
    && toCoord.trim() !== ''
    && deadlineDate.trim() !== ''
    && deadlineTime !== '';

  const [distanceKm,setDistanceKm]=useState<number|null>(null);
  const [etaMin,setEtaMin]=useState<number|null>(null);

  return (
    <div className="h-full rounded-lg bg-black p-4 text-white border border-purple-900 flex flex-col gap-2 overflow-auto">
      {/* Driver selector */}
      <div className="relative w-full sm:max-w-sm md:max-w-none" ref={selectorRef}>
        <label className="block mb-1 text-sm font-semibold text-gray-300">Pilih Driver</label>
        <input
          type="text"
          readOnly
          value={selected.length ? `${selected.length} driver dipilih` : "Klik untuk memilih"}
          onClick={() => setOpen((o)=>!o)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-600"
        />
        {open && (
          <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto bg-gray-900 border border-gray-700 rounded shadow-lg">
            {drivers.map((d)=>{
              const isSel = selected.some(s=>s.deviceId===d.deviceId);
              return (
                <div
                  key={d.deviceId}
                  onClick={(e)=>{
                    e.stopPropagation();
                    setSelected(prev=>{
                      if (prev.some(s=>s.deviceId===d.deviceId)) return prev.filter(s=>s.deviceId!==d.deviceId);
                      return [...prev, d];
                    });
                  }}
                  className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer ${isSel?'bg-purple-700':'hover:bg-purple-600'}`}
                >
                  <span className={`w-3 h-3 rounded-full ${statuses[d.deviceId]==='online'?'bg-green-400':statuses[d.deviceId]==='disconnected'?'bg-red-500':'bg-gray-500'}`}></span>
                  <span className="flex-1">{d.nama}</span>
                  <span className="text-gray-400">{d.bk}</span>
                </div>
              );
            })}
            {drivers.length===0 && <div className="px-3 py-2 text-gray-500 text-sm">Tidak ada driver</div>}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selected.length>0 && (
        <div className="flex flex-wrap gap-1 mt-2 max-h-32 overflow-auto overflow-x-auto">
          {selected.map((d)=>(
            <span key={d.deviceId} className="flex items-center bg-purple-800 px-2 py-1 rounded text-sm gap-1 whitespace-nowrap">
              {d.nama}
              <button onClick={()=>setSelected(prev=>prev.filter(p=>p.deviceId!==d.deviceId))} className="text-xs">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Deskripsi Tugas section */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-3">
        <label className="block mb-1 text-sm font-semibold text-gray-300">Deskripsi Tugas</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tuliskan deskripsi tugas di sini..."
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 h-32 resize-y text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
        />
      </div>

      {/* Berangkat Dari */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-2">
        <label className="block mb-1 text-sm font-semibold text-gray-300">Berangkat Dari</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={from}
            onChange={(e)=>setFrom(e.target.value)}
            placeholder="Lokasi keberangkatan"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button
            type="button"
            onClick={() => {
              if(from.trim()) window.open(`https://www.google.com/maps/search/${encodeURIComponent(from)}`, '_blank');
            }}
            className="w-full sm:w-24 h-10 rounded bg-green-600 hover:bg-green-500 text-white flex items-center justify-center"
          >
            <FiSearch className="inline sm:hidden" />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </div>
        <label className="block mt-2 mb-1 text-sm font-semibold text-gray-300">Koordinat</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={fromCoord}
            onChange={(e)=>setFromCoord(e.target.value)}
            placeholder="Lat,Lng"
            className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button
            type="button"
            onClick={() => {
              if(!map) return;
              let lat:number, lng:number;
              if(fromCoord.trim()) {
                const parts = fromCoord.split(',');
                lat = parseFloat(parts[0]);
                lng = parseFloat(parts[1]);
              } else {
                const c = map.getCenter();
                lat = c.lat;
                lng = c.lng;
                setFromCoord(`${lat.toFixed(5)},${lng.toFixed(5)}`);
              }

              // remove previous marker
              fromMarkerRef.current?.remove();
              fromMarkerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
                .setLngLat([lng, lat])
                .addTo(map);
              map.flyTo({ center: [lng, lat], zoom: 14 });
              setFromSet(true);
            }}
            className="w-full sm:w-24 h-10 rounded bg-purple-700 hover:bg-purple-600 text-white flex items-center justify-center"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              if(!map) return;
              alert('Klik pada peta untuk memilih titik keberangkatan');
              setPinMode('from');
            }}
            className="w-full sm:w-24 h-10 rounded bg-pink-700 hover:bg-pink-600 text-white flex items-center justify-center"
          >
            <GoPin className="inline" />
            <span className="hidden sm:inline ml-1">Pin</span>
          </button>
        </div>
      </div>

      {/* Destinasi */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-2">
        <label className="block mb-1 text-sm font-semibold text-gray-300">Destinasi</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={to}
            onChange={(e)=>setTo(e.target.value)}
            placeholder="Lokasi tujuan"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button
            type="button"
            onClick={() => {
              if(to.trim()) window.open(`https://www.google.com/maps/search/${encodeURIComponent(to)}`, '_blank');
            }}
            className="w-full sm:w-24 h-10 rounded bg-green-600 hover:bg-green-500 text-white flex items-center justify-center"
          >
            <FiSearch className="inline sm:hidden" />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </div>
        <label className="block mt-2 mb-1 text-sm font-semibold text-gray-300">Koordinat</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={toCoord}
            onChange={(e)=>setToCoord(e.target.value)}
            placeholder="Lat,Lng"
            className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button
            type="button"
            onClick={() => {
              if(!map) return;
              let lat:number, lng:number;
              if(toCoord.trim()) {
                const parts = toCoord.split(',');
                lat = parseFloat(parts[0]);
                lng = parseFloat(parts[1]);
              } else {
                const c = map.getCenter();
                lat = c.lat;
                lng = c.lng;
                setToCoord(`${lat.toFixed(5)},${lng.toFixed(5)}`);
              }

              toMarkerRef.current?.remove();
              toMarkerRef.current = new mapboxgl.Marker({ color: '#ef4444' })
                .setLngLat([lng, lat])
                .addTo(map);
              map.flyTo({ center: [lng, lat], zoom: 14 });
              setToSet(true);
            }}
            className="w-full sm:w-24 h-10 rounded bg-purple-700 hover:bg-purple-600 text-white flex items-center justify-center"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              if(!map) return;
              alert('Klik pada peta untuk memilih titik destinasi');
              setPinMode('to');
            }}
            className="w-full sm:w-24 h-10 rounded bg-pink-700 hover:bg-pink-600 text-white flex items-center justify-center"
          >
            <GoPin className="inline" />
            <span className="hidden sm:inline ml-1">Pin</span>
          </button>
        </div>
      </div>

      {/* Batas Deadline */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-2 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-semibold text-gray-300">Tanggal Deadline</label>
          <input
            type="text"
            placeholder="DD/MM/YYYY"
            value={deadlineDate}
            pattern="\\d{2}/\\d{2}/\\d{4}"
            onChange={(e)=>setDeadlineDate(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1 text-sm font-semibold text-gray-300">Waktu</label>
          <input
            type="time"
            value={deadlineTime}
            onChange={(e)=>setDeadlineTime(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
      </div>

      {/* Syarat Foto */}
      {photoTypes.length>0 && (
        <div className="w-full sm:max-w-sm md:max-w-none mt-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-semibold text-gray-300">Syarat Foto</label>
            <button
              type="button"
              onClick={() => {
                const allChecked = photoTypes.every(pt => photoReq[pt]);
                const newState: Record<string, boolean> = {};
                photoTypes.forEach(pt => newState[pt] = !allChecked);
                setPhotoReq(newState);
              }}
              className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              {photoTypes.every(pt => photoReq[pt]) ? 'Hapus Semua' : 'Pilih Semua'}
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-auto border border-gray-700 rounded p-2">
            {photoTypes.map(pt => (
              <label key={pt} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={photoReq[pt]}
                  onChange={e=> setPhotoReq({...photoReq, [pt]: e.target.checked})}
                  className="form-checkbox text-purple-600 h-4 w-4"
                />
                <span>{pt}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Syarat Perjalanan */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-3">
        <label className="block mb-1 text-sm font-semibold text-gray-300">Syarat Perjalanan</label>
        <div className="flex flex-col gap-1 border border-gray-700 rounded p-2">
          {[
            {key:'areaLarangan',label:'Area Larangan'},
            {key:'keluarJalur',label:'Batas Keluar Jalur'},
            {key:'pinRadius',label:'Radius target pin point'}
          ].map(item=>(
            <label key={item.key} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={travelReq[item.key as keyof typeof travelReq]} onChange={e=>setTravelReq({...travelReq,[item.key]:e.target.checked})} className="form-checkbox text-purple-600 h-4 w-4" />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Additional UI for task creation can go here */}
      {distanceKm!=null && (
        <div className="mt-2 text-sm text-purple-300">Jarak estimasi: <span className="font-semibold text-white">{distanceKm} km</span> &nbsp; | &nbsp; Estimasi waktu: <span className="font-semibold text-white">{etaMin} menit</span></div>
      )}

      {/* Action buttons */}
      <div className="w-full sm:max-w-sm md:max-w-none mt-4 flex gap-2">
        <button
          type="button"
          disabled={!isValid}
          onClick={async () => {
            try {
              const selectedFoto = Object.entries(photoReq).filter(([_,v])=>v).map(([k])=>k);
              const body = {
                drivers: selected.map(d=>d.deviceId),
                description,
                from, fromCoord,
                to, toCoord,
                deadline: `${deadlineDate} ${deadlineTime}`,
                photoReq: selectedFoto,
                travelReq,
                keluarJalurRadius,
                targetRadius,
                distanceKm,
                etaMin,
                waypoints,
              };
              await fetch('/api/tasks', {
                method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
              });
              alert('Task created');
              // clear
              setSelected([]); setDescription(''); setFrom(''); setFromCoord(''); setTo(''); setToCoord(''); setDeadlineDate(formatToday()); setDeadlineTime(''); setFromSet(false); setToSet(false); setWaypoints([]);
              fromMarkerRef.current?.remove(); fromMarkerRef.current=null; toMarkerRef.current?.remove(); toMarkerRef.current=null;
              if(map){ if(map.getLayer('route-line-layer')) map.removeLayer('route-line-layer'); if(map.getSource('route-line')) map.removeSource('route-line'); }
            } catch(err){ alert('Failed create task'); }
          }}
          className={`flex-1 py-2 rounded text-white font-semibold ${isValid ? 'bg-purple-700 hover:bg-purple-600' : 'bg-gray-700 cursor-not-allowed opacity-50'}`}
        >
          Buat Tugas
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected([]);
            setDescription("");
            setFrom("");
            setFromCoord("");
            setTo("");
            setToCoord("");
            setDeadlineDate(formatToday());
            setDeadlineTime("");
            setFromSet(false);
            setToSet(false);
            setWaypoints([]);

            // remove markers and route
            fromMarkerRef.current?.remove();
            fromMarkerRef.current = null;
            toMarkerRef.current?.remove();
            toMarkerRef.current = null;
            if(map){
              if(map.getLayer('route-line-layer')) map.removeLayer('route-line-layer');
              if(map.getSource('route-line')) map.removeSource('route-line');
            }
            routeAddedRef.current=false;
          }}
          className="flex-1 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          Bersihkan
        </button>
      </div>
    </div>
  );
};

export default BuatTugas; 