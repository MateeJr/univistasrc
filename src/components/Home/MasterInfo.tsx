"use client";

import React, { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import DriverInfo from "@/components/Home/DriverInfo";

interface Account { deviceId: string; nama: string; bk: string; }

interface MasterInfoProps { onBack: () => void }

const MasterInfo: React.FC<MasterInfoProps> = ({ onBack }) => {
  const [drivers, setDrivers] = useState<Account[]>([]);

  // Fetch list of all drivers periodically (every 10 seconds)
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await fetch("http://193.70.34.25:20096/api/accounts");
        if (res.ok) {
          const data = await res.json();
          setDrivers(data);
        }
      } catch {
        // ignore
      }
    };

    fetchDrivers();
    const id = setInterval(fetchDrivers, 10000);
    return () => clearInterval(id);
  }, []);

  if (drivers.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white">
        Memuat daftar driver...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="mb-2">
        <button
          onClick={onBack}
          className="bg-purple-700 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded flex items-center gap-2"
        >
          <FiArrowLeft size={18}/> Back
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
      {drivers.map((d) => (
        <DriverInfo key={d.deviceId} deviceId={d.deviceId} />
      ))}
          </div>
    </div>
  );
};

export default MasterInfo;
