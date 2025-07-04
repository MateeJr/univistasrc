"use client";

import React, { useState, FormEvent } from "react";

interface AddDriverProps {
  open: boolean;
  onClose: () => void;
}

const AddDriver: React.FC<AddDriverProps> = ({ open, onClose }) => {
  const [nama, setNama] = useState("");
  const [bk, setBk] = useState("");
  const [icon, setIcon] = useState("");
  const [otp, setOtp] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nama || !bk || !icon || !otp) return;
    try {
      const res = await fetch('/api/add-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, bk, icon, otp }),
      });
      if (res.ok) {
        onClose();
      } else {
        const txt = await res.text();
        alert(txt === 'OTP_NOT_FOUND' ? 'Tidak Ditemukan, Silahkan buat kode OTP Di App terlebih dahulu.' : 'Gagal menambah driver');
      }
    } catch (err) {
      alert('Gagal terhubung ke server');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-11/12 max-w-md rounded-xl bg-gray-950 p-6 shadow-2xl border border-gray-800">
        <h2 className="mb-4 text-xl font-semibold text-center text-white">Tambah Driver</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300 text-left">Nama Driver:</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Isi nama Driver disini"
              className="w-full rounded border border-gray-700 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300 text-left">BK Driver:</label>
            <input
              type="text"
              value={bk}
              onChange={(e) => setBk(e.target.value)}
              placeholder="Isi Plat Nomor Mobil disini"
              className="w-full rounded border border-gray-700 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300 text-left">Icon Driver:</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              required
            >
              <option value="">Pilih Icon Driver</option>
              <option value="Sepeda Motor">Sepeda Motor</option>
              <option value="Mobil">Mobil</option>
              <option value="Mobil Kecil">Mobil Kecil</option>
              <option value="Truk">Truk</option>
              <option value="Truk Besar">Truk Besar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300 text-left">Kode OTP HP Driver:</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Isi 6 digit kode OTP Dari App Driver"
              className="w-full rounded border border-gray-700 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              required
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-md bg-purple-700 px-4 py-2 text-sm text-white hover:bg-purple-800"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDriver; 