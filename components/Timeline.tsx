
import React, { useMemo } from 'react';
import { StoryboardItem } from '../types';

interface TimelineProps {
  storyboard: StoryboardItem[];
  currentTime: number;
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ storyboard, currentTime, onSeek }) => {
  const totalDuration = useMemo(() => {
    if (storyboard.length === 0) return 0;
    const lastItem = storyboard[storyboard.length - 1];
    const [seconds, ms] = lastItem.timestamp.split('.').map(Number);
    return (seconds || 0) + (ms / 1000 || 0) + lastItem.duration;
  }, [storyboard]);

  const timestampToSeconds = (ts: string) => {
    const [s, ms] = ts.split('.').map(Number);
    return (s || 0) + (ms / 1000 || 0);
  };

  return (
    <div className="w-full bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
      <div className="flex justify-between mb-2 text-xs text-slate-400 mono">
        <span>00:00.00</span>
        <span>{totalDuration.toFixed(2)}s</span>
      </div>
      <div 
        className="relative h-12 bg-slate-900 rounded-md overflow-hidden cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          onSeek(percentage * totalDuration);
        }}
      >
        {storyboard.map((item, idx) => {
          const start = timestampToSeconds(item.timestamp);
          const width = (item.duration / totalDuration) * 100;
          const left = (start / totalDuration) * 100;

          return (
            <div
              key={idx}
              className={`absolute h-full border-r border-slate-700/50 flex items-center justify-center text-[8px] font-bold transition-all
                ${item.shot_type === 'CU' ? 'bg-indigo-600/40' : 
                  item.shot_type === 'MS' ? 'bg-emerald-600/40' : 
                  item.shot_type === 'LS' ? 'bg-amber-600/40' : 'bg-rose-600/40'}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${item.timestamp} - ${item.shot_type}`}
            >
              <span className="opacity-0 group-hover:opacity-100">{item.shot_type}</span>
            </div>
          );
        })}
        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ left: `${(currentTime / totalDuration) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Timeline;
