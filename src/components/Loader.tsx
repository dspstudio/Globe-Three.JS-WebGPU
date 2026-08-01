import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoaderProps {
    visible: boolean;
    message: string;
}

const MESSAGE_PROGRESS: Record<string, number> = {
    'Initializing WebGPU Renderer': 10,
    'Setting up Scene & Camera': 20,
    'Loading Celestial Objects': 30,
    'Loading Environment Map (PNG)': 50,
    'Loading Earth Textures': 70,
    'Building Render Pipeline': 85,
    'Compiling Shaders (Warmup)': 95,
    'Loading Complete': 100,
};

export function Loader({ visible, message }: LoaderProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!visible) {
            setProgress(100);
            return;
        }
        
        const targetProgress = MESSAGE_PROGRESS[message] || progress;
        setProgress(targetProgress);
        
        // Add a little fake loading tick on top of the base progress
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= targetProgress + 15 || p >= 95) return p;
                return p + (Math.random() * 2);
            });
        }, 150);
        
        return () => clearInterval(interval);
    }, [message, visible]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, filter: 'blur(10px)' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white font-mono pointer-events-auto overflow-hidden bg-black"
                >
                    {/* Subtle sci-fi background glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-black/90 to-black"></div>
                    
                    {/* Subtle Grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

                    <div className="relative flex flex-col items-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                            className="w-32 h-32 rounded-full border border-white/10 border-t-white/80 border-r-white/30 border-b-transparent border-l-transparent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-16"
                        />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                            className="w-40 h-40 rounded-full border border-white/5 border-t-transparent border-r-transparent border-b-white/40 border-l-transparent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-16"
                        />
                        
                        <div className="w-16 h-16 flex items-center justify-center mb-12">
                            <span className="text-2xl font-light tracking-widest text-white/90">
                                {Math.floor(progress)}
                                <span className="text-white/40 text-sm ml-1">%</span>
                            </span>
                        </div>
                        
                        <h1 className="text-xs tracking-[0.3em] uppercase text-white/30 mb-2">System Boot</h1>
                        <p className="text-xs tracking-widest text-white/80 h-4">{message}</p>
                        
                        <div className="w-64 h-[1px] bg-white/10 mt-6 relative overflow-hidden">
                            <motion.div 
                                className="absolute top-0 left-0 bottom-0 bg-white/80"
                                animate={{ width: `${progress}%` }}
                                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
