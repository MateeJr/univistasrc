"use client";

import BuatTugas, { BuatTugasHandle, FavData } from "@/components/Tugas/BuatTugas";
import Favorite from "@/components/Tugas/Favorite";
import Maps from "@/components/Home/Maps";
import { MapProvider } from "@/components/Home/MapContext";

import React, { useRef, useState } from "react";

export default function BuatTugasPage() {
  const buatRef = useRef<BuatTugasHandle>(null);
  const [favRefresh, setFavRefresh] = useState(0);

  const handleFavSelect = (fav: FavData) => {
    buatRef.current?.loadFavorite(fav);
  };

  const handleFavSaved = () => {
    setFavRefresh(Date.now());
  };

  return (
    <MapProvider>
      <div className="p-4 flex flex-col md:flex-row gap-4 overflow-auto md:h-screen">
        {/* Form panel */}
        <div className="w-full md:w-[40%] h-auto md:h-full">
          <BuatTugas ref={buatRef} onFavoriteSaved={handleFavSaved} />
        </div>

        {/* Map + Favorite panel */}
        <div className="w-full md:w-[60%] flex flex-col h-[60vh] md:h-full gap-2">
          <div className="flex-[3] min-h-[200px]">
            <Maps showTraffic />
          </div>
          <div className="flex-[2] overflow-auto">
            <Favorite onSelect={handleFavSelect} refreshTrigger={favRefresh} />
          </div>
        </div>
      </div>
    </MapProvider>
  );
} 