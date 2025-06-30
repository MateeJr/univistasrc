"use client";

import React, { useEffect, useRef } from "react";
import { FiCrosshair, FiPlus, FiMinus } from "react-icons/fi";
// @ts-ignore - mapbox-gl types may be missing in strict environment
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "@/components/Home/MapContext";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Props { selected?: string; showTraffic?: boolean }

const Maps: React.FC<Props> = ({ selected, showTraffic }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { setMap, map, lastPos, styleIdx } = useMap();

  // Store markers for MASTER view
  const masterMarkers = useRef<Record<string, mapboxgl.Marker>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      console.error("Mapbox token not set – define NEXT_PUBLIC_MAPBOX_TOKEN in .env.local");
      return;
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: showTraffic ? "mapbox://styles/mapbox/traffic-day-v2" : "mapbox://styles/mapbox/streets-v12",
      center: [98.6785, 3.597],
      zoom: 11,
      attributionControl: false,
    });

    // Hide Mapbox logo
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `.mapboxgl-ctrl-logo{display:none !important}`;
    document.head.appendChild(styleEl);

    // Add default zoom controls
    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-left');

    setMap(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [showTraffic]);

  // Handle MASTER view (show all online drivers)
  useEffect(() => {
    if (selected !== "MASTER") {
      // Leaving master – clean up
      Object.values(masterMarkers.current).forEach((m) => m.remove());
      masterMarkers.current = {};
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const fetchAll = async () => {
      if (!map) return;
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const accounts = await res.json();

        for (const acc of accounts) {
          const detailRes = await fetch(`/api/accounts/${acc.deviceId}`);
          if (!detailRes.ok) continue;
          const detail = await detailRes.json();

          // Online if updated within 2 minutes
          const last = detail.track?.timestampMs ?? (detail.track?.lastUpdated ? Date.parse(detail.track.lastUpdated.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")) : 0);
          const diffMin = (Date.now() - last) / 60000;
          if (diffMin >= 2) {
            // Remove outdated marker
            if (masterMarkers.current[acc.deviceId]) {
              masterMarkers.current[acc.deviceId].remove();
              delete masterMarkers.current[acc.deviceId];
            }
            continue;
          }

          const lat = detail.track?.latitude;
          const lon = detail.track?.longitude;
          if (lat == null || lon == null) continue;

          let marker = masterMarkers.current[acc.deviceId];
          if (!marker) {
            // Marker element: 32x32 icon with a label absolutely positioned above it.
            const el = document.createElement("div");
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.style.pointerEvents = 'none';
            el.innerHTML = `
              <span style="background:rgba(0,0,0,0.6);color:white;padding:2px 6px;border-radius:6px;font-size:11px;white-space:nowrap;text-shadow:0 0 2px black;margin-bottom:2px;">${acc.nama}</span>
              <img src='/truck.png' style='width:32px;height:32px;${styleIdx===2?"filter:invert(1);":""}' />
            `;
            marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([lon, lat])
              .addTo(map);
            masterMarkers.current[acc.deviceId] = marker;
          } else {
            marker.setLngLat([lon, lat]);
          }
        }
      } catch {}
    };

    fetchAll();
    intervalRef.current = setInterval(fetchAll, 5000);

    return () => {
      Object.values(masterMarkers.current).forEach((m) => m.remove());
      masterMarkers.current = {};
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selected, map, styleIdx]);

  return (
    <div className="h-full rounded-lg border border-purple-900 overflow-hidden relative">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Mobile refocus button */}
      <button
        onClick={() => {
          if (!map) return;
          if (lastPos) {
            map.flyTo({ center: lastPos, zoom: 14 });
          } else {
            map.flyTo({ center: [98.6785, 3.597], zoom: 11 });
          }
        }}
        className="absolute bottom-3 right-3 bg-purple-700 hover:bg-purple-600 text-white rounded-full p-3 shadow-lg"
        title="Refocus"
      >
        <FiCrosshair size={20} />
      </button>
      {/* Custom Zoom Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <button
          onClick={() => map?.zoomIn()}
          className="w-10 h-10 flex items-center justify-center bg-purple-800/80 hover:bg-purple-700 backdrop-blur-sm text-white rounded-full shadow-lg border border-purple-600"
          title="Zoom In"
        >
          <FiPlus />
        </button>
        <button
          onClick={() => map?.zoomOut()}
          className="w-10 h-10 flex items-center justify-center bg-purple-800/80 hover:bg-purple-700 backdrop-blur-sm text-white rounded-full shadow-lg border border-purple-600"
          title="Zoom Out"
        >
          <FiMinus />
        </button>
      </div>
    </div>
  );
};

export default Maps; 