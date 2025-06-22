import TugasAktif from "@/components/Tugas/TugasAktif";
import TugasSelesai from "@/components/Tugas/TugasSelesai";

export default function TugasPage() {
  return (
    <div className="p-4 flex flex-col md:flex-row gap-4 overflow-auto md:h-screen">
      {/* TugasAktif - 50% on desktop */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full">
        <TugasAktif />
      </div>

      {/* TugasSelesai - 50% on desktop */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full">
        <TugasSelesai />
      </div>
    </div>
  );
} 