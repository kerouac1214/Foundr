import React from 'react';
import { StoryboardItem } from '../types';

interface TimelineProps {
  storyboard: StoryboardItem[];
  currentIndex: number;
  onSeek: (index: number) => void;
}

/**
 * 视频成片页时间轴组件
 * 显示所有分镜的进度条，支持点击跳转
 */
const Timeline: React.FC<TimelineProps> = ({ storyboard, currentIndex, onSeek }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const total = storyboard.length;

  if (total === 0) return null;

  // Auto-scroll to active shot
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(`[data-shot-index="${currentIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const getShotColor = (shotType: string) => {
    switch (shotType) {
      case 'CU': return 'bg-amber-500';      // 特写
      case 'MCU': return 'bg-orange-500';    // 中特写
      case 'MS': return 'bg-emerald-500';    // 中景
      case 'MLS': return 'bg-teal-500';      // 中全景
      case 'LS': return 'bg-blue-500';       // 全景
      case 'ELS': return 'bg-indigo-500';    // 远景
      default: return 'bg-zinc-500';
    }
  };

  return (
    <div className="w-full select-none">
      {/* Timecode Ruler */}
      <div className="flex px-4 mb-2 opacity-30">
        <div className="flex gap-[160px]">
          {storyboard.map((_, i) => (
            <div key={i} className="text-[9px] font-mono w-[160px] border-l border-zinc-700 pl-1">
              00:{String(Math.floor((i * 3) / 60)).padStart(2, '0')}:{String((i * 3) % 60).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Ribbon */}
      <div
        ref={scrollContainerRef}
        className="relative h-28 bg-zinc-950/40 rounded-2xl border border-white/5 backdrop-blur-3xl overflow-x-auto scrollbar-hide flex items-center px-4 gap-1 snap-x"
      >
        {storyboard.map((item, idx) => {
          const isActive = idx === currentIndex;
          const isRendered = item.render_status === 'done' || !!item.preview_url;
          const isVideoReady = item.video_status === 'ready' || !!item.video_url;
          const isLocked = item.isLocked;

          return (
            <button
              key={item.id}
              data-shot-index={idx}
              onClick={() => onSeek(idx)}
              className={`
                relative flex-shrink-0 w-[160px] h-20 rounded-xl overflow-hidden transition-all duration-300 snap-center
                border-2 flex flex-col items-start justify-end p-2 group
                ${isActive ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/10 scale-[1.02] z-10' : 'border-white/5 hover:border-white/20'}
                ${!isRendered && !isActive ? 'bg-zinc-900/50' : 'bg-zinc-900'}
              `}
            >
              {/* Background Thumbnail */}
              {item.preview_url && (
                <img
                  src={item.preview_url}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`}
                  alt=""
                />
              )}

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

              {/* Status Badges */}
              <div className="absolute top-2 right-2 flex gap-1 items-center z-10">
                {isLocked && (
                  <div className="p-1 bg-zinc-900/80 rounded-md backdrop-blur-md border border-white/10">
                    <svg className="w-2 h-2 text-zinc-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  </div>
                )}
                {isVideoReady && (
                  <div className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" title="视频就绪" />
                )}
              </div>

              {/* Shot Label */}
              <div className="relative z-10 flex flex-col items-start gap-0.5">
                <div className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase ${getShotColor(item.shot_type)} text-white`}>
                  {item.shot_type}
                </div>
                <div className="text-[10px] font-black text-white/90 italic mono">
                  SHOT {String(item.shot_number).padStart(2, '0')}
                </div>
              </div>

              {/* Bottom Progress Bar (Local) */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                <div
                  className={`h-full transition-all duration-500 ${isRendered ? 'bg-zinc-400' : 'bg-transparent'}`}
                  style={{ width: isRendered ? '100%' : '0%' }}
                />
                {isVideoReady && (
                  <div className="absolute inset-0 bg-[#D4AF37]" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend & Stats Area */}
      <div className="mt-4 flex justify-between items-center px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_5px_#D4AF37]"></span>
            <span className="text-[9px] font-bold text-zinc-500 uppercase">Master Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
            <span className="text-[9px] font-bold text-zinc-500 uppercase">Previz Frame</span>
          </div>
        </div>

        <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5">
          <span className="text-[10px] font-black text-zinc-400 mono tracking-widest">
            {storyboard.filter(s => s.video_url).length < 10 ? '0' : ''}{storyboard.filter(s => s.video_url).length} : {total < 10 ? '0' : ''}{total}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
