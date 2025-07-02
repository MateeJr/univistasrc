"use client";

import React, { useState, useEffect } from 'react';

interface Device {
  deviceId: string;
  nama: string;
  bk: string;
}

interface SwitchDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: { deviceId: string; nama: string; } | null;
  onSwitch: () => void;
}

// helper to generate 6-digit OTP from deviceId
const generateOtp = (id: string): string => {
  if (!id) return '------';
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(-6);
  // fallback simple hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000000;
  }
  return hash.toString().padStart(6, '0');
};

const SwitchDeviceModal: React.FC<SwitchDeviceModalProps> = ({ isOpen, onClose, driver, onSwitch }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchDevices = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/all-devices');
          if (!res.ok) throw new Error('Failed to fetch devices');
          const data = await res.json();
          setDevices(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchDevices();
    }
  }, [isOpen]);

  const handleSwitchDevice = async (newDeviceId: string) => {
    if (!driver) return;
    try {
      const res = await fetch('/api/switch-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalDeviceId: driver.deviceId,
          newDeviceId: newDeviceId,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to switch device: ${err}`);
      }
      alert('Device switched successfully!');
      onSwitch();
      onClose();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-purple-800 rounded-lg p-6 w-full max-w-2xl text-white">
        <h2 className="text-2xl font-bold mb-4">Ganti Perangkat untuk {driver?.nama}</h2>
        {loading && <p>Memuat daftar perangkat...</p>}
        {error && <p className="text-red-500">{error}</p>}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left table-auto">
            <thead className="sticky top-0 bg-gray-900">
              <tr>
                <th className="p-2 border-b border-gray-700">Nama</th>
                <th className="p-2 border-b border-gray-700">Device ID</th>
                <th className="p-2 border-b border-gray-700">OTP</th>
                <th className="p-2 border-b border-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.deviceId} className="hover:bg-gray-800">
                  <td className="p-2">{device.nama} ({device.bk})</td>
                  <td className="p-2 font-mono text-xs">{device.deviceId}</td>
                  <td className="p-2 font-mono text-lg">{generateOtp(device.deviceId)}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleSwitchDevice(device.deviceId)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm disabled:bg-gray-500"
                      disabled={device.deviceId === driver?.deviceId}
                    >
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={onClose} className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Tutup
        </button>
      </div>
    </div>
  );
};

export default SwitchDeviceModal; 