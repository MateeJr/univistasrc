"use client";

import React, { createContext, useContext, useState } from "react";
// @ts-ignore
import mapboxgl from "mapbox-gl";

interface Ctx {
  map: mapboxgl.Map | null;
  setMap: (m: mapboxgl.Map | null) => void;
  lastPos: [number, number] | null;
  setLastPos: (p: [number, number] | null) => void;
  styleIdx: number;
  setStyleIdx: (idx: number) => void;
}

const MapContext = createContext<Ctx>({ map: null, setMap: () => {}, lastPos: null, setLastPos: () => {}, styleIdx: 0, setStyleIdx: () => {} });

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [lastPos, setLastPos] = useState<[number, number] | null>(null);
  const [styleIdx, setStyleIdx] = useState(0);
  return <MapContext.Provider value={{ map, setMap, lastPos, setLastPos, styleIdx, setStyleIdx }}>{children}</MapContext.Provider>;
};

export const useMap = () => useContext(MapContext); 