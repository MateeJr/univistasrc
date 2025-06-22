"use client";

import { useEffect, useState } from "react";

const API_BASE = "http://66.96.230.177:3000";

type StepId = 'server' | 'mapbox' | 'next';

interface Step {
  id: StepId;
  label: string;
}

const STEPS: Step[] = [
  { id: 'server', label: 'Connecting to Server' },
  { id: 'mapbox', label: 'Loading Maps & GPS' },
  { id: 'next',   label: 'Preparing...' },
];

/**
 * Displays a full-screen splash "Loading…" overlay until the browser has finished
 * loading / hydrating the page. All page content renders in the background but is
 * hidden with `visibility:hidden` to ensure correct layout calculations.
 */
export default function InitialLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [statuses, setStatuses] = useState<Record<StepId, 'pending' | 'ok' | 'fail'>>({
    server: 'pending',
    mapbox: 'pending',
    next: 'pending',
  });

  const [errorStep, setErrorStep] = useState<StepId|null>(null);

  // When ready becomes true, start fade-out before removing overlay
  useEffect(() => {
    if (ready) {
      // trigger css transition
      setFadeOut(true);
      const timer = setTimeout(() => {
        // allow fade-out to finish then unmount overlay by setting readyOverlay
        setShowOverlay(false);
      }, 600); // match CSS duration
      return () => clearTimeout(timer);
    }
  }, [ready]);

  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      // Step 1: Server
      try {
        const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
        if (res.ok) {
          setStatuses(s=>({...s, server:'ok'}));
        } else {
          throw new Error('status');
        }
      } catch {
        setStatuses(s=>({...s, server:'fail'}));
        setErrorStep('server');
        return; // stop further checks
      }

      // Step 2: Mapbox status API
      try {
        const res = await fetch('https://status.mapbox.com/api/v2/status.json');
        if (res.ok) {
          const json = await res.json();
          const indic = json?.status?.indicator || 'none';
          if(indic==='none' || indic==='minor'){
            setStatuses(s=>({...s, mapbox:'ok'}));
          } else {
            throw new Error('mapbox issue');
          }
        } else throw new Error('mapbox http');
      } catch {
        setStatuses(s=>({...s, mapbox:'fail'}));
        setErrorStep('mapbox');
        return;
      }

      // Step 3: Next.js hydration complete (wait for window load event)
      const waitHydrate = () => new Promise<void>(resolve=>{
        if(document.readyState==='complete') return resolve();
        window.addEventListener('load',()=>resolve(),{ once:true });
      });
      await waitHydrate();
      setStatuses(s=>({...s, next:'ok'}));

      setReady(true);
    };

    runChecks();
  }, []);

  return (
    <>
      {showOverlay && (
        <div className={`fixed inset-0 flex flex-col items-center justify-center bg-black text-white z-[9999] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
          {errorStep ? (
            <>
              {/* red x icon */}
              <svg className="h-14 w-14 text-red-600 mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <h2 className="text-xl font-bold mb-4">{errorStep==='server'?'Server Univista Offline':'Mapbox API Bermasalah'}</h2>
              <button onClick={()=>{
                // reset and rerun checks
                setStatuses({ server:'pending', mapbox:'pending', next:'pending'});
                setErrorStep(null);
                setReady(false);
                setFadeOut(false);
                // rerun checks
                window.location.reload();
              }} className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm">Coba Lagi</button>
            </>
          ) : (
            <>
              {/* Spinner */}
              <svg
                className="animate-spin h-12 w-12 text-purple-600 mb-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>

              <ul className="space-y-2 text-sm">
                {STEPS.map(step => {
                  const st = statuses[step.id];
                  return (
                    <li key={step.id} className="flex items-center gap-2 animate-fade-slide" style={{ animationDelay: `${STEPS.indexOf(step)*0.2}s` }}>
                      {st==='pending' && <span className="animate-spin inline-block h-3 w-3 border-2 border-t-transparent border-purple-400 rounded-full" />}
                      {st==='ok' && <span className="inline-block h-3 w-3 bg-green-500 rounded-full" />}
                      {st==='fail' && <span className="inline-block h-3 w-3 bg-red-600 rounded-full" />}
                      <span>{step.label}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
      {/* Keep underlying DOM but hide it until ready so images, fonts, etc load in background */}
      <div style={{ visibility: ready ? "visible" : "hidden" }}>{children}</div>
    </>
  );
}
