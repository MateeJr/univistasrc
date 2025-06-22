import React from "react";
import NotifStatus from "./NotifStatus";
import NotifPenting from "./NotifPenting";
import NotifTambahan from "./NotifTambahan";

const Notifikasi: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row gap-4 overflow-auto md:h-full">
      {/* Status */}
      <div className="w-full md:w-1/3 h-[40vh] md:h-full">
        <NotifStatus />
      </div>
      {/* Penting */}
      <div className="w-full md:w-1/3 h-[40vh] md:h-full">
        <NotifPenting />
      </div>
      {/* Tambahan */}
      <div className="w-full md:w-1/3 h-[40vh] md:h-full">
        <NotifTambahan />
      </div>
    </div>
  );
};

export default Notifikasi;
