"use client";

import React, { useEffect, useRef, useState } from "react";
import Maps from "@/components/Home/Maps";
import { MapProvider, useMap } from "@/components/Home/MapContext";
// @ts-ignore
import mapboxgl from "mapbox-gl";
// @ts-ignore
import * as turf from "@turf/turf";

// Helper to generate circle polygon (approximation)
const generateCircle = (lng: number, lat: number, radiusMeters: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> => {
  const coords: [number, number][] = [];
  const earthRadius = 6371000; // meters
  const latRad = (lat * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const dLat = (dy / earthRadius) * (180 / Math.PI);
    const dLng = (dx / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);

    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
};

interface Area { lng: number; lat: number; radius: number }

const API_BASE = "";

const AreaLaranganPanel: React.FC = () => {
  const { map } = useMap();
  const [radius, setRadius] = useState<number>(100);
  const [areas, setAreas] = useState<Area[]>([]);
  const addingRef = useRef(false);
  const [keluarJalur, setKeluarJalur] = useState<number>(0);
  const [pinRadius, setPinRadius] = useState<number>(100);

  const effectiveRadius = Math.max(100, pinRadius);

  // ---------------- Sample Route Visualization for Keluar Jalur ----------------
  const routeAddedRef = useRef(false);
  const routeMarkersRef = useRef<{start?:mapboxgl.Marker,end?:mapboxgl.Marker}>({});
  const routeCoordsRef = useRef<{start:[number,number],end:[number,number]}|null>(null);

  useEffect(()=>{
    if(!map) return;

    const SRC_ID = 'keluar-route-src';
    const LAYER_ID = 'keluar-route-layer';
    const BUF_SRC = 'keluar-route-buf-src';
    const BUF_LAYER = 'keluar-route-buf-fill';
    const BUF_OUTLINE = 'keluar-route-buf-outline';

    const removeRoute = ()=>{
      if(map.getLayer(BUF_OUTLINE)) map.removeLayer(BUF_OUTLINE);
      if(map.getLayer(BUF_LAYER)) map.removeLayer(BUF_LAYER);
      if(map.getSource(BUF_SRC)) map.removeSource(BUF_SRC);
      if(map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if(map.getSource(SRC_ID)) map.removeSource(SRC_ID);
      routeAddedRef.current=false;
      routeMarkersRef.current.start?.remove();
      routeMarkersRef.current.end?.remove();
      routeMarkersRef.current={};
      routeCoordsRef.current=null;
    };

    if(keluarJalur<=0){
      removeRoute();
      return;
    }

    // If route already exists, do not regenerate; buffer will update in separate effect
    if(routeCoordsRef.current){
      return;
    }

    // Generate random start & end near map center (once)
    const center = map.getCenter();
    const randOffset = ()=>(Math.random()-0.5)*0.08; // ~±0.04 deg
    const startLat = center.lat + randOffset();
    const startLng = center.lng + randOffset();
    const endLat = center.lat + randOffset();
    const endLng = center.lng + randOffset();

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if(!token){ console.error('MAPBOX token missing'); return; }

    const fetchRoute = async ()=>{
      try{
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&access_token=${token}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('dir');
        const data = await res.json();
        const coords = data.routes?.[0]?.geometry?.coordinates;
        if(!coords) return;

        const geojson = {type:'Feature',geometry:{type:'LineString',coordinates:coords}} as any;
        const bufferPoly = turf.buffer(geojson, keluarJalur, { units: 'meters' });

        if(!map.getSource(SRC_ID)){
          map.addSource(SRC_ID,{type:'geojson',data:geojson});
          map.addLayer({id:LAYER_ID,type:'line',source:SRC_ID,paint:{'line-color':'#3b82f6','line-width':4}});
          map.addSource(BUF_SRC,{type:'geojson',data:bufferPoly});
          map.addLayer({id:BUF_LAYER,type:'fill',source:BUF_SRC,paint:{'fill-color':'#3b82f6','fill-opacity':0.1,'fill-outline-color':'#ef4444'}});
          map.addLayer({id:BUF_OUTLINE,type:'line',source:BUF_SRC,paint:{'line-color':'#ef4444','line-width':2}});
        } else {
          const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource; src.setData(geojson);
          const bufSrc = map.getSource(BUF_SRC) as mapboxgl.GeoJSONSource|undefined; bufSrc?.setData(bufferPoly);
        }

        // markers
        routeMarkersRef.current.start?.remove();
        routeMarkersRef.current.end?.remove();
        routeMarkersRef.current.start = new mapboxgl.Marker({color:'#3b82f6'}).setLngLat([startLng,startLat]).addTo(map);
        routeMarkersRef.current.end = new mapboxgl.Marker({color:'#ef4444'}).setLngLat([endLng,endLat]).addTo(map);

        routeCoordsRef.current = {start:[startLng,startLat], end:[endLng,endLat]};

        if(effectiveRadius>=100){
          const circStart = turf.circle([startLng,startLat], effectiveRadius, {units:'meters', steps:64});
          const circEnd = turf.circle([endLng,endLat], effectiveRadius, {units:'meters', steps:64});

          if(!map.getSource('pin-radius-start')){
            map.addSource('pin-radius-start',{type:'geojson',data:circStart});
            map.addLayer({id:'pin-radius-start-fill',type:'fill',source:'pin-radius-start',paint:{'fill-color':'#a855f7','fill-opacity':0.15,'fill-outline-color':'#a855f7'}});
            map.addLayer({id:'pin-radius-start-outline',type:'line',source:'pin-radius-start',paint:{'line-color':'#a855f7','line-width':2}});
            map.addSource('pin-radius-end',{type:'geojson',data:circEnd});
            map.addLayer({id:'pin-radius-end-fill',type:'fill',source:'pin-radius-end',paint:{'fill-color':'#a855f7','fill-opacity':0.15,'fill-outline-color':'#a855f7'}});
            map.addLayer({id:'pin-radius-end-outline',type:'line',source:'pin-radius-end',paint:{'line-color':'#a855f7','line-width':2}});
          }else{
            (map.getSource('pin-radius-start') as mapboxgl.GeoJSONSource).setData(circStart);
            (map.getSource('pin-radius-end') as mapboxgl.GeoJSONSource).setData(circEnd);
          }
        }

        routeAddedRef.current=true;
      }catch{}
    };

    // ensure style loaded
    if(map.isStyleLoaded()) fetchRoute();
    else { const cb=()=>{fetchRoute();map.off('idle',cb);}; map.on('idle',cb); }

    return ()=>{ removeRoute(); };
  },[keluarJalur,map]);

  // Update pin radius circles when value changes
  useEffect(()=>{
    if(!map) return;
    if(!(effectiveRadius>=100)){
      ['pin-radius-start-fill','pin-radius-end-fill','pin-radius-start-outline','pin-radius-end-outline'].forEach(l=>{if(map.getLayer(l)) map.removeLayer(l);});
      ['pin-radius-start','pin-radius-end'].forEach(s=>{if(map.getSource(s)) map.removeSource(s);});
      return;
    }
    if(!routeCoordsRef.current) return;
    const {start,end} = routeCoordsRef.current;
    const circStart = turf.circle(start, effectiveRadius, {units:'meters',steps:64});
    const circEnd = turf.circle(end, effectiveRadius, {units:'meters',steps:64});

    if(!map.getSource('pin-radius-start')){
      map.addSource('pin-radius-start',{type:'geojson',data:circStart});
      map.addLayer({id:'pin-radius-start-fill',type:'fill',source:'pin-radius-start',paint:{'fill-color':'#a855f7','fill-opacity':0.15,'fill-outline-color':'#a855f7'}});
      map.addLayer({id:'pin-radius-start-outline',type:'line',source:'pin-radius-start',paint:{'line-color':'#a855f7','line-width':2}});
      map.addSource('pin-radius-end',{type:'geojson',data:circEnd});
      map.addLayer({id:'pin-radius-end-fill',type:'fill',source:'pin-radius-end',paint:{'fill-color':'#a855f7','fill-opacity':0.15,'fill-outline-color':'#a855f7'}});
      map.addLayer({id:'pin-radius-end-outline',type:'line',source:'pin-radius-end',paint:{'line-color':'#a855f7','line-width':2}});
    }else{
      (map.getSource('pin-radius-start') as mapboxgl.GeoJSONSource).setData(circStart);
      (map.getSource('pin-radius-end') as mapboxgl.GeoJSONSource).setData(circEnd);
    }
  },[effectiveRadius, keluarJalur, map]);

  // Load existing areas once
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/area-larangan`);
        if (res.ok) {
          const data: Area[] = await res.json();
          setAreas(data);
        }
      } catch {}
    };
    load();
  }, []);

  // Sync map source when areas or map changes
  useEffect(() => {
    if (!map) return;

    const features = areas.map((a) => generateCircle(a.lng, a.lat, a.radius));
    const collection: GeoJSON.FeatureCollection<GeoJSON.Geometry> = { type: "FeatureCollection", features };

    const updateSource = () => {
      if (!map.getSource("restricted-areas")) {
        map.addSource("restricted-areas", { type: "geojson", data: collection });
        map.addLayer({ id: "restricted-fill", type: "fill", source: "restricted-areas", paint: { "fill-color": "#f87171", "fill-opacity": 0.3 } });
        map.addLayer({ id: "restricted-outline", type: "line", source: "restricted-areas", paint: { "line-color": "#ef4444", "line-width": 2 } });
      } else {
        const src = map.getSource("restricted-areas") as mapboxgl.GeoJSONSource;
        src.setData(collection);
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      const onceIdle = () => { updateSource(); map.off("idle", onceIdle); };
      map.on("idle", onceIdle);
    }
  }, [areas, map]);

  // Handle map click when adding new area
  useEffect(() => {
    if (!map) return;
    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (!addingRef.current) return;
      const { lng, lat } = e.lngLat;
      const area: Area = { lng, lat, radius };
      setAreas((prev) => [...prev, area]);
      // Persist to server (fire & forget)
      fetch(`/api/area-larangan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(area) }).catch(() => {});
      addingRef.current = false;
      map.getCanvas().style.cursor = "";
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [map, radius]);

  // Delete area helper
  const deleteArea = async (idx: number) => {
    setAreas((prev) => prev.filter((_, i) => i !== idx));
    try { await fetch(`/api/area-larangan/${idx}`, { method: "DELETE" }); } catch {}
  };

  // Delete all areas
  const clearAll = async () => {
    setAreas([]);
    if (map) {
      const src = map.getSource("restricted-areas") as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features: [] });
    }
    try { await fetch(`/api/area-larangan`, { method: "DELETE" }); } catch {}
  };

  // Load initial value
  useEffect(()=>{
    const fetchVals = async () => {
      try {
        const res1 = await fetch(`/api/keluar-jalur`);
        if(res1.ok){ const data = await res1.json(); setKeluarJalur(Number(data.value)||0); }
        const res2 = await fetch(`/api/target-radius`);
        if(res2.ok){ const d2 = await res2.json(); setPinRadius(Math.max(0,Number(d2.value)||100)); }
      } catch {}
    };
    fetchVals();
  },[]);

  // Auto-save with debounce
  useEffect(()=>{
    const id = setTimeout(()=>{
      fetch(`/api/keluar-jalur`,{method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({value: keluarJalur})}).catch(()=>{});
    },500);
    return ()=>clearTimeout(id);
  },[keluarJalur]);

  // Auto-save pin radius
  useEffect(()=>{
    const id = setTimeout(()=>{
      fetch(`/api/target-radius`,{method:'PUT',headers:{'Content-Type':'application/json'},body: JSON.stringify({value: pinRadius})}).catch(()=>{});
    },500);
    return ()=>clearTimeout(id);
  },[pinRadius]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-purple-400">Area Larangan</h2>

      {/* Radius input */}
      <div>
        <label className="text-sm font-medium text-gray-300">Radius Area (meter)</label>
        <div className="flex items-center gap-2 mt-1">
          <input type="number" min={10} value={radius} onChange={(e) => setRadius(parseInt(e.target.value) || 0)} className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600" />
          <span className="text-gray-400">meter</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button type="button" onClick={() => { if (!map) return; addingRef.current = true; map.getCanvas().style.cursor = "crosshair"; alert("Klik pada peta untuk menentukan pusat area larangan."); }} className="flex-1 py-2 rounded bg-purple-700 hover:bg-purple-600 text-white font-semibold">
          Tambah Area
        </button>
        <button type="button" onClick={clearAll} className="flex-1 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold">
          Hapus Semua Area
        </button>
      </div>

      {/* List of areas */}
      {areas.length > 0 && (
        <div className="flex flex-col gap-2 max-h-60 overflow-auto pr-1">
          {areas.map((a, idx) => (
            <div key={idx} className="flex items-center justify-between bg-gray-800/80 border border-gray-700 rounded px-2 py-1 text-sm">
              <span>#{idx + 1} ({a.lat.toFixed(3)}, {a.lng.toFixed(3)}) – {a.radius}m</span>
              <button onClick={() => deleteArea(idx)} className="text-red-400 hover:text-red-200">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Batas Keluar Jalur ---------------- */}
      <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-purple-800">
        <h3 className="text-md font-semibold text-purple-300">Batas Keluar Jalur</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={keluarJalur}
            onChange={(e)=>setKeluarJalur(parseInt(e.target.value)||0)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <span className="text-gray-400">meter</span>
        </div>
        <p className="text-xs text-gray-500">0 = Off (tidak aktif)</p>
      </div>

      {/* ---------------- Radius Target PinPoint ---------------- */}
      <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-purple-800">
        <h3 className="text-md font-semibold text-purple-300">Radius Target PinPoint</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={pinRadius}
            onChange={e=>{ setPinRadius(parseInt(e.target.value)||0); }}
            onBlur={()=>{ if(pinRadius<100) setPinRadius(100);} }
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <span className="text-gray-400">meter</span>
        </div>
      </div>
    </div>
  );
};

const MappingPage: React.FC = () => {
  return (
    <MapProvider>
      <div className="p-4 flex flex-col md:flex-row gap-4 overflow-auto md:h-screen">
        {/* Left panel - Area Larangan tools */}
        <div className="w-full md:w-[40%] h-auto md:h-full rounded-lg bg-black/50 border border-purple-900 p-4 text-white overflow-auto">
          <AreaLaranganPanel />
        </div>

        {/* Map panel */}
        <div className="w-full md:w-[60%] h-[40vh] md:h-full">
          <Maps />
        </div>
      </div>
    </MapProvider>
  );
};

export default MappingPage; 