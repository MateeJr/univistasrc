import BuatTugas from "@/components/Tugas/BuatTugas";
import Maps from "@/components/Home/Maps";
import { MapProvider } from "@/components/Home/MapContext";

export default function BuatTugasPage() {
  return (
    <MapProvider>
      <div className="p-4 flex flex-col md:flex-row gap-4 overflow-auto md:h-screen">
        {/* Form panel */}
        <div className="w-full md:w-[40%] h-auto md:h-full">
          <BuatTugas />
        </div>

        {/* Map panel */}
        <div className="w-full md:w-[60%] h-[40vh] md:h-full">
          <Maps showTraffic />
        </div>
      </div>
    </MapProvider>
  );
} 