import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';

export interface EarthCanvasProps {
    onLoad: () => void;
    onProgress: (msg: string) => void;
}

export function EarthCanvas({ onLoad, onProgress }: EarthCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        
        let active = true;

        engineRef.current = new Engine(canvasRef.current);
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
    }, [onLoad]);

    return (
        <div className="w-full h-full relative bg-neutral-950 overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full absolute inset-0 block touch-none" />
        </div>
    );
}
