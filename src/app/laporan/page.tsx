import LaporanComponent from "@/components/Laporan/Laporan";

export default function LaporanPage() {
  return (
    <div className="p-4 min-h-screen flex items-stretch justify-center overflow-auto md:h-screen">
      <div className="w-full h-[calc(100vh-56px)] md:h-full">
        <LaporanComponent />
      </div>
    </div>
  );
} 