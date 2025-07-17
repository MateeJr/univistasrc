"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type StepId = "server" | "mapbox" | "next";

interface Step {
  id: StepId;
  label: string;
}

const STEPS: Step[] = [
  { id: "server", label: "Connecting to Server" },
  { id: "mapbox", label: "Initializing Geo-services" },
  { id: "next", label: "Preparing Interface" },
];

const CheckmarkIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <motion.path
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, type: "tween", ease: "easeOut" }}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const CrossIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.3, type: "tween", ease: "easeOut" }}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
        />
    </svg>
);


const StatusIndicator = ({ status }: { status: "pending" | "ok" | "fail" }) => {
    return (
        <div className="w-8 h-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
                {status === 'pending' && (
                    <motion.div
                        key="pending"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="w-2.5 h-2.5 bg-purple-400/50 rounded-full animate-pulse" />
                    </motion.div>
                )}
                {status === 'ok' && (
                    <motion.div key="ok" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                        <div className="text-green-400"><CheckmarkIcon /></div>
                    </motion.div>
                )}
                {status === 'fail' && (
                    <motion.div key="fail" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                       <div className="text-red-400"><CrossIcon /></div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


export default function InitialLoader({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<Record<StepId, "pending" | "ok" | "fail">>({
    server: "pending",
    mapbox: "pending",
    next: "pending",
  });
  const [errorStep, setErrorStep] = useState<StepId | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      type CheckFn = () => Promise<boolean>;

      const checks: Record<StepId, CheckFn> = {
        server: async () => {
          const url = `${API_BASE}/api/stats`;
          try {
            const res = await fetch(url, { cache: "no-store" });
            return res.ok;
          } catch (error) {
            return false;
          }
        },
        mapbox: async () => {
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
          return true;
        },
        next: async () => {
          await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
          return true;
        },
      };

      for (const step of STEPS) {
        const id = step.id;
        const ok = await checks[id]();
        if (ok) {
          setStatuses((s) => ({ ...s, [id]: "ok" }));
        } else {
          setStatuses((s) => ({ ...s, [id]: "fail" }));
          setErrorStep(id);
          return; // Stop on first failure
        }
      }

      // All checks passed
      setTimeout(() => setShowOverlay(false), 800);
    };

    if (!errorStep) {
      runChecks();
    }
  }, [errorStep]);

  const handleRetry = () => {
    setStatuses({ server: "pending", mapbox: "pending", next: "pending" });
    setErrorStep(null);
  };

  const progress = useSpring(0, { stiffness: 100, damping: 30 });
  const okCount = Object.values(statuses).filter(s => s === 'ok').length;
  
  useEffect(() => {
    progress.set(okCount / STEPS.length);
  }, [okCount, progress]);

  const logoPathLength = useTransform(progress, [0, 1], [0, 1]);

  return (
    <>
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
            className="fixed inset-0 flex flex-col items-center justify-center bg-[#0A0A0A] text-white z-[9999] overflow-hidden"
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] }}
              className="relative z-10 flex flex-col items-center"
            >
              {errorStep ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="text-center p-8 bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-red-500/20"
                >
                  <div className="w-14 h-14 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">
                    {errorStep === "server" ? "Server Connection Failed" : "Failed to Load Resources"}
                  </h2>
                  <p className="text-gray-400 max-w-xs mx-auto mb-6">
                    We couldn't connect to our servers. Please check your internet connection and try again.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05, background: 'rgba(192, 72, 72, 0.8)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="mt-4 px-6 py-2.5 bg-red-500/80 hover:bg-red-500/90 rounded-full text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-500/20"
                  >
                    Retry
                  </motion.button>
                </motion.div>
              ) : (
                <div className="w-96 p-8 bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl shadow-black/20">
                  <div className="flex justify-center items-center mb-6">
                    <div className="w-16 h-16">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" pathLength="1" className="stroke-current text-white/10" strokeWidth="5" fill="transparent" />
                            <motion.circle cx="50" cy="50" r="45" pathLength="1" className="stroke-current text-purple-500" strokeWidth="5" strokeLinecap="round" fill="transparent" style={{ pathLength: logoPathLength }} />
                        </svg>
                    </div>
                  </div>
                  <h1 className="text-center text-2xl font-bold text-gray-100 mb-2">Univista</h1>
                  <p className="text-center text-sm text-gray-400 mb-8">Initializing services, please wait...</p>
                  
                  <ul className="space-y-3">
                    {STEPS.map((step, index) => {
                      const status = statuses[step.id];
                      return (
                        <motion.li
                          key={step.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0, transition: { delay: index * 0.1, duration: 0.4 } }}
                          className="flex items-center justify-between gap-4 text-base p-3 bg-white/5 rounded-lg"
                        >
                          <span className="font-medium text-gray-300">{step.label}</span>
                          <StatusIndicator status={status} />
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ visibility: showOverlay ? "hidden" : "visible" }}>
        {children}
      </div>
    </>
  );
}
