import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { ProjectedLocation, ProjectedCountryLabel } from '../types';

export interface EarthCanvasProps {
    onLoad: () => void;
    onProgress: (msg: string) => void;
    onError?: (errorMsg: string) => void;
    onLocationsUpdate?: (locations: ProjectedLocation[]) => void;
    onCountryLabelsUpdate?: (labels: ProjectedCountryLabel[]) => void;
}

export function EarthCanvas({ onLoad, onProgress, onError, onLocationsUpdate, onCountryLabelsUpdate }: EarthCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    
    // Store callbacks in mutable refs to prevent the engine initialization useEffect 
    // from triggering again when callbacks change.
    const onLocationsUpdateRef = useRef(onLocationsUpdate);
    useEffect(() => {
        onLocationsUpdateRef.current = onLocationsUpdate;
    }, [onLocationsUpdate]);

    const onCountryLabelsUpdateRef = useRef(onCountryLabelsUpdate);
    useEffect(() => {
        onCountryLabelsUpdateRef.current = onCountryLabelsUpdate;
    }, [onCountryLabelsUpdate]);

    useEffect(() => {
        if (!canvasRef.current) return;
        
        let active = true;

        engineRef.current = new Engine(canvasRef.current);

        engineRef.current.onLocationsUpdate = (locations) => {
            if (active && onLocationsUpdateRef.current) {
                onLocationsUpdateRef.current(locations);
            }
        };

        engineRef.current.onCountryLabelsUpdate = (labels) => {
            if (active && onCountryLabelsUpdateRef.current) {
                onCountryLabelsUpdateRef.current(labels);
            }
        };

        engineRef.current.init((msg) => {
            if (active) onProgress(msg);
        }).then(() => {
            if (active) onLoad();
        }).catch((err) => {
            console.error("3D Engine initialization failed:", err);
            if (active) {
                const msg = err instanceof Error ? err.message : String(err);
                if (onError) onError(msg);
            }
        });

        return () => {
            active = false;
            if (engineRef.current) {
                engineRef.current.dispose();
                engineRef.current = null;
            }
        };
    }, [onLoad, onProgress]);

    return (
        <div className="w-full h-full relative bg-neutral-950 overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full absolute inset-0 block touch-none" />
        </div>
    );
}
