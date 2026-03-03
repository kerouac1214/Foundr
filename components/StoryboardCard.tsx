import React from 'react';
import { StoryboardItem, GlobalContext } from '../types';
import { VIDEO_ENGINES, SHOT_TYPES, CAMERA_MOVEMENTS, COMPOSITION_SHOTS } from '../constants';

interface StoryboardCardProps {
  item: StoryboardItem;
  context: GlobalContext;
  onUpdate: (updates: Partial<StoryboardItem>) => void;
  onRenderPhoto: () => Promise<void>;
  onRenderVideo: () => Promise<void>;
  mode?: 'text-only' | 'visual';
  layout?: 'list' | 'grid';
  viewMode?: 'images_only' | 'videos_only';
  onImageClick?: () => void;
  onRenderCandidates: () => Promise<void>;
  onDerive?: () => void;
  onDeleteImage?: (url: string) => void;
  onSetPreview?: (url: string, lock?: boolean) => void;
}

const StoryboardCard: React.FC<StoryboardCardProps> = ({
  item,
  context,
  onUpdate,
  onRenderPhoto,
  onRenderCandidates,
  onRenderVideo,
  onDerive,
  onDeleteImage,
  onSetPreview,
  mode = 'visual',
  layout = 'list',
  viewMode,
  onImageClick
}) => {
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false);
  const aspectRatioClass = context.aspect_ratio === '16:9' ? 'aspect-video' :
    context.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/3]';

  const toggleCharacter = (id: string) => {
    const chars = item.character_ids || [];
    const newIds = chars.includes(id)
      ? chars.filter(cid => cid !== id)
      : [...chars, id];
    onUpdate({ character_ids: newIds });
  };

  const toggleLock = () => {
    onUpdate({ isLocked: !item.isLocked });
  };

  return (
    <div
      data-shot-number={item.shot_number}
      className={`bg-[#0a0a0a] rounded-[2rem] overflow-hidden border flex flex-col group transition-all duration-500 shadow-2xl ${item.isLocked ? 'border-emerald-500/50 ring-2 ring-emerald-500/10' : 'border-white/20 hover:border-[#D4AF37]/50'}`}
    >

      {/* Visual Mode: Show Image Container */}
      {mode === 'visual' && (
        <div
          onClick={onImageClick}
          className={`relative ${item.preview_url ? aspectRatioClass : 'h-24'} bg-zinc-900 overflow-hidden cursor-zoom-in transition-all duration-500`}
        >
          {item.preview_url ? (
            <img src={item.preview_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[4000ms] ease-out" alt={`镜头 ${item.shot_number}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center gap-4 px-6 bg-gradient-to-br from-zinc-900 to-black">
              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0">
                <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] mono text-zinc-500 uppercase tracking-tighter">待预览 (No Preview)</span>
                <span className="text-[10px] mono text-zinc-300 font-bold">SHA: {item.id ? item.id.slice(-6).toUpperCase() : 'NEW'}</span>
              </div>
            </div>
          )}

          {item.video_url && (
            <div className="absolute inset-0 bg-[#D4AF37]/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none border border-[#D4AF37]/20">
              <div className="bg-[#D4AF37] p-2.5 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm10 2a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V9a1 1 0 00-1-1h-2z" /></svg>
              </div>
            </div>
          )}

          {/* Controls Overlay (Visual Mode) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 z-20 flex flex-col gap-2"
          >
            <select
              title="镜头类型"
              value={item.shot_type}
              onChange={(e) => onUpdate({ ...item, shot_type: e.target.value as any })}
              className="px-4 py-1.5 bg-black/80 hover:bg-black rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#D4AF37]/40 text-[#D4AF37] backdrop-blur-xl outline-none cursor-pointer transition-all"
            >
              {SHOT_TYPES.map(st => (
                <option key={st.value} value={st.value} className="bg-zinc-900">{st.label}</option>
              ))}
            </select>

            <select
              title="构图与关系镜头"
              value={item.composition || 'Standard'}
              onChange={(e) => onUpdate({ ...item, composition: e.target.value })}
              className="px-4 py-1.5 bg-black/80 hover:bg-black rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#D4AF37]/40 text-emerald-400 backdrop-blur-xl outline-none cursor-pointer transition-all max-w-[140px] truncate"
            >
              {COMPOSITION_SHOTS.map(cs => (
                <option key={cs.value} value={cs.value} title={cs.desc} className="bg-zinc-900">{cs.label}</option>
              ))}
            </select>

            <select
              title="所属场景"
              value={item.scene_id || ''}
              onChange={(e) => onUpdate({ ...item, scene_id: e.target.value })}
              className="px-4 py-1.5 bg-black/80 hover:bg-black rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#D4AF37]/40 text-zinc-300 backdrop-blur-xl outline-none cursor-pointer transition-all max-w-[140px] truncate"
            >
              <option value="" className="bg-zinc-900">自动场景</option>
              {context.scenes.map(s => (
                <option key={s.scene_id} value={s.scene_id} className="bg-zinc-900">{s.name}</option>
              ))}
            </select>
          </div>

          <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
            <div className="flex items-center gap-2">
              {item.render_status === 'rendering' && <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />}
              <div className="px-3 py-1 bg-black/60 rounded-full text-[9px] font-black tracking-tighter border border-white/10 backdrop-blur-sm text-white/50">#{item.shot_number}</div>
            </div>

            {(!viewMode || viewMode === 'images_only') && (
              <button
                onClick={(e) => { e.stopPropagation(); onRenderPhoto(); }}
                className="w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-white text-white/40 hover:text-black rounded-lg transition-all border border-white/20 backdrop-blur-md"
                title="生成预览图"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
            )}

            {viewMode === 'videos_only' && (
              <button
                disabled={item.video_status === 'generating'}
                onClick={(e) => { e.stopPropagation(); onRenderVideo(); }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border ${item.video_status === 'generating' ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40 animate-pulse' : 'bg-black/60 hover:bg-[#D4AF37] border-white/20 text-white/40 hover:text-black backdrop-blur-md'}`}
                title="生成视频"
              >
                {item.video_status === 'generating' ? (
                  <div className="w-3 h-3 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); toggleLock(); }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border ${item.isLocked ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-black/60 border-white/20 text-white/40 hover:text-emerald-400 hover:border-emerald-400/50 backdrop-blur-md'}`}
              title={item.isLocked ? '解锁镜头' : '锁定镜头'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="p-6 flex-grow flex flex-col gap-4">
        <textarea
          value={item.lyric_line}
          onChange={(e) => onUpdate({ ...item, lyric_line: e.target.value })}
          placeholder="在此输入台词或歌词内容..."
          className="text-[13px] text-zinc-100 bg-transparent border-none outline-none italic resize-none h-12 scrollbar-none serif leading-relaxed placeholder:text-zinc-400"
        />

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 group-hover:border-white/20 transition-colors">
          <textarea
            value={item.action_description}
            onChange={(e) => onUpdate({ ...item, action_description: e.target.value })}
            className="w-full bg-transparent border-none outline-none text-[12px] text-zinc-200 leading-snug resize-none h-16 scrollbar-none placeholder:text-zinc-400"
            placeholder="描述镜头动作、场景调度或光影需求..."
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <div className="flex items-start gap-2">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1 shrink-0">出场角色</span>
            <div className="flex flex-wrap gap-1.5">
              {context.characters.map(c => (
                <button
                  key={c.char_id}
                  onClick={() => toggleCharacter(c.char_id)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border ${item.character_ids?.includes(c.char_id) ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]' : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
                >
                  {c.name}
                </button>
              ))}
              {(!item.character_ids || item.character_ids.length === 0) && (
                <span className="text-[9px] text-zinc-600 py-0.5 italic">无角色</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1 shrink-0">所属场景</span>
            <div className="flex flex-wrap gap-1.5">
              {context.scenes.map(s => (
                <button
                  key={s.scene_id}
                  onClick={() => onUpdate({ ...item, scene_id: s.scene_id })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border ${item.scene_id === s.scene_id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
                >
                  {s.name}
                </button>
              ))}
              {!item.scene_id && (
                <span className="text-[9px] text-zinc-600 py-0.5 italic">未指定</span>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Editor Section */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="flex items-center gap-2 text-[9px] text-zinc-500 font-bold uppercase tracking-widest hover:text-[#D4AF37] transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${isPromptExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              {viewMode === 'videos_only' ? '视频生产提示词' : 'AI 提示词'} (可手动编辑)
            </button>
            {(viewMode === 'videos_only' ? item.video_prompt : item.image_prompt) && (
              <span className="text-[8px] text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">已编辑</span>
            )}
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${isPromptExpanded ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <textarea
                value={viewMode === 'videos_only'
                  ? (item.video_prompt || item.ai_prompts?.video_generation_prompt || '')
                  : (item.image_prompt || item.ai_prompts?.image_generation_prompt || '')}
                onChange={(e) => onUpdate(viewMode === 'videos_only' ? { video_prompt: e.target.value } : { image_prompt: e.target.value })}
                placeholder={viewMode === 'videos_only' ? "在此编辑用于视频生成的提示词..." : "在此编辑用于生图的提示词..."}
                className="w-full bg-transparent border-none outline-none text-[11px] text-[#D4AF37]/80 leading-relaxed min-h-[80px] scrollbar-thin scrollbar-thumb-white/10"
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1 italic">提示：编辑此框后，“渲染”将优先使用此处内容。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryboardCard;
