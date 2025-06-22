"use client";
import React, { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { FiTrash2, FiSettings } from "react-icons/fi";

const API_BASE = "http://66.96.230.177:3000";

interface Jenis {
  name: string;
  color: string;
}

const Settings: React.FC = () => {
  const [list, setList] = useState<Jenis[]>([]);
  const [newJenis, setNewJenis] = useState("");
  const [newColor, setNewColor] = useState("#9241f8");
  const [loading, setLoading] = useState(false);

  // Foto states
  const [fotoList, setFotoList] = useState<string[]>([]);
  const [newFoto, setNewFoto] = useState("");
  const [loadingFoto, setLoadingFoto] = useState(false);

  // ---------------- RADIUS CONFIG ---------------- //
  interface RadiusCfg {
    targetRadius: number;
    keluarJalurRadius: number;
    berhentiRadius: number;
    berhentiDurasi: number;
    berhentiUnit: 'Jam' | 'Menit';
    speedLimit: number;
    oilReminder: number;
  }

  const defaultRadiusCfg: RadiusCfg = {
    targetRadius: 50,
    keluarJalurRadius: 50,
    berhentiRadius: 20,
    berhentiDurasi: 5,
    berhentiUnit: 'Menit',
    speedLimit: 60,
    oilReminder: 7000,
  };

  const [radiusCfg, setRadiusCfg] = useState<RadiusCfg>(defaultRadiusCfg);
  const [loadingRadius, setLoadingRadius] = useState(false);

  // ---------------- NOTIF CONFIG ---------------- //
  interface NotifCfg {
    onlineOffline: boolean;
    gpsOnOff: boolean;
    batteryLow: boolean;
    keluarJalur: boolean;
    limitBerhenti: boolean;
    limitKecepatan: boolean;
    sampaiTitikTarget: boolean;
    konfirmasiSelesai: boolean;
    reminderGantiOli: boolean;
    areaLarangan: boolean;
    laporanMasuk: boolean;
  }

  const defaultNotifCfg: NotifCfg = {
    onlineOffline: true,
    gpsOnOff: true,
    batteryLow: true,
    keluarJalur: true,
    limitBerhenti: true,
    limitKecepatan: true,
    sampaiTitikTarget: true,
    konfirmasiSelesai: true,
    reminderGantiOli: true,
    areaLarangan: true,
    laporanMasuk: true,
  };

  const [notifCfg, setNotifCfg] = useState<NotifCfg>(defaultNotifCfg);
  const [loadingNotif, setLoadingNotif] = useState(false);

  // ---------------- SERVER HEALTH ---------------- //
  interface ServerStats {
    freeMem: number;
    totalMem: number;
    memUsage: number; // 0-1
    cpuUsage: number; // 0-1
    platform: string;
    uptime: number; // seconds
    networkInterfaces: number;
    health: string;
    status: string;
  }

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats`);
        const data: ServerStats = await res.json();
        setStats(data);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('fetch stats', err);
      }
    };
    fetchStats();
    interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    let hour = date.getHours();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const h = pad(hour);
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${day}/${month}/${year} - ${h}:${m}:${s} ${ampm}`;
  };

  // ---------------- WA NOTIF TARGETS ---------------- //
  const [waList, setWaList] = useState<string[]>([]);
  const [newWa, setNewWa] = useState("");
  const [loadingWa, setLoadingWa] = useState(false);
  const [loadingWaTest, setLoadingWaTest] = useState(false);

  // WA notif config
  interface WaNotifCfg extends NotifCfg {}
  const [waNotifCfg, setWaNotifCfg] = useState<WaNotifCfg>(defaultNotifCfg);
  const [loadingWaCfg, setLoadingWaCfg] = useState(false);
  const [showWaCfg, setShowWaCfg] = useState(false);

  // ---------------- WHATSAPP QR ---------------- //
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [waUser, setWaUser] = useState<{ id: string; name?: string } | null>(null);

  // Poll WA status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/wa/status`);
        if (res.ok) {
          const json = await res.json();
          setWaConnected(json.connected);
          setWaUser(json.user);
        }
      } catch {}
    };
    fetchStatus();
    const iv = setInterval(fetchStatus, 5000);
    return () => clearInterval(iv);
  }, []);

  const loadWaList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif/targets`);
      const data: string[] = await res.json();
      setWaList(data);
    } catch (err) {
      console.error('fetch wa targets', err);
    }
  };

  const addWa = async (e: FormEvent) => {
    e.preventDefault();
    const number = newWa.trim();
    if (!number) return;
    setLoadingWa(true);
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      if (res.ok) {
        setNewWa('');
        loadWaList();
      } else if (res.status === 409) {
        alert('Nomor sudah ada');
      } else {
        alert('Gagal menambah nomor');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingWa(false);
  };

  const deleteWa = async (number: string) => {
    if (!confirm(`Hapus nomor ${number}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif/targets/${encodeURIComponent(number)}`, { method: 'DELETE' });
      if (res.ok) {
        loadWaList();
      } else {
        alert('Gagal menghapus nomor');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
  };

  const deleteAllWa = async () => {
    if (!confirm('Hapus SEMUA nomor WA?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif/targets`, { method: 'DELETE' });
      if (res.ok) {
        loadWaList();
      } else {
        alert('Gagal menghapus semua nomor');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
  };

  useEffect(() => {
    loadWaList();
  }, []);

  // Fetch existing list
  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jenis-laporan`);
      const data: Jenis[] = await res.json();
      setList(data);
    } catch (err) {
      console.error("fetch jenis", err);
    }
  };

  const loadFoto = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jenis-foto`);
      const data: string[] = await res.json();
      setFotoList(data);
    } catch (err) {
      console.error("fetch jenis foto", err);
    }
  };

  const loadRadiusCfg = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/radius-config`);
      const data: RadiusCfg = await res.json();
      setRadiusCfg(data);
    } catch (err) {
      console.error('fetch radius cfg', err);
    }
  };

  const loadNotifCfg = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notif-config`);
      const data: Partial<NotifCfg> = await res.json();
      setNotifCfg({ ...defaultNotifCfg, ...data });
    } catch {}
  };

  const loadWaNotifCfg = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif-config`);
      const data: Partial<WaNotifCfg> = await res.json();
      setWaNotifCfg({ ...defaultNotifCfg, ...data });
    } catch (err) {
      console.error('wa notif cfg', err);
    }
  };

  useEffect(() => {
    load();
    loadFoto();
    loadRadiusCfg();
    loadNotifCfg();
    loadWaNotifCfg();
  }, []);

  // Add new jenis
  const addJenis = async (e: FormEvent) => {
    e.preventDefault();
    const name = newJenis.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/jenis-laporan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      if (res.ok) {
        setNewJenis("");
        load();
      } else if (res.status === 409) {
        alert("Jenis sudah ada");
      } else {
        alert("Gagal menambah jenis");
      }
    } catch {
      alert("Terjadi kesalahan koneksi");
    }
    setLoading(false);
  };

  // Update color
  const updateColor = async (name: string, color: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/jenis-laporan/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error();
      // notify other tabs/components
      window.dispatchEvent(new CustomEvent('jenisColorUpdated', { detail: { name, color } }));
    } catch {
      alert("Gagal update warna");
    }
  };

  // Delete jenis
  const deleteJenis = async (name: string) => {
    if (!confirm(`Hapus jenis '${name}'?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/jenis-laporan/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        load();
      } else {
        alert("Gagal menghapus");
      }
    } catch {
      alert("Terjadi kesalahan koneksi");
    }
  };

  const deleteAllJenis = async () => {
    if (!confirm('Hapus SEMUA jenis laporan?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/jenis-laporan`, { method: 'DELETE' });
      if (res.ok) {
        load();
      } else {
        alert('Gagal menghapus semua jenis laporan');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
  };

  // ---------------- FOTO ---------------- //
  const addFoto = async (e: FormEvent) => {
    e.preventDefault();
    const name = newFoto.trim();
    if (!name) return;
    setLoadingFoto(true);
    try {
      const res = await fetch(`${API_BASE}/api/jenis-foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewFoto("");
        loadFoto();
      } else if (res.status === 409) {
        alert("Jenis foto sudah ada");
      } else {
        alert("Gagal menambah jenis foto");
      }
    } catch {
      alert("Terjadi kesalahan koneksi");
    }
    setLoadingFoto(false);
  };

  const deleteFoto = async (name: string) => {
    if (!confirm(`Hapus jenis foto '${name}'?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/jenis-foto/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadFoto();
      } else {
        alert("Gagal menghapus jenis foto");
      }
    } catch {
      alert("Terjadi kesalahan koneksi");
    }
  };

  const deleteAllFoto = async () => {
    if (!confirm('Hapus SEMUA jenis foto?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/jenis-foto`, { method: 'DELETE' });
      if (res.ok) {
        loadFoto();
      } else {
        alert('Gagal menghapus semua jenis foto');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
  };

  // ---------------- RADIUS CONFIG ---------------- //
  const saveRadiusCfg = async () => {
    setLoadingRadius(true);
    try {
      const res = await fetch(`${API_BASE}/api/radius-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(radiusCfg),
      });
      if (res.ok) {
        alert('Berhasil disimpan');
      } else {
        alert('Gagal menyimpan pengaturan radius');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingRadius(false);
  };

  const saveNotifCfg = async () => {
    setLoadingNotif(true);
    try {
      const res = await fetch(`${API_BASE}/api/notif-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifCfg),
      });
      if (res.ok) {
        alert('Berhasil disimpan');
      } else {
        alert('Gagal menyimpan pengaturan notifikasi');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingNotif(false);
  };

  // Backup states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  const startBackup = () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${API_BASE}/api/backup`, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        setBackupProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = xhr.getResponseHeader('Content-Disposition')?.split('filename=')[1] || 'backup.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Gagal membuat backup');
      }
      setIsBackingUp(false);
      setBackupProgress(0);
    };

    xhr.onerror = () => {
      alert('Terjadi kesalahan koneksi');
      setIsBackingUp(false);
      setBackupProgress(0);
    };

    xhr.send();
  };

  const fetchQr = async () => {
    setLoadingQr(true);
    try {
      const res = await fetch(`${API_BASE}/api/wa/qr`);
      if (res.ok) {
        const json = await res.json();
        setQrUrl(json.data);
      } else if (res.status === 404) {
        alert('QR belum tersedia. Pastikan service WhatsApp berjalan.');
      } else {
        alert('Gagal mengambil QR');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingQr(false);
  };

  const saveWaNotifCfg = async () => {
    setLoadingWaCfg(true);
    try {
      const res = await fetch(`${API_BASE}/api/wa-notif-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waNotifCfg),
      });
      if (res.ok) {
        alert('Berhasil disimpan');
        setShowWaCfg(false);
      } else {
        alert('Gagal menyimpan');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingWaCfg(false);
  };

  const sendTestWa = async () => {
    if (waList.length === 0) { alert('Tambahkan nomor WA terlebih dahulu'); return; }
    setLoadingWaTest(true);
    try {
      const res = await fetch(`${API_BASE}/api/wa/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) alert('Pesan tes berhasil dikirim');
      else alert('Gagal mengirim pesan tes');
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
    setLoadingWaTest(false);
  };

  const [groupList,setGroupList]=useState<{id:string,name:string,selected:boolean}[]>([]);
  const [loadingGroups,setLoadingGroups]=useState(false);
  const [showGroupCfg,setShowGroupCfg]=useState(false);

  const loadGroups=async()=>{
    setLoadingGroups(true);
    try{
      const res=await fetch(`${API_BASE}/api/wa/groups`);
      if(res.ok){ const data=await res.json(); setGroupList(data); }
    }catch{}
    setLoadingGroups(false);
  };

  const saveGroups=async()=>{
    try{
      await fetch(`${API_BASE}/api/wa/groups`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(groupList.filter(g=>g.selected).map(g=>g.id))});
      alert('Group disimpan');
    }catch{alert('Gagal simpan group');}
  };

  useEffect(()=>{loadGroups();},[]);

  return (
    <div className="p-4">
      {/* Container for all setting panels */}
      <div className="flex flex-wrap gap-4">

        {/* ---------- Panel: Jenis Laporan ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Pengaturan Jenis Laporan</h2>

          {/* Add form */}
          <form onSubmit={addJenis} className="flex flex-wrap gap-2 mb-6 items-center">
            <input
              type="text"
              className="flex-grow rounded-md px-3 py-2 bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Jenis laporan baru"
              value={newJenis}
              onChange={(e) => setNewJenis(e.target.value)}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-10 h-10 p-0 border-0 bg-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              Tambah
            </button>
            <button
              type="button"
              onClick={deleteAllJenis}
              className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white"
            >
              Hapus Semua
            </button>
          </form>

          {/* List */}
          <div className="w-full space-y-2 flex-1 overflow-y-auto pr-1">
            {list.length === 0 ? (
              <p className="text-center text-gray-400">Belum ada jenis laporan</p>
            ) : (
              list.map((j) => (
                <div
                  key={j.name}
                  className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-md border border-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-4 h-4 rounded-sm"
                      style={{ backgroundColor: j.color }}
                    />
                    {j.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={j.color}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const c = e.target.value;
                        updateColor(j.name, c);
                        setList((prev) => prev.map((p) => (p.name === j.name ? { ...p, color: c } : p)));
                      }}
                      className="w-8 h-8 p-0 border-0 bg-transparent"
                    />
                    <button
                      onClick={() => deleteJenis(j.name)}
                      className="text-red-400 hover:text-red-500 p-1"
                      aria-label="Hapus"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---------- Panel: Pengaturan Jenis Foto ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Pengaturan Jenis Foto</h2>

          {/* Add form */}
          <form onSubmit={addFoto} className="flex w-full flex-wrap gap-2 mb-6 items-center">
            <input
              type="text"
              className="flex-grow rounded-md px-3 py-2 bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Jenis foto baru"
              value={newFoto}
              onChange={(e) => setNewFoto(e.target.value)}
            />
            <button
              type="submit"
              disabled={loadingFoto}
              className="px-4 py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              Tambah
            </button>
            <button
              type="button"
              onClick={deleteAllFoto}
              className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white"
            >
              Hapus Semua
            </button>
          </form>

          {/* List */}
          <div className="w-full space-y-2 flex-1 overflow-y-auto pr-1">
            {fotoList.length === 0 ? (
              <p className="text-center text-gray-400">Belum ada jenis foto</p>
            ) : (
              fotoList.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-md border border-gray-700"
                >
                  <span>{name}</span>
                  <button
                    onClick={() => deleteFoto(name)}
                    className="text-red-400 hover:text-red-500 p-1"
                    aria-label="Hapus"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---------- Panel: Pengaturan Radius ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Pengaturan Radius</h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Radius Titik Target */}
            <label className="flex items-center gap-2">
              <span className="flex-grow">Radius Titik Target:</span>
              <input
                type="number"
                value={radiusCfg.targetRadius}
                onChange={e => setRadiusCfg({ ...radiusCfg, targetRadius: Number(e.target.value) })}
                className="w-24 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                min={0}
              />
              <span>meter</span>
            </label>

            {/* Radius Keluar Jalur */}
            <label className="flex items-center gap-2">
              <span className="flex-grow">Radius Keluar Jalur:</span>
              <input
                type="number"
                value={radiusCfg.keluarJalurRadius}
                onChange={e => setRadiusCfg({ ...radiusCfg, keluarJalurRadius: Number(e.target.value) })}
                className="w-24 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                min={0}
              />
              <span>meter</span>
            </label>

            {/* Radius Limit Berhenti */}
            <div className="flex flex-col gap-2">
              <span>Radius Limit Berhenti:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={radiusCfg.berhentiRadius}
                  onChange={e => setRadiusCfg({ ...radiusCfg, berhentiRadius: Number(e.target.value) })}
                  className="w-24 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                  min={0}
                />
                <span>meter +</span>
                <input
                  type="number"
                  value={radiusCfg.berhentiDurasi}
                  onChange={e => setRadiusCfg({ ...radiusCfg, berhentiDurasi: Number(e.target.value) })}
                  className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                  min={0}
                />
                <select
                  value={radiusCfg.berhentiUnit}
                  onChange={e => setRadiusCfg({ ...radiusCfg, berhentiUnit: e.target.value as 'Jam' | 'Menit' })}
                  className="px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                >
                  <option value="Jam">Jam</option>
                  <option value="Menit">Menit</option>
                </select>
              </div>
            </div>

            {/* Batas Kecepatan */}
            <label className="flex items-center gap-2">
              <span className="flex-grow">Batas Kecepatan:</span>
              <input
                type="number"
                value={radiusCfg.speedLimit}
                onChange={e => setRadiusCfg({ ...radiusCfg, speedLimit: Number(e.target.value) })}
                className="w-24 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                min={0}
              />
              <span>Km/Jam</span>
            </label>

            {/* Reminder Ganti Oli */}
            <label className="flex items-center gap-2">
              <span className="flex-grow">Reminder Ganti Oli:</span>
              <input
                type="number"
                value={radiusCfg.oilReminder}
                onChange={e => setRadiusCfg({ ...radiusCfg, oilReminder: Number(e.target.value) })}
                className="w-24 px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none"
                min={0}
              />
              <span>Km</span>
            </label>
          </div>

          {/* Save Button */}
          <div className="pt-3">
            <button
              onClick={saveRadiusCfg}
              disabled={loadingRadius}
              className="w-full py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* ---------- Panel: Pengaturan Notifikasi ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Pengaturan Notifikasi</h2>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {[
              { key: 'onlineOffline', label: 'Driver Online/Offline' },
              { key: 'gpsOnOff', label: 'Driver GPS On/Off' },
              { key: 'batteryLow', label: 'Driver Battery Low' },
              { key: 'keluarJalur', label: 'Driver Keluar Jalur' },
              { key: 'areaLarangan', label: 'Driver Masuk Area Larangan' },
              { key: 'limitBerhenti', label: 'Driver Melebihi Limit Berhenti' },
              { key: 'limitKecepatan', label: 'Driver Melebihi Limit Kecepatan' },
              { key: 'reminderGantiOli', label: 'Reminder Ganti Oli' },
              { key: 'laporanMasuk', label: 'Laporan Masuk' },
              { key: 'konfirmasiSelesai', label: 'Driver Menyelesaikan Tugas' },
            ].map(item => (
              <label key={item.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifCfg[item.key as keyof NotifCfg]}
                  onChange={e => setNotifCfg({ ...notifCfg, [item.key]: e.target.checked })}
                  className="form-checkbox h-5 w-5 text-purple-600"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="pt-3">
            <button
              onClick={saveNotifCfg}
              disabled={loadingNotif}
              className="w-full py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* ---------- Panel: Whatsapp API ---------- */}
        <div className="relative rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Whatsapp API</h2>

          {/* gear icon */}
          <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-200" onClick={() => setShowWaCfg(true)}>
            <FiSettings />
          </button>

          {/* QR Code */}
          <div className="flex-1 flex items-center justify-center">
            {waConnected ? (
              <div className="text-center space-y-2">
                <div className="text-green-400 text-6xl">✔️</div>
                <div className="text-sm">
                  Terhubung&nbsp;
                  {waUser && (
                    <span className="block font-mono text-gray-300 mt-1">
                      {waUser.name ? waUser.name + ' – ' : ''}{waUser.id}
                    </span>
                  )}
                </div>
              </div>
            ) : qrUrl ? (
              <img src={qrUrl} alt="WA QR" className="w-40 h-40 object-contain rounded" />
            ) : (
              <div className="w-40 h-40 bg-black rounded-md flex items-center justify-center text-gray-500 text-sm select-none">
                QR
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3">
            {!waConnected && (
              <button
                className="flex-1 py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
                onClick={fetchQr}
                disabled={loadingQr}
              >
                {loadingQr ? 'Loading...' : 'Generate QR & Connect'}
              </button>
            )}
            <button
              className="flex-1 py-2 rounded-md bg-red-700 hover:bg-red-800"
              onClick={async () => {
                if (!confirm('Reset sesi Whatsapp?')) return;
                setLoadingQr(true);
                try {
                  await fetch(`${API_BASE}/api/wa/reset`, { method: 'POST' });
                  setQrUrl(null);
                  setWaConnected(false);
                } catch {
                  alert('Gagal reset');
                }
                setLoadingQr(false);
              }}
            >
              {waConnected ? 'LOG OUT' : 'Reset'}
            </button>
          </div>
        </div>

        {/* ---------- Panel: Notifikasi Whatsapp ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Notifikasi Whatsapp</h2>

          {/* Add WA number */}
          <form onSubmit={addWa} className="flex w-full flex-wrap gap-2 mb-4 items-center">
            <input
              type="text"
              placeholder="Masukkan nomor WA untuk dikirim notifikasi"
              value={newWa}
              onChange={e => setNewWa(e.target.value)}
              className="flex-grow rounded-md px-3 py-2 bg-gray-800 border border-gray-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loadingWa}
              className="px-4 py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              Tambah
            </button>
            <button
              type="button"
              onClick={deleteAllWa}
              className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white"
            >
              Hapus Semua
            </button>
          </form>

          {/* List numbers */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {waList.length === 0 ? (
              <p className="text-center text-gray-400">Belum ada nomor</p>
            ) : (
              waList.map(num => (
                <div key={num} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-md border border-gray-700">
                  <span>{num}</span>
                  <button
                    onClick={() => deleteWa(num)}
                    className="text-red-400 hover:text-red-500 p-1"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Test button */}
          <div className="pt-3">
            <button
              onClick={sendTestWa}
              disabled={loadingWaTest}
              className="w-full py-2 rounded-md bg-green-700 hover:bg-green-800 disabled:opacity-50"
            >
              {loadingWaTest ? 'Sending...' : 'TEST'}
            </button>
          </div>

          {/* Group modal trigger */}
          <div className="mt-4 text-center">
            <button onClick={()=>{loadGroups();setShowGroupCfg(true);}} className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800">Kelola Group</button>
          </div>
        </div>

        {/* ---------- Panel: Server Health ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Server Health</h2>

          {stats ? (
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {/* CPU Usage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU Usage</span>
                  <span>{(stats.cpuUsage * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded h-2">
                  <div
                    className="bg-purple-600 h-2 rounded"
                    style={{ width: `${stats.cpuUsage * 100}%` }}
                  />
                </div>
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{(stats.memUsage * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded h-2">
                  <div
                    className="bg-green-600 h-2 rounded"
                    style={{ width: `${stats.memUsage * 100}%` }}
                  />
                </div>
              </div>

              {/* Network Interfaces */}
              <div className="flex justify-between text-sm">
                <span>Network Portal</span>
                <span>{stats.networkInterfaces}</span>
              </div>

              {/* Uptime */}
              <div className="flex justify-between text-sm">
                <span>Uptime</span>
                <span>{formatTime(stats.uptime)}</span>
              </div>

              {/* Platform */}
              <div className="flex justify-between text-sm">
                <span>Platform</span>
                <span>{stats.platform}</span>
              </div>

              {/* Health */}
              <div className="flex justify-between text-sm font-semibold">
                <span>Health</span>
                <span
                  className={
                    stats.health === 'GOOD'
                      ? 'text-green-400'
                      : stats.health === 'WARN'
                      ? 'text-yellow-400'
                      : 'text-red-500'
                  }
                >
                  {stats.health}
                </span>
              </div>

              {/* Last Update */}
              {lastUpdate && (
                <div className="text-right text-xs text-gray-400">
                  Terakhir diperbarui: {formatDateTime(lastUpdate)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-400 flex-1 flex items-center justify-center">Loading...</p>
          )}
        </div>

        {/* ---------- Panel: Backup Data ---------- */}
        <div className="rounded-lg bg-gray-900 p-4 text-gray-200 border border-purple-900 w-full max-w-sm h-96 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Backup Data</h2>

          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <button
              onClick={() => {
                if (isBackingUp) return;
                startBackup();
              }}
              disabled={isBackingUp}
              className="w-full py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
            >
              BACKUP SEMUA DATA
            </button>

            {/* Progress bar */}
            <div className="w-full mt-4 bg-gray-700 h-3 rounded">
              <div
                className="bg-green-600 h-3 rounded"
                style={{ width: `${backupProgress}%` }}
              />
            </div>
            {isBackingUp && <span className="text-xs mt-2 text-gray-400">{Math.round(backupProgress)}%</span>}
          </div>
        </div>

      </div>

      {showWaCfg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-purple-800 rounded-lg p-6 w-80 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Pengaturan Notifikasi Whatsapp</h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {(
                [
                  { key: 'onlineOffline', label: 'Driver Online/Offline' },
                  { key: 'gpsOnOff', label: 'Driver GPS On/Off' },
                  { key: 'batteryLow', label: 'Driver Battery Low' },
                  { key: 'keluarJalur', label: 'Driver Keluar Jalur' },
                  { key: 'areaLarangan', label: 'Driver Masuk Area Larangan' },
                  { key: 'limitBerhenti', label: 'Driver Melebihi Limit Berhenti' },
                  { key: 'limitKecepatan', label: 'Driver Melebihi Limit Kecepatan' },
                  { key: 'reminderGantiOli', label: 'Reminder Ganti Oli' },
                  { key: 'laporanMasuk', label: 'Laporan Masuk' },
                  { key: 'konfirmasiSelesai', label: 'Driver Menyelesaikan Tugas' },
                ] as const
              ).map(item => (
                <label key={item.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={waNotifCfg[item.key as keyof WaNotifCfg]}
                    onChange={e => setWaNotifCfg({ ...waNotifCfg, [item.key]: e.target.checked })}
                    className="form-checkbox h-5 w-5 text-purple-600"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button onClick={() => setShowWaCfg(false)} className="flex-1 py-2 rounded-md bg-gray-700 hover:bg-gray-800">Batal</button>
              <button onClick={saveWaNotifCfg} disabled={loadingWaCfg} className="flex-1 py-2 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showGroupCfg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-purple-800 rounded-lg p-6 w-80 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">Daftar Group
              <button onClick={loadGroups} className="text-xs text-purple-400 hover:text-purple-200">Refresh</button>
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 text-sm border border-gray-700 rounded p-2">
              {loadingGroups? <p className="text-center text-gray-400">Loading...</p>:
                groupList.length===0? <p className="text-center text-gray-400">Bot tidak memiliki group</p>:
                groupList.map(g=>(
                  <label key={g.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={g.selected} onChange={e=>setGroupList(prev=>prev.map(p=>p.id===g.id?{...p,selected:e.target.checked}:p))} />
                    <span>{g.name}</span>
                  </label>
                ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button onClick={()=>setShowGroupCfg(false)} className="flex-1 py-2 rounded bg-gray-700 hover:bg-gray-800">Batal</button>
              <button onClick={()=>{saveGroups();setShowGroupCfg(false);}} className="flex-1 py-2 rounded bg-purple-700 hover:bg-purple-800">Simpan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;