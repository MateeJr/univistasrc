"use client";

import React from "react";

interface Props {
  open: boolean;
  driverName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDelete: React.FC<Props> = ({ open, driverName, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-11/12 max-w-sm rounded-xl bg-gray-950 p-6 shadow-2xl border border-gray-800 text-center">
        <h2 className="text-white text-lg font-semibold mb-4">Hapus Driver</h2>
        <p className="text-gray-300 mb-6">Apakah Anda yakin ingin menghapus driver <span className="font-semibold text-white">{driverName}</span>?</p>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-700" onClick={onCancel}>Batal</button>
          <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>Hapus</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDelete; 