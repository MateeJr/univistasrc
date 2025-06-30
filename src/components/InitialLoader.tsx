"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const API_BASE = "";

type StepId = "server" | "mapbox" | "next";

interface Step {
  id: StepId;
  label: string;
}

const STEPS: Step[] = [
  { id: "server", label: "Connecting to Server" },
  { id: "mapbox", label: "Loading Maps & GPS" },
  { id: "next", label: "Preparing User Interface" },
];

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
          try {
            const res = await fetch(`${API_BASE}/api/stats`, { cache: "no-store" });
            return res.ok;
          } catch {
            return false;
          }
        },
        mapbox: async () => {
          try {
            const res = await fetch("https://status.mapbox.com/api/v2/status.json");
            if (!res.ok) return false;
            const json = await res.json();
            const indic = json?.status?.indicator ?? "none";
            return indic === "none" || indic === "minor";
          } catch {
            return false;
          }
        },
        next: async () => true,
      };

      const promises = Object.entries(checks).map(async ([id, fn]) => {
        const ok = await fn();
        if (ok) {
          setStatuses((s) => ({ ...s, [id as StepId]: "ok" }));
        } else {
          setStatuses((s) => ({ ...s, [id as StepId]: "fail" }));
          setErrorStep(id as StepId);
        }
        return ok;
      });

      const results = await Promise.all(promises);

      if (results.every(Boolean)) {
        // brief delay to allow the user to see the final status change
        setTimeout(() => setShowOverlay(false), 500);
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

  return (
    <>
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 flex flex-col items-center justify-center bg-[#111] text-white z-[9999]"
          >
            <div className="w-64">
              {errorStep ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <h2 className="text-lg font-semibold text-red-400 mb-2">
                    {errorStep === "server" ? "Server Connection Failed" : "Failed to Load Resources"}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="mt-4 px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-sm font-semibold transition-colors"
                  >
                    Try Again
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