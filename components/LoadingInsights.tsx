
import React, { useState, useEffect } from 'react';
import { LOADING_INSIGHTS, LoadingInsight } from '../src/data/loadingInsights';

const LoadingInsights: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsVisible(false);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % LOADING_INSIGHTS.length);
                setIsVisible(true);
            }, 800); // Wait for fade out
        }, 8000); // Rotate every 8 seconds

        return () => clearInterval(interval);
    }, []);

    const current = LOADING_INSIGHTS[currentIndex];

    return (
        <div className="w-full max-w-5xl h-[450px] mx-auto mt-12 bg-[#08090b] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col md:flex-row relative group animate-in zoom-in-95 duration-1000">

            {/* Left: Cinematic Image Area */}
            <div className="w-full md:w-3/5 h-full relative overflow-hidden bg-black">
                <div
                    className={`absolute inset-0 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                >
                    <img
                        src={current.image}
                        alt={current.title}
                        className="w-full h-full object-cover transition-transform duration-[10000ms] ease-linear scale-100 group-hover:scale-110"
                        style={{ transform: isVisible ? 'scale(1.15)' : 'scale(1)' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#08090b]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-transparent opacity-60" />
                </div>

                {/* Badge */}
                <div className="absolute top-6 left-6 px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full z-10">
                    <span className="text-[10px] font-black tracking-[0.2em] text-[#D4AF37] uppercase">Cinematic Lab</span>
                </div>
            </div>

            {/* Right: Insights Content */}
            <div className={`w-full md:w-2/5 h-full p-10 flex flex-col justify-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-[#D4AF37] text-xs font-black tracking-widest uppercase mb-2">
                            {current.title}
                        </h3>
                        <div className="h-px w-12 bg-[#D4AF37]/30" />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">AI Prompt</label>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl italic">
                                <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
                                    "{current.prompt}"
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Director's Tip</label>
                            <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                                {current.tip}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-8 flex items-center gap-2">
                    {LOADING_INSIGHTS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-6 bg-[#D4AF37]' : 'w-1.5 bg-white/10'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Subtle Overlay Pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        </div>
    );
};

export default LoadingInsights;
