import NotifikasiComponent from "@/components/Notifikasi/Notifikasi";

export default function NotifikasiPage() {
  return (
    <div className="p-4 min-h-screen flex items-stretch justify-center overflow-auto md:h-screen">
      <div className="w-full h-[calc(100vh-56px)] md:h-full">
        <NotifikasiComponent />
      </div>
    </div>
  );
}
