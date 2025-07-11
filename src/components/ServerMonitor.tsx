"use client";
import { useEffect, useState } from "react";

const API_BASE = "";

export default function ServerMonitor({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
        if (res.ok) {
          setOnline(true);
          attempts = 0;
        } else {
          attempts += 1;
          setOnline(false);
        }
      } catch {
        attempts += 1;
        setOnline(false);
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {!online && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white">
          {/* Spinner */}
          <svg
            className="animate-spin h-12 w-12 text-purple-600 mb-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Tidak dapat terhubung ke server</h2>
          <p className="text-center max-w-xs text-sm text-gray-300 mb-1">Periksa koneksi atau server.</p>
          <p className="text-center max-w-xs text-sm text-gray-400">Sedang mencoba Menghubungkan kembali...</p>
        </div>
      )}
      {children}
    </>
  );
} 