import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { ProjectedLocation } from '../types';

export interface EarthCanvasProps {
    onLoad: () => void;
    onProgress: (msg: string) => void;
    onLocationsUpdate?: (locations: ProjectedLocation[]) => void;
}

export function EarthCanvas({ onLoad, onProgress, onLocationsUpdate }: EarthCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    
    // Store callback in a mutable ref to prevent the engine initialization useEffect 
    // from triggering again when onLocationsUpdate changes.
    const onLocationsUpdateRef = useRef(onLocationsUpdate);
    useEffect(() => {
        onLocationsUpdateRef.current = onLocationsUpdate;
    }, [onLocationsUpdate]);

    useEffect(() => {
        if (!canvasRef.current) return;
        
        let active = true;

        engineRef.current = new Engine(canvasRef.current);

        engineRef.current.onLocationsUpdate = (locations) => {
            if (active && onLocationsUpdateRef.current) {
                onLocationsUpdateRef.current(locations);
            }
        };

        engineRef.current.init((msg) => {
            if (active) onProgress(msg);
        }).then(() => {
            if (active) onLoad();
        }).catch((err) => {
            console.error(err);
            if (active) onLoad();
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
