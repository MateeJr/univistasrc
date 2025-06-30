"use client";
import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";

interface TambahanNotif {
  taskId?: string;
  description?: string;
  drivers?: string[];
  kind?: string;
  deviceId?: string;
  nama?: string;
  title?: string;
  type?: string;
  timestamp: string;
}

interface RiwayatTambahanProps {
  onClose: () => void;
}

const API_BASE = "";

const formatTs = (ts: string) => {
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return ts;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const RiwayatTambahan: React.FC<RiwayatTambahanProps> = ({ onClose }) => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [list, setList] = useState<TambahanNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<Record<string, { deviceId: string; nama: string; bk: string }>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load accounts and initialize dates on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/accounts`);
        if (res.ok) {
          const list: { deviceId: string; nama: string; bk: string }[] = await res.json();
          const map: Record<string, { deviceId: string; nama: string; bk: string }> = {};
          list.forEach(a => (map[a.deviceId] = a));
          setAccounts(map);
        }
      } catch {}
    };

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

    fetchAccounts();
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
      const res = await fetch(`${API_BASE}/api/tambahan-notifs/range?from=${fromDate}&to=${toDate}`);
      if (res.ok) {
        const data: TambahanNotif[] = await res.json();
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

  const driverNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return '';
    const names = ids.map(id => accounts[id]?.nama || id);
    return names.join(', ');
  };

  const namaDriver = (deviceId?: string, nama?: string) => {
    if (nama) return nama;
    if (!deviceId) return '';
    return accounts[deviceId]?.nama || deviceId;
  };

  const filtered = list.filter(n => {
    if (!search) return true;
    const msgParts = [n.description, n.taskId, ...(n.drivers || [])].join(' ').toLowerCase();
    const driverStr = driverNames(n.drivers).toLowerCase();
    return msgParts.includes(search.toLowerCase()) || driverStr.includes(search.toLowerCase());
  });

  const deleteRangeData = async () => {
    if (!fromDate || !toDate) {
      alert("Silakan pilih tanggal dari dan sampai terlebih dahulu");
      return;
    }

    if (!confirm(`Hapus semua notifikasi tambahan dari ${fromDate} sampai ${toDate}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tambahan-notifs/range?from=${fromDate}&to=${toDate}`, {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-purple-900 rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-900">
          <h2 className="text-xl font-semibold">Riwayat Notifikasi Tambahan</h2>
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
                placeholder="Cari driver, tugas, atau laporan..."
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
                const keyId = n.taskId || n.deviceId || idx;
                const rowBase = idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900';
                
                let content: React.ReactNode;
                if (n.deviceId) { // laporan
                  const nama = namaDriver(n.deviceId, n.nama);
                  content = (
                    <span className="flex-1">
                      <span className="font-semibold text-purple-400 mr-2">{nama}</span>
                      mengirim laporan <span className="font-semibold">{n.title || n.type || '-'}</span>
                    </span>
                  );
                } else { // task completion
                  content = (
                    <span className="flex-1">
                      <span className="font-semibold text-purple-400 mr-2">{driverNames(n.drivers)}</span>
                      telah menyelesaikan tugas <span className="font-semibold">{n.description || '-'}</span>
                    </span>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`${rowBase} border-t border-gray-700 hover:bg-gray-700 px-3 py-2 text-sm flex items-center gap-3`}
                  >
                    <span className="text-gray-400 text-xs shrink-0 w-40">
                      {formatTs(n.timestamp)}
                    </span>
                    {content}
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

export default RiwayatTambahan;
