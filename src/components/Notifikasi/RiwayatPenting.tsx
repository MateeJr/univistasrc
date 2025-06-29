"use client";
import React, { useState } from "react";
import { FiX } from "react-icons/fi";

interface Notif { 
  deviceId: string; 
  nama: string; 
  timestamp: string; 
  lat?: number; 
  lng?: number; 
  type: string;
  speed?: number;
  durationMin?: number;
}

interface RiwayatPentingProps {
  onClose: () => void;
}

const API_BASE = "http://193.70.34.25:20096";

const formatTs = (ts: string) => {
  const parse = (str: string): Date | null => {
    if (/\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const [datePart, timePart] = str.split(' ');
      const [d, m, y] = datePart.split('/').map(Number);
      const [h, mi] = (timePart || '00:00').split(':').map(Number);
      const dt = new Date(y, m - 1, d, h || 0, mi || 0); 
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(str); 
    return isNaN(dt.getTime()) ? null : dt;
  };
  const d = parse(ts);
  if (!d) return ts;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const RiwayatPenting: React.FC<RiwayatPentingProps> = ({ onClose }) => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [list, setList] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  // Initialize default dates using server time
  React.useEffect(() => {
    const initializeDates = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/server-time`);
        if (res.ok) {
          const { ts } = await res.json();
          const serverDate = new Date(ts);

          // Set toDate to today (server time)
          const today = new Date(serverDate);
          const todayStr = today.toISOString().split('T')[0];

          // Set fromDate to 1 week ago
          const weekAgo = new Date(serverDate);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoStr = weekAgo.toISOString().split('T')[0];

          setFromDate(weekAgoStr);
          setToDate(todayStr);
        }
      } catch (error) {
        // Fallback to local time if server time fails
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        setFromDate(weekAgoStr);
        setToDate(todayStr);
      }
    };

    initializeDates();
  }, []);

  const loadData = async () => {
    if (!fromDate || !toDate) {
      alert("Silakan pilih tanggal dari dan sampai");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      alert("Tanggal dari tidak boleh lebih besar dari tanggal sampai");
      return;
    }

    setLoading(true);
    setHasLoaded(false);
    try {
      const res = await fetch(`${API_BASE}/api/penting-notifs/range?from=${fromDate}&to=${toDate}`);
      if (res.ok) {
        const data: Notif[] = await res.json();
        setList(data);
        setHasLoaded(true);
      } else {
        alert("Gagal memuat data");
      }
    } catch (error) {
      alert("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  const filtered = list.filter(n => {
    if (!search) return true;
    return n.nama?.toLowerCase().includes(search.toLowerCase()) ||
           n.deviceId.toLowerCase().includes(search.toLowerCase());
  });

  const deleteRangeData = async () => {
    if (!fromDate || !toDate) {
      alert("Silakan pilih tanggal dari dan sampai terlebih dahulu");
      return;
    }

    if (!confirm(`Hapus semua notifikasi penting dari ${fromDate} sampai ${toDate}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/penting-notifs/range?from=${fromDate}&to=${toDate}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Berhasil menghapus ${result.deletedCount} notifikasi`);
        setList([]);
        setHasLoaded(false);
      } else {
        alert("Gagal menghapus data");
      }
    } catch (error) {
      alert("Terjadi kesalahan saat menghapus data");
    }
  };

  const getMsg = (n: Notif) => {
    switch(n.type) {
      case 'route': return 'keluar dari jalur yang ditentukan';
      case 'restricted': return 'memasuki area larangan';
      case 'speed': return `melebihi kecepatan (${n.speed || 'N/A'} km/jam)`;
      case 'stop': return `berhenti terlalu lama (${n.durationMin || 'N/A'} menit)`;
      case 'oli': return 'perlu mengganti oli';
      default: return `notifikasi penting (${n.type})`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-purple-900 rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-900">
          <h2 className="text-xl font-semibold">Riwayat Notifikasi Penting</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Date Range Controls */}
        <div className="p-4 border-b border-purple-900">
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-end justify-center">
            <div className="flex flex-col items-center sm:items-start">
              <label className="text-sm text-gray-300 mb-1 text-center sm:text-left">Dari Tanggal:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white w-full sm:w-auto"
              />
            </div>
            <div className="flex flex-col items-center sm:items-start">
              <label className="text-sm text-gray-300 mb-1 text-center sm:text-left">Sampai Tanggal:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white w-full sm:w-auto"
              />
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-medium w-full sm:w-auto mt-2 sm:mt-0"
            >
              {loading ? "Loading..." : "LOAD"}
            </button>
          </div>
        </div>

        {/* Search and Actions */}
        {list.length > 0 && (
          <div className="p-4 border-b border-purple-900">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari driver atau device ID..."
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
              />
              <button
                onClick={deleteRangeData}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-medium whitespace-nowrap"
              >
                Hapus Semua
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {list.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              {loading ? "Memuat data..." : hasLoaded ? "Tidak ditemukan notifikasi untuk rentang tanggal itu" : "Pilih rentang tanggal dan klik LOAD untuk melihat riwayat notifikasi"}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 mb-4">
                Menampilkan {filtered.length} dari {list.length} notifikasi
              </div>
              {filtered.map((n, idx) => {
                const msg = getMsg(n);
                return (
                  <div
                    key={idx}
                    className="bg-gray-800/70 border border-red-600 rounded px-3 py-2 text-sm flex items-center gap-3"
                  >
                    <span className="text-gray-400 text-xs shrink-0 w-40">
                      {formatTs(n.timestamp)}
                    </span>
                    <span className="flex-1">
                      <span className="font-semibold text-red-400 mr-2">{n.nama}</span>
                      {msg}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiwayatPenting;
