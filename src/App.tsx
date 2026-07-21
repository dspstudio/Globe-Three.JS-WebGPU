import { useState, useEffect, useCallback } from 'react';
import { EarthCanvas } from './components/EarthCanvas';
import { Loader } from './components/Loader';
import { ProjectedLocation } from './types';
import { CINEMATIC_LOCATIONS } from './constants';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Initializing WebGPU');

  const getTimezoneOffset = (id: string): number => {
    switch (id) {
      case 'london': return 0;
      case 'paris':
      case 'berlin':
      case 'rome':
      case 'madrid':
      case 'vienna':
      case 'amsterdam': return 1;
      case 'bucharest':
      case 'athens': return 2;
      case 'dubai': return 4;
      case 'new_york': return -5;
      case 'chicago': return -6;
      case 'los_angeles': return -8;
      case 'shanghai': return 8;
      case 'tokyo': return 9;
      case 'sydney': return 10;
      default: return 0;
    }
  };

  // Update dynamic timezone clocks every second via direct DOM update
  useEffect(() => {
    if (loading) return;
    const updateTimes = () => {
      const d = new Date();
      // Get exact UTC time regardless of current browser locale location
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      
      for (const loc of CINEMATIC_LOCATIONS) {
        const offset = getTimezoneOffset(loc.id);
        const local = new Date(utc + (3600000 * offset));
        const timeStr = local.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          hour12: false 
        });

        const el = document.getElementById(`time-${loc.id}`);
        if (el) {
          el.textContent = timeStr;
        }
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleLoad = useCallback(() => {
    setLoadingMsg('Loading Complete');
    setTimeout(() => {
      setLoading(false);
    }, 200);
  }, []);

  // Callback coming up from the 3D Engine on each frame
  const handleLocationsUpdate = useCallback((locations: ProjectedLocation[]) => {
    const width = window.innerWidth;
    
    // Directly update DOM elements in the requestAnimationFrame render cycle
    // to bypass any asynchronous React scheduling latency/jitter.
    for (const loc of locations) {
      const beaconEl = document.getElementById(`beacon-${loc.id}`);
      const labelEl = document.getElementById(`label-${loc.id}`);

      if (beaconEl) {
        if (loc.visible && loc.opacity >= 0.05) {
          beaconEl.style.transform = `translate3d(${loc.x}px, ${loc.y}px, 0) translate(-50%, -50%)`;
          beaconEl.style.opacity = String(loc.opacity);
          beaconEl.style.display = 'flex';
        } else {
          beaconEl.style.display = 'none';
        }
      }

      if (labelEl) {
        if (loc.visible && loc.opacity >= 0.05) {
          const isLeft = loc.x < width / 2;
          labelEl.style.transform = `translate3d(${loc.x}px, ${loc.y}px, 0) ${
            isLeft ? 'translate(calc(-100% - 16px), -50%)' : 'translate(16px, -50%)'
          }`;
          labelEl.style.opacity = String(loc.opacity);
          labelEl.style.display = 'block';

          const alignEl = document.getElementById(`label-align-${loc.id}`);
          if (alignEl) {
            if (isLeft) {
              alignEl.className = 'flex flex-col items-end';
            } else {
              alignEl.className = 'flex flex-col items-start';
            }
          }
        } else {
          labelEl.style.display = 'none';
        }
      }
    }

    // Hide locations that are not present in active locations update (e.g. if cities toggle is off)
    const activeIds = new Set(locations.map((l) => l.id));
    for (const loc of CINEMATIC_LOCATIONS) {
      if (!activeIds.has(loc.id)) {
        const beaconEl = document.getElementById(`beacon-${loc.id}`);
        const labelEl = document.getElementById(`label-${loc.id}`);
        if (beaconEl) beaconEl.style.display = 'none';
        if (labelEl) labelEl.style.display = 'none';
      }
    }
  }, []);

  // Utility to format latitude and longitude coordinates cleanly
  const formatLatLong = (lat: number, lng: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`;
  };

  return (
    <div className="relative w-screen h-screen bg-neutral-950 text-white overflow-hidden font-sans">
      {/* Three.js / WebGPU Base Canvas */}
      <EarthCanvas 
        onLoad={handleLoad} 
        onProgress={setLoadingMsg} 
        onLocationsUpdate={handleLocationsUpdate}
      />

      {/* --- HUD GRAPHICS & OVERLAYS --- */}
      {!loading && (
        <>
          {/* Glowing Beacon Core Points */}
          {CINEMATIC_LOCATIONS.map((loc) => {
            return (
              <div
                id={`beacon-${loc.id}`}
                key={`beacon-${loc.id}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: 'translate3d(0, 0, 0) translate(-50%, -50%)',
                  opacity: 0,
                  display: 'none',
                  pointerEvents: 'none',
                }}
                className="z-20 flex items-center justify-center w-8 h-8"
              >
                {/* Visual solid core of beacon */}
                <div 
                  className="relative w-2 h-2 rounded-full border border-black/40 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] z-20" 
                />
                
                {/* Animated outer ring */}
                <div 
                  className="absolute w-5 h-5 rounded-full border border-white/50 bg-white/10 animate-ping" 
                  style={{ animationDuration: '3s' }}
                />

                {/* Secondary static subtle ring */}
                <div 
                  className="absolute w-5 h-5 rounded-full border border-white/20 pointer-events-none" 
                />
              </div>
            );
          })}

          {/* Projected Floating Labels */}
          {CINEMATIC_LOCATIONS.map((loc) => {
            return (
              <div
                id={`label-${loc.id}`}
                key={`label-${loc.id}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: 'translate3d(0, 0, 0)',
                  opacity: 0,
                  display: 'none',
                  pointerEvents: 'none',
                }}
                className="z-20 whitespace-nowrap select-none"
              >
                <div id={`label-align-${loc.id}`} className="flex flex-col items-start">
                  {/* Main location text */}
                  <div className="font-mono font-bold tracking-[0.2em] text-[10px] md:text-[11px] uppercase text-white/80">
                    {loc.name.split(',')[0]}
                  </div>
                  {/* Mini-subheading coordinates + time ticker */}
                  <div className="font-mono text-[8px] md:text-[9px] text-white/40 mt-0.5 flex items-center gap-1.5">
                    <span>{formatLatLong(loc.lat, loc.lng)}</span>
                    <span className="text-white/20">•</span>
                    <span id={`time-${loc.id}`}>00:00:00</span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Primary Loading Screen */}
      <Loader visible={loading} message={loadingMsg} />
    </div>
  );
}
