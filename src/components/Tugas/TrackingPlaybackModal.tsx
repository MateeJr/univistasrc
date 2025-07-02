"use client";

import React, { useEffect, useState, useRef } from "react";
import { getIconPath, scaledSize } from "@/utils/iconUtil";
import { FaTimes, FaPlay, FaPause, FaFastForward, FaFastBackward } from "react-icons/fa";
import mapboxgl from "mapbox-gl";
import { circle } from "@turf/circle";

interface Task {
  id: string;
  description: string;
  from: string;
  to: string;
  fromCoord?: string;
  toCoord?: string;
  drivers?: string[];
  track?: Array<{ lng: number; lat: number; ts: number }>;
  waypoints?: Array<{ lng: number; lat: number }>;
  travelReq?: {
    areaLarangan?: boolean;
    keluarJalur?: boolean;
    pinRadius?: boolean;
  };
  targetRadius?: number;
}

interface Account {
  deviceId: string;
  nama: string;
  bk: string;
  icon?: string;
}

interface TrackingPlaybackModalProps {
  task: Task;
  accounts: Record<string, Account>;
  onClose: () => void;
}

const TrackingPlaybackModal: React.FC<TrackingPlaybackModalProps> = ({
  task,
  accounts,
  onClose,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const truckMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationRef = useRef<number | null>(null);

  // Time range states
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [filteredTrack, setFilteredTrack] = useState<Array<{ lng: number; lat: number; ts: number }>>([]);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Areas state for restricted zones
  const [areas, setAreas] = useState<Array<{ lng: number; lat: number; radius: number }>>([]);

  // Route geometry state
  const [routeGeo, setRouteGeo] = useState<any>(null);

  // Map loaded state
  const [mapLoaded, setMapLoaded] = useState(false);

  // Server time offset for accurate timezone handling
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const fromLL = task.fromCoord?.includes(',') ? task.fromCoord.split(',').map(Number) as [number, number] : null;
  const toLL = task.toCoord?.includes(',') ? task.toCoord.split(',').map(Number) as [number, number] : null;
  const waypoints = task.waypoints || [];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    
    if (!mapboxgl.accessToken) {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: fromLL ? [fromLL[1], fromLL[0]] : [98.6785, 3.597],
      zoom: 11,
    });

    // Hide Mapbox logo
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `.mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{display:none !important}`;
    document.head.appendChild(styleEl);

    // Wait for map to load before adding sources and layers
    mapRef.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add markers for start and end points
    if (fromLL) {
      new mapboxgl.Marker({ color: '#3b82f6' }).setLngLat([fromLL[1], fromLL[0]]).addTo(mapRef.current);
    }
    if (toLL) {
      new mapboxgl.Marker({ color: '#ef4444' }).setLngLat([toLL[1], toLL[0]]).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Load restricted areas and sync server time
  useEffect(() => {
    const loadAreas = async () => {
      if (!task.travelReq?.areaLarangan) return;
      try {
        const res = await fetch('/api/areas');
        if (res.ok) {
          const data = await res.json();
          setAreas(data);
        }
      } catch {}
    };

    const syncServerTime = async () => {
      try {
        const res = await fetch('/api/server-time');
        if (res.ok) {
          const data = await res.json();
          const serverTime = data.ts;
          const clientTime = Date.now();
          setServerTimeOffset(serverTime - clientTime);
        }
      } catch {}
    };

    loadAreas();
    syncServerTime();
  }, [task.id]);

  // Helper function to format timestamp to Indonesian timezone datetime-local format
  const formatToLocalDateTime = (timestamp: number): string => {
    // Create a date object and format it for Jakarta timezone
    const date = new Date(timestamp);

    // Use Intl.DateTimeFormat to get proper Jakarta timezone formatting
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // Helper function to format timestamp for display using server timezone
  const formatDisplayTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace(/\./g, ':');
  };

  // Initialize time range with track data
  useEffect(() => {
    if (task.track && task.track.length > 0) {
      const sortedTrack = [...task.track].sort((a, b) => a.ts - b.ts);
      const startTs = sortedTrack[0].ts;
      const endTs = sortedTrack[sortedTrack.length - 1].ts;

      setStartTime(formatToLocalDateTime(startTs));
      setEndTime(formatToLocalDateTime(endTs));
      setFilteredTrack(sortedTrack);
    }
  }, [task.track]);

  // Helper function to convert datetime-local input to timestamp in Jakarta timezone
  const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
    // Parse the datetime-local string as if it's in Jakarta timezone
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    // Create a date object representing this time in Jakarta
    // We'll create it in UTC then adjust for Jakarta offset
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    // Jakarta is UTC+7, so we subtract 7 hours to get the UTC timestamp
    // that represents this local Jakarta time
    return utcDate.getTime() - (7 * 60 * 60 * 1000);
  };

  // Filter track data based on time range
  useEffect(() => {
    if (!task.track || !startTime || !endTime) return;

    const startTs = datetimeLocalToTimestamp(startTime);
    const endTs = datetimeLocalToTimestamp(endTime);

    const filtered = task.track
      .filter(point => point.ts >= startTs && point.ts <= endTs)
      .sort((a, b) => a.ts - b.ts);

    setFilteredTrack(filtered);
    setCurrentIndex(0);
    setProgress(0);
  }, [startTime, endTime, task.track]);

  // Fetch route geometry
  useEffect(() => {
    const fetchRoute = async () => {
      if (!fromLL || !toLL) return;
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const coordsArr = [[fromLL[1], fromLL[0]], ...waypoints.map(w => [w.lng, w.lat]), [toLL[1], toLL[0]]];
        const coordsStr = coordsArr.map(c => c.join(',')).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${token}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRouteGeo(data.routes[0].geometry);
        }
      } catch {}
    };
    fetchRoute();
  }, [task.id, waypoints]);

  // Draw route and track on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Draw planned route (blue line)
    if (routeGeo) {
      try {
        const srcId = 'route-src';
        const layerId = 'route-layer';
        if (map.getSource(srcId)) {
          (map.getSource(srcId) as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            geometry: routeGeo
          } as any);
        } else {
          map.addSource(srcId, {
            type: 'geojson',
            data: { type: 'Feature', geometry: routeGeo } as any
          });
          map.addLayer({
            id: layerId,
            type: 'line',
            source: srcId,
            paint: { 'line-color': '#3b82f6', 'line-width': 4 }
          });
        }
      } catch (error) {
        console.error('Error adding route layer:', error);
      }
    }

    // Draw filtered track (purple line)
    if (filteredTrack.length >= 2) {
      try {
        const trackCoords = filteredTrack.map(p => [p.lng, p.lat]);
        const trackSrcId = 'track-src';
        const trackLayerId = 'track-layer';
        const gj = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trackCoords }
        } as any;

        if (map.getSource(trackSrcId)) {
          (map.getSource(trackSrcId) as mapboxgl.GeoJSONSource).setData(gj);
        } else {
          map.addSource(trackSrcId, { type: 'geojson', data: gj });
          map.addLayer({
            id: trackLayerId,
            type: 'line',
            source: trackSrcId,
            paint: { 'line-color': '#a855f7', 'line-width': 3, 'line-dasharray': [1, 1] }
          });
        }
      } catch (error) {
        console.error('Error adding track layer:', error);
      }
    }

    // Draw restricted areas
    if (task.travelReq?.areaLarangan && areas.length) {
      try {
        const SRC = 'modal-restrict';
        const FILL = 'modal-restrict-fill';
        const OUT = 'modal-restrict-out';
        const fc: any = {
          type: 'FeatureCollection',
          features: areas.map(a => ({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [circle([a.lng, a.lat], a.radius, { units: 'meters', steps: 64 }).geometry.coordinates[0]]
            }
          }))
        };

        if (!map.getSource(SRC)) {
          map.addSource(SRC, { type: 'geojson', data: fc });
          map.addLayer({ id: FILL, type: 'fill', source: SRC, paint: { 'fill-color': '#f87171', 'fill-opacity': 0.2 } });
          map.addLayer({ id: OUT, type: 'line', source: SRC, paint: { 'line-color': '#ef4444', 'line-width': 2 } });
        }
      } catch (error) {
        console.error('Error adding restricted areas:', error);
      }
    }

    // Draw pin radius circles
    const addCircle = (coordStr: string, id: string) => {
      if (!(task.travelReq?.pinRadius && task.targetRadius && task.targetRadius >= 100 && coordStr.includes(','))) return;
      try {
        const [latStr, lngStr] = coordStr.split(',');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        const circ = circle([lng, lat], task.targetRadius, { units: 'meters', steps: 64 });
        if (!map.getSource(id)) {
          map.addSource(id, { type: 'geojson', data: circ as any });
          map.addLayer({ id: id + '-fill', type: 'fill', source: id, paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.15 } });
          map.addLayer({ id: id + '-out', type: 'line', source: id, paint: { 'line-color': '#a855f7', 'line-width': 2 } });
        }
      } catch (error) {
        console.error('Error adding pin circle:', error);
      }
    };
    addCircle(task.fromCoord || '', 'modal-pin-start');
    addCircle(task.toCoord || '', 'modal-pin-end');

    // Auto-fit map bounds to show the track
    if (filteredTrack.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredTrack.forEach(point => bounds.extend([point.lng, point.lat]));
      if (fromLL) bounds.extend([fromLL[1], fromLL[0]]);
      if (toLL) bounds.extend([toLL[1], toLL[0]]);
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [routeGeo, filteredTrack, areas, mapLoaded]);

  // Update truck marker position whenever currentIndex changes (for real-time scrubbing)
  useEffect(() => {
    if (filteredTrack.length === 0 || !mapRef.current) return;

    const currentPoint = filteredTrack[currentIndex];
    if (!currentPoint) return;

    const iconLabel = accounts[task.drivers?.[0] || ""]?.icon;
    const size = scaledSize(32, iconLabel);

    if (!truckMarkerRef.current) {
      const img = document.createElement("img");
      img.src = getIconPath(iconLabel);
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      truckMarkerRef.current = new mapboxgl.Marker({ element: img, anchor: "center" })
        .setLngLat([currentPoint.lng, currentPoint.lat])
        .addTo(mapRef.current!);
    } else {
      truckMarkerRef.current.setLngLat([currentPoint.lng, currentPoint.lat]);
    }
  }, [currentIndex, filteredTrack]);

  // Animation logic
  useEffect(() => {
    if (!isPlaying || filteredTrack.length === 0 || !mapRef.current || isDragging) return;

    const animate = () => {
      if (currentIndex >= filteredTrack.length - 1) {
        setIsPlaying(false);
        return;
      }

      const nextIndex = currentIndex + 1;

      // Update progress and index - truck marker will be updated by the effect above
      const newProgress = ((nextIndex) / (filteredTrack.length - 1)) * 100;
      setProgress(newProgress);
      setCurrentIndex(nextIndex);

      // Schedule next frame based on playback speed
      const baseDelay = 500; // Base delay in ms
      const delay = baseDelay / playbackSpeed;
      animationRef.current = window.setTimeout(animate, delay);
    };

    animationRef.current = window.setTimeout(animate, 100);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, currentIndex, filteredTrack, playbackSpeed, isDragging]);

  // Reset animation when track changes
  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
    setIsPlaying(false);

    // Remove existing truck marker
    if (truckMarkerRef.current) {
      truckMarkerRef.current.remove();
      truckMarkerRef.current = null;
    }
  }, [filteredTrack]);

  // Helper function to update position based on mouse/touch position
  const updatePositionFromEvent = (clientX: number, progressBarElement: HTMLElement) => {
    if (filteredTrack.length === 0) return;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const newIndex = Math.floor((percentage / 100) * (filteredTrack.length - 1));
    const clampedIndex = Math.max(0, Math.min(newIndex, filteredTrack.length - 1));
    const actualProgress = (clampedIndex / (filteredTrack.length - 1)) * 100;

    setCurrentIndex(clampedIndex);
    setProgress(actualProgress);
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (filteredTrack.length === 0) return;
    setIsDragging(true);
    setIsPlaying(false); // Pause playback when dragging
    updatePositionFromEvent(e.clientX, e.currentTarget);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const progressBar = document.querySelector('.progress-bar') as HTMLElement;
    if (progressBar) {
      updatePositionFromEvent(e.clientX, progressBar);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, filteredTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      if (truckMarkerRef.current) {
        truckMarkerRef.current.remove();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Tracking Playback - {task.description}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Time Range Controls */}
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center overflow-x-auto">
            <div className="flex items-center gap-2">
              <label className="text-white text-xs sm:text-sm break-words">From:</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-2 py-1 rounded bg-gray-700 text-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white text-xs sm:text-sm break-words">To:</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-2 py-1 rounded bg-gray-700 text-white text-sm"
              />
            </div>
            <div className="text-white text-xs sm:text-sm break-words">
              Track Points: {filteredTrack.length}
            </div>
            {filteredTrack.length > 0 ? (
              <>
                <div className="text-white text-xs sm:text-sm break-words">
                  Duration: {(() => {
                    const durationMs = filteredTrack[filteredTrack.length - 1]?.ts - filteredTrack[0]?.ts;
                    const totalSeconds = Math.floor(durationMs / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;

                    const parts: string[] = [];
                    if (hours > 0) parts.push(`${hours} Jam`);
                    if (minutes > 0) parts.push(`${minutes} Menit`);
                    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} Detik`);

                    return parts.join(' ');
                  })()}
                </div>
                <div className="text-gray-300 text-xs">
                  Range: {formatDisplayTime(filteredTrack[0].ts)} - {formatDisplayTime(filteredTrack[filteredTrack.length - 1].ts)}
                </div>
                <div className="text-gray-400 text-xs hidden md:block">
                  Debug: Start={startTime}, End={endTime}
                </div>
              </>
            ) : (
              <div className="text-yellow-400 text-sm">
                No tracking data available for selected time range
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />
          {!mapLoaded && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-white text-lg">Loading map...</div>
            </div>
          )}
        </div>

        {/* Playback Controls */}
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex flex-col gap-3">
            {/* Progress Bar */}
            <div
              className="progress-bar w-full bg-gray-600 rounded-full h-2 cursor-pointer select-none relative"
              onMouseDown={handleMouseDown}
              onClick={(e) => {
                if (!isDragging) {
                  updatePositionFromEvent(e.clientX, e.currentTarget);
                  setIsPlaying(false);
                }
              }}
            >
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-200 pointer-events-none relative"
                style={{ width: `${progress}%` }}
              >
                {/* Scrubber handle */}
                <div
                  className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full shadow-lg cursor-pointer"
                  style={{
                    opacity: filteredTrack.length > 0 ? 1 : 0,
                    transition: 'opacity 0.2s'
                  }}
                />
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                title="Reset to Start"
                disabled={filteredTrack.length === 0}
              >
                ⏮
              </button>

              <button
                onClick={() => setPlaybackSpeed(Math.max(0.25, playbackSpeed - 0.25))}
                className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                title="Slower"
              >
                <FaFastBackward size={16} />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 rounded bg-purple-600 hover:bg-purple-500 text-white"
                disabled={filteredTrack.length === 0}
              >
                {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
              </button>

              <button
                onClick={() => setPlaybackSpeed(Math.min(4, playbackSpeed + 0.25))}
                className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                title="Faster"
              >
                <FaFastForward size={16} />
              </button>

              <button
                onClick={() => {
                  setCurrentIndex(filteredTrack.length - 1);
                  setProgress(100);
                  setIsPlaying(false);
                }}
                className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                title="Jump to End"
                disabled={filteredTrack.length === 0}
              >
                ⏭
              </button>

              <div className="text-white text-xs sm:text-sm break-words">
                Speed: {playbackSpeed}x
              </div>

              <div className="text-white text-xs sm:text-sm break-words">
                {currentIndex + 1} / {filteredTrack.length}
              </div>

              {filteredTrack[currentIndex] && (
                <div className="text-white text-xs sm:text-sm break-words">
                  Time: {formatDisplayTime(filteredTrack[currentIndex].ts)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPlaybackModal;
