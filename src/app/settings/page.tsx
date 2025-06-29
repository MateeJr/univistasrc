import SettingsComponent from "@/components/Settings/Settings";

export default function SettingsPage() {
  return (
    <div className="p-4 min-h-screen flex items-stretch justify-center overflow-auto md:h-screen">
      <div className="w-full h-[calc(100vh-56px)] md:h-full">
        <SettingsComponent />
      </div>
    </div>
  );
} 