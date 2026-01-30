
import React from 'react';
import { StoryboardItem, GlobalContext } from '../types';

interface StoryboardCardProps {
  item: StoryboardItem;
  context: GlobalContext;
  onUpdate: (updated: StoryboardItem) => void;
  onRenderPhoto: () => Promise<void>;
  onRenderVideo: () => Promise<void>;
}

const SHOT_TYPES = [
  { value: 'CU', label: '特写 (CU)' },
  { value: 'MS', label: '中景 (MS)' },
  { value: 'LS', label: '全景 (LS)' },
  { value: 'POV', label: '第一视角 (POV)' }
] as const;

const StoryboardCard: React.FC<StoryboardCardProps> = ({ item, context, onUpdate, onRenderPhoto, onRenderVideo }) => {
  const aspectRatioClass = context.aspect_ratio === '16:9' ? 'aspect-video' : 
                           context.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/3]';

  const toggleCharacter = (id: string) => {
    const newIds = item.character_ids.includes(id)
      ? item.character_ids.filter(cid => cid !== id)
      : [...item.character_ids, id];
    onUpdate({ ...item, character_ids: newIds });
  };

  return (
    <div className="bg-[#0a0a0a] rounded-[2rem] overflow-hidden border border-white/20 flex flex-col group hover:border-[#D4AF37]/50 transition-all duration-500 shadow-2xl">
      <div className={`relative ${aspectRatioClass} bg-zinc-900 overflow-hidden`}>
        {item.preview_url ? (
          <img src={item.preview_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[4000ms] ease-out" alt={`Shot ${item.shot_number}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-3">
            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-[0.3em]">等待渲染</span>
          </div>
        )}
        
        {item.video_url && (
          <div className="absolute inset-0 bg-[#D4AF37]/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none border border-[#D4AF37]/20">
            <div className="bg-[#D4AF37] p-2.5 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)]">
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm10 2a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V9a1 1 0 00-1-1h-2z" /></svg>
            </div>
          </div>
        )}

        {/* 景别选择下拉菜单 */}
        <div className="absolute top-4 left-4 z-20">
          <select 
            value={item.shot_type}
            onChange={(e) => onUpdate({ ...item, shot_type: e.target.value as any })}
            className="px-4 py-1.5 bg-black/80 hover:bg-black rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#D4AF37]/40 text-[#D4AF37] backdrop-blur-xl outline-none cursor-pointer transition-all"
          >
            {SHOT_TYPES.map(st => (
              <option key={st.value} value={st.value} className="bg-zinc-900">{st.label}</option>
            ))}
          </select>
        </div>

        <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 rounded-full text-[9px] font-black tracking-tighter border border-white/10 backdrop-blur-sm z-10 text-white/50">
          SHOT #{item.shot_number}
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col gap-4">
        <textarea 
          value={item.lyric_line}
          onChange={(e) => onUpdate({...item, lyric_line: e.target.value})}
          placeholder="在此输入台词或歌词内容..."
          className="text-[13px] text-zinc-100 bg-transparent border-none outline-none italic resize-none h-12 scrollbar-none serif leading-relaxed placeholder:text-zinc-400"
        />
        
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 group-hover:border-white/20 transition-colors">
          <textarea 
            value={item.action_description}
            onChange={(e) => onUpdate({...item, action_description: e.target.value})}
            className="w-full bg-transparent border-none outline-none text-[12px] text-zinc-200 leading-snug resize-none h-16 scrollbar-none placeholder:text-zinc-400"
            placeholder="描述镜头动作、场景调度或光影需求..."
          />
        </div>

        <div className="flex flex-wrap gap-2 py-1">
          {context.characters.map(c => (
            <button 
              key={c.char_id} 
              onClick={() => toggleCharacter(c.char_id)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${item.character_ids.includes(c.char_id) ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-transparent border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mt-auto pt-4 gap-3 border-t border-white/10">
          <div className="flex-grow">
            <span className="text-[8px] text-zinc-300 font-black uppercase tracking-widest block mb-1">分镜标识</span>
            <span className="text-[10px] mono text-zinc-200">ID: {item.id.slice(-6).toUpperCase()}</span>
          </div>
          
          <button 
            onClick={onRenderPhoto}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white text-zinc-200 hover:text-black rounded-xl transition-all border border-white/10"
            title="生成预览图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          
          <button 
            disabled={item.video_status === 'generating'}
            onClick={onRenderVideo}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${item.video_status === 'generating' ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40 animate-pulse' : 'bg-[#D4AF37]/10 hover:bg-[#D4AF37] border-[#D4AF37]/20 text-[#D4AF37] hover:text-black'}`}
            title="生成视频片段"
          >
            {item.video_status === 'generating' ? (
               <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryboardCard;
