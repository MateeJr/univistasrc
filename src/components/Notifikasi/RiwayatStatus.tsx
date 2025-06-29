"use client";
import React, { useState } from "react";
import { FiX, FiInfo } from "react-icons/fi";

interface StatusNotif {
  type: 'status' | 'gps' | 'battery';
  deviceId: string;
  nama: string;
  from?: string;
  to?: string;
  level?: number;
  timestamp: string;
}

interface RiwayatStatusProps {
  onClose: () => void;
}

const API_BASE = "http://193.70.34.25:20096";

const RiwayatStatus: React.FC<RiwayatStatusProps> = ({ onClose }) => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [list, setList] = useState<StatusNotif[]>([]);
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
      const res = await fetch(`${API_BASE}/api/status-notifs/range?from=${fromDate}&to=${toDate}`);
      if (res.ok) {
        const data: StatusNotif[] = await res.json();
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
    const msgParts = [n.nama, n.deviceId, n.from, n.to, n.type].join(' ').toLowerCase();
    return msgParts.includes(search.toLowerCase());
  });

  const deleteRangeData = async () => {
    if (!fromDate || !toDate) {
      alert("Silakan pilih tanggal dari dan sampai terlebih dahulu");
      return;
    }

    if (!confirm(`Hapus semua notifikasi status dari ${fromDate} sampai ${toDate}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/status-notifs/range?from=${fromDate}&to=${toDate}`, {
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

  const badge = (text: string, state: 'on' | 'off' | 'online' | 'offline' | 'disconnected') => {
    const clr = state === 'on' || state === 'online' ? 'green' : state === 'disconnected' ? 'yellow' : 'red';
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold bg-${clr}-600 text-black`}>{text}</span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-purple-900 rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-900">
          <h2 className="text-xl font-semibold">Riwayat Notifikasi Status</h2>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-purple-400 sticky top-0 bg-black">
                      <th className="text-left px-2 py-2">Waktu</th>
                      <th className="text-left px-2 py-2">Driver</th>
                      <th className="text-left px-2 py-2">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, idx) => {
                      const rowBase = idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900';

                      let messageElem: React.ReactNode = null;
                      if (n.type === 'status') {
                        messageElem = (
                          <span className="flex items-center gap-1">
                            Status {badge(n.from ?? '', n.from as any)} ➔ {badge(n.to ?? '', n.to as any)}
                            <button
                              onClick={() => alert('Kemungkinan Jaringan terputus atau HP Dimatikan')}
                              className="text-purple-300 hover:text-purple-200"
                              title="Info"
                            >
                              <FiInfo size={14} />
                            </button>
                          </span>
                        );
                      } else if (n.type === 'gps') {
                        const fromLabel = n.from === 'on' ? 'Aktif' : 'Mati';
                        const toLabel = n.to === 'on' ? 'Aktif' : 'Mati';
                        messageElem = (
                          <span className="flex items-center gap-1">
                            GPS {badge(fromLabel, n.from as any)} ➔ {badge(toLabel, n.to as any)}
                            <button
                              onClick={() => alert('Kemungkinan besar settingan GPS Diubah Driver')}
                              className="text-yellow-300 hover:text-yellow-200"
                              title="Info"
                            >
                              <FiInfo size={14} />
                            </button>
                          </span>
                        );
                      } else if (n.type === 'battery') {
                        messageElem = (
                          <span className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-600 text-black">Baterai Low</span>
                            ({n.level}%)
                            <button
                              onClick={() => alert('Kondisi Battery HP Driver dibawah 25%')}
                              className="text-red-300 hover:text-red-200"
                              title="Info"
                            >
                              <FiInfo size={14} />
                            </button>
                          </span>
                        );
                      }

                      return (
                        <tr key={idx} className={`border-t border-gray-700 hover:bg-gray-700 ${rowBase}`}>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {new Date(n.timestamp).toLocaleString('id-ID')}
                          </td>
                          <td className="px-2 py-2">{n.nama}</td>
                          <td className="px-2 py-2">{messageElem}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiwayatStatus;
