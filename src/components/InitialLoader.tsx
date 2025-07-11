"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type StepId = "server" | "mapbox" | "next";

interface Step {
  id: StepId;
  label: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  { 
    id: "server", 
    label: "Connecting to Server",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    )
  },
  { 
    id: "mapbox", 
    label: "Loading Maps & GPS",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  { 
    id: "next", 
    label: "Preparing User Interface",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
];

export default function InitialLoader({ children }: { children: React.ReactNode }) {
  console.log('[InitialLoader] Component mounted');
  console.log('[InitialLoader] NODE_ENV:', process.env.NODE_ENV);
  console.log('[InitialLoader] Running in browser:', typeof window !== 'undefined');
  
  const [statuses, setStatuses] = useState<Record<StepId, "pending" | "ok" | "fail">>({
    server: "pending",
    mapbox: "pending",
    next: "pending",
  });
  const [errorStep, setErrorStep] = useState<StepId | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  console.log('[InitialLoader] Initial state:', { statuses, errorStep, showOverlay });

  useEffect(() => {
    const runChecks = async () => {
      type CheckFn = () => Promise<boolean>;

      const checks: Record<StepId, CheckFn> = {
        server: async () => {
          const url = `${API_BASE}/api/stats`;
          console.log('[InitialLoader] Checking server connection...');
          console.log('[InitialLoader] API_BASE:', API_BASE);
          console.log('[InitialLoader] Full URL:', url);
          console.log('[InitialLoader] Environment NEXT_PUBLIC_API_BASE:', process.env.NEXT_PUBLIC_API_BASE);
          
          try {
            console.log('[InitialLoader] Making fetch request...');
            const res = await fetch(url, { cache: "no-store" });
            console.log('[InitialLoader] Response status:', res.status);
            console.log('[InitialLoader] Response ok:', res.ok);
            console.log('[InitialLoader] Response headers:', [...res.headers.entries()]);
            
            if (res.ok) {
              try {
                const data = await res.text();
                console.log('[InitialLoader] Response data:', data);
              } catch (e) {
                console.log('[InitialLoader] Could not read response body:', e);
              }
            }
            
            return res.ok;
          } catch (error) {
            console.error('[InitialLoader] Server check failed with error:', error);
            console.error('[InitialLoader] Error type:', (error as Error)?.constructor?.name || typeof error);
            console.error('[InitialLoader] Error message:', (error as Error)?.message || String(error));
            return false;
          }
        },
        mapbox: async () => {
          console.log('[InitialLoader] Skipping Mapbox check - not essential');
          return true; // Always pass since Mapbox service issues don't block the app
        },
        next: async () => {
          console.log('[InitialLoader] Next.js check - always passes');
          return true;
        },
      };

      const promises = Object.entries(checks).map(async ([id, fn]) => {
        console.log(`[InitialLoader] Starting check for: ${id}`);
        const ok = await fn();
        console.log(`[InitialLoader] Check result for ${id}:`, ok);
        
        if (ok) {
          console.log(`[InitialLoader] ✅ ${id} check passed`);
          setStatuses((s) => ({ ...s, [id as StepId]: "ok" }));
        } else {
          console.log(`[InitialLoader] ❌ ${id} check failed`);
          setStatuses((s) => ({ ...s, [id as StepId]: "fail" }));
          setErrorStep(id as StepId);
        }
        return ok;
      });

      const results = await Promise.all(promises);
      
      console.log('[InitialLoader] All check results:', results);
      console.log('[InitialLoader] Final statuses:', statuses);

      if (results.every(Boolean)) {
        console.log('[InitialLoader] ✅ All checks passed! Loading app...');
        // brief delay to allow the user to see the final status change
        setTimeout(() => setShowOverlay(false), 500);
      } else {
        console.log('[InitialLoader] ❌ Some checks failed, showing error screen');
      }
    };

    if (!errorStep) {
      runChecks();
    }
  }, [errorStep]);

  const handleRetry = () => {
    setStatuses({ server: "pending", mapbox: "pending", next: "pending" });
    setErrorStep(null);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } },
  };

  const loaderVariants: Variants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    },
    exit: {
      scale: 0.9,
      opacity: 0,
      transition: {
        duration: 0.4
      }
    }
  };

  const progressPercentage = Object.values(statuses).filter(s => s === "ok").length / STEPS.length * 100;

  return (
    <>
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white z-[9999] overflow-hidden"
          >
            {/* Animated background elements */}
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="w-64">
              {errorStep ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <h2 className="text-lg font-semibold text-red-400 mb-2">
                    {errorStep === "server" ? "Tidak dapat terhubung ke server" : "Gagal memuat sumber daya"}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="mt-4 px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-sm font-semibold transition-colors"
                  >
                    Coba Lagi
                  </motion.button>
                </motion.div>
              ) : (
                <ul className="space-y-4">
                  {STEPS.map((step, index) => {
                    const status = statuses[step.id];
                    return (
                      <motion.li
                        key={step.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: index * 0.2, duration: 0.5 } }}
                        className="flex items-center gap-4 text-base"
                      >
                        <div className="w-6 h-6 flex items-center justify-center">
                            <AnimatePresence>
                                {status === 'pending' && (
                                    <motion.div key="pending" initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                                )}
                                {status === 'ok' && (
                                    <motion.div key="ok" initial={{scale:0}} animate={{scale:1}}>
                                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </motion.div>
                                )}
                                {status === 'fail' && (
                                     <motion.div key="fail" initial={{scale:0}} animate={{scale:1}} className="w-5 h-5 bg-red-500 rounded-full" />
                                )}
                            </AnimatePresence>
                        </div>
                        <span className="text-gray-300">{step.label}</span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ visibility: showOverlay ? "hidden" : "visible" }}>
        {children}
      </div>
    </>
  );
}