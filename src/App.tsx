import { useState, useEffect, useCallback } from 'react';
import { EarthCanvas } from './components/EarthCanvas';
import { Loader } from './components/Loader';
import { ProjectedLocation } from './types';
import { CINEMATIC_LOCATIONS } from './constants';
import { AlertTriangle, RefreshCw, Layers, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Initializing WebGPU');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [cutawayProgress, setCutawayProgress] = useState(0);
  const [isHudOpen, setIsHudOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Listen for cutaway state changes from Engine
  useEffect(() => {
    const handleCutawayChanged = (e: any) => {
      if (e && e.detail && typeof e.detail.value === 'number') {
        const val = e.detail.value;
        setCutawayProgress(val);
        if (val > 0) {
          setIsHudOpen(true);
        }
      }
    };
    window.addEventListener('cutaway-changed', handleCutawayChanged);
    return () => window.removeEventListener('cutaway-changed', handleCutawayChanged);
  }, []);

  const toggleCutaway = () => {
    setIsHudOpen((prev) => {
      const next = !prev;
      if (next && cutawayProgress === 0) {
        window.dispatchEvent(new CustomEvent('toggle-cutaway'));
      }
      return next;
    });
  };

  const handleCutawaySlider = (val: number) => {
    setCutawayProgress(val);
    window.dispatchEvent(new CustomEvent('set-cutaway', { detail: { value: val } }));
  };

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

  const handleError = useCallback((errorMsg: string) => {
    setRenderError(errorMsg);
    setLoading(false);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-neutral-950 text-white overflow-hidden font-sans">
      {/* Three.js / WebGPU Base Canvas */}
      <EarthCanvas 
        onLoad={handleLoad} 
        onProgress={setLoadingMsg} 
        onError={handleError}
        onLocationsUpdate={handleLocationsUpdate}
      />

      {/* Render Error Fallback Overlay */}
      {renderError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-neutral-950/95 backdrop-blur-md">
          <div className="max-w-md w-full bg-neutral-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 font-mono">3D Graphics Initialization Failed</h2>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              Could not start hardware-accelerated 3D rendering (WebGPU or WebGL2).
            </p>
            <div className="w-full bg-neutral-950 border border-white/10 rounded-lg p-3 text-left font-mono text-xs text-red-300/80 mb-6 break-words">
              {renderError}
            </div>
            <div className="w-full text-xs text-neutral-400 text-left space-y-1.5 mb-6">
              <p className="font-semibold text-neutral-200">Troubleshooting Steps:</p>
              <p>• Ensure hardware acceleration is enabled in your browser settings.</p>
              <p>• Try updating your GPU drivers or modern browser (Chrome, Edge, Safari).</p>
              <p>• You can switch between WebGPU / WebGL from the GUI control panel.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 border border-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Application
            </button>
          </div>
        </div>
      )}

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

          {/* --- EARTH CROSS-SECTION HUD BUTTON & GEOLOGICAL LEGEND --- */}
          <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-3 max-w-xs w-full pointer-events-auto">
            {/* Cutaway Action Button */}
            <button
              onClick={toggleCutaway}
              className={`w-full py-2.5 px-4 rounded-xl border backdrop-blur-md font-mono text-xs font-semibold tracking-wider transition-all flex items-center justify-between shadow-2xl ${
                isHudOpen
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-amber-500/10'
                  : 'bg-neutral-900/80 hover:bg-neutral-800/90 border-white/15 text-white/90'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className={`w-4 h-4 ${isHudOpen ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`} />
                <span>{cutawayProgress > 0 ? 'EARTH CUTAWAY: ACTIVE' : isHudOpen ? 'EARTH CROSS-SECTION (OPEN)' : 'EARTH CROSS-SECTION'}</span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                isHudOpen ? 'bg-amber-500/30 border-amber-400/40 text-amber-300' : 'bg-white/10 border-white/20 text-neutral-300'
              }`}>
                {cutawayProgress > 0 ? `${Math.round(cutawayProgress * 100)}%` : isHudOpen ? '0%' : 'OPEN HUD'}
              </span>
            </button>

            {/* Geological Structure Legend Overlay */}
            {isHudOpen && (
              <div className="bg-neutral-900/90 border border-amber-500/30 rounded-xl p-3.5 backdrop-blur-lg shadow-2xl flex flex-col gap-2.5 animate-fadeIn font-mono text-xs text-neutral-300">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300 tracking-wider text-[11px] uppercase">
                    <Sliders className="w-3.5 h-3.5" />
                    Internal Layers
                  </div>
                  <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white"
                  >
                    {showLegend ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Depth Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-neutral-400 font-semibold">
                    <span>Peeling Progress</span>
                    <span className="text-amber-300 font-bold">
                      {cutawayProgress <= 0.2 && "Crust (0-20%)"}
                      {cutawayProgress > 0.2 && cutawayProgress <= 0.4 && "Upper Mantle (20-40%)"}
                      {cutawayProgress > 0.4 && cutawayProgress <= 0.6 && "Lower Mantle (40-60%)"}
                      {cutawayProgress > 0.6 && cutawayProgress <= 0.8 && "Outer Core (60-80%)"}
                      {cutawayProgress > 0.8 && "Inner Core (80-100%)"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={cutawayProgress}
                    onChange={(e) => handleCutawaySlider(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Layers Detail List */}
                {showLegend && (
                  <div className="flex flex-col gap-1.5 pt-1 text-[10px] leading-tight">
                    <div className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                      cutawayProgress > 0.8
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                        : 'bg-white/5 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFF5D0] shadow-[0_0_6px_#FFAA00]" />
                        <span className="font-semibold">Inner Core</span>
                      </div>
                      <span className="opacity-80">1,220 km | Solid Fe-Ni</span>
                    </div>

                    <div className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                      cutawayProgress > 0.6 && cutawayProgress <= 0.8
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                        : 'bg-white/5 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B00] shadow-[0_0_6px_#FF2200]" />
                        <span className="font-semibold">Outer Core</span>
                      </div>
                      <span className="opacity-80">2,200 km | Liquid Fe-Ni</span>
                    </div>

                    <div className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                      cutawayProgress > 0.4 && cutawayProgress <= 0.6
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                        : 'bg-white/5 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#C84218]" />
                        <span className="font-semibold">Lower Mantle</span>
                      </div>
                      <span className="opacity-80">2,230 km | Silicates</span>
                    </div>

                    <div className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                      cutawayProgress > 0.2 && cutawayProgress <= 0.4
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                        : 'bg-white/5 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#8D6E63]" />
                        <span className="font-semibold">Upper Mantle</span>
                      </div>
                      <span className="opacity-80">670 km | Asthenosphere</span>
                    </div>

                    <div className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                      cutawayProgress <= 0.2
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                        : 'bg-white/5 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#263238]" />
                        <span className="font-semibold">Crust & Atmos</span>
                      </div>
                      <span className="opacity-80">5–70 km | Lithosphere</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Primary Loading Screen */}
      <Loader visible={loading} message={loadingMsg} />
    </div>
  );
}
