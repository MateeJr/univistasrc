"use client";

import { MapProvider } from "@/components/Home/MapContext";
import DriverList from "@/components/Home/DriverList";
import Maps from "@/components/Home/Maps";
import DriverInfo from "@/components/Home/DriverInfo";
import Controller from "@/components/Home/Controller";

import { useState } from "react";

import MasterInfo from "@/components/Home/MasterInfo";

export default function Home() {
  // Default to "MASTER" so that the app opens in MASTER view
  const [selected, setSelected] = useState<string | undefined>('MASTER');

  const handleDeleted = (id: string) => {
    if (selected === id) setSelected(undefined);
  };

  if (selected === 'MASTER_INFO') {
    return (
      <MapProvider>
        <div className="p-4 h-full w-full overflow-hidden">
          <MasterInfo onBack={() => setSelected('MASTER')} />
        </div>
      </MapProvider>
    );
  }

  return (
    <MapProvider>
      <div className="p-4 flex flex-col md:flex-row gap-4 overflow-auto md:h-screen">
        {/* DriverList panel - 20% on desktop, full width on mobile */}
        <div className="w-full md:w-[20%] h-[30vh] md:h-full">
          <DriverList onSelect={setSelected} selectedId={selected} onDeleted={handleDeleted} />
        </div>

        {/* Maps panel - 50% on desktop, full width on mobile */}
        <div className="w-full md:w-[50%] h-[40vh] md:h-full">
          <Maps selected={selected} />
        </div>

        {/* Wrapper column for DriverInfo + Controller on desktop */}
        <div className="w-full md:w-[30%] flex flex-col gap-4 md:h-full">
          {/* Controller hidden on mobile, lower position on desktop */}
          <div className="hidden md:block w-full order-3 md:order-2 md:h-[40%]">
            <Controller selected={selected} />
          </div>
          <div className="w-full order-4 md:order-1 h-[60vh] md:h-[60%]">
            <DriverInfo deviceId={selected} />
          </div>
        </div>
      </div>
    </MapProvider>
  );
} 