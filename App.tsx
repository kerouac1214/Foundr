
import React, { useState, useEffect, useRef } from 'react';
import { AppState, StoryboardItem, GlobalContext, CharacterDNA, EnvironmentDNA, AspectRatio, ImageEngine } from './types';
import { extractCharacters, forgeEnvironmentDNA, forgeCharacterDNA, generateStoryboard, refineShotPrompt, generateVisualPreview, generateVideoForShot } from './services/geminiService';
import StoryboardCard from './components/StoryboardCard';

const STYLE_CATEGORIES = [
  {
    id: 'cinematic',
    name: '电影质感 (Cinematic)',
    subStyles: [
      { name: '王家卫风格 (情绪化)', value: 'Wong Kar-wai style, moody lighting, saturated colors, step-printing effect, nostalgic Hong Kong cinema aesthetic, neon glow' },
      { name: '韦斯·安德森 (对称美)', value: 'Wes Anderson style, perfectly symmetrical composition, pastel color palette, whimsical flat lay design, center-framed' },
      { name: '新好莱坞 (商业大片)', value: 'Modern Hollywood blockbuster aesthetic, anamorphic lens flares, rich blacks, teal and orange highlights, cinematic grain' }
    ]
  },
  {
    id: 'art',
    name: '艺术风格 (Artistic)',
    subStyles: [
      { name: '极致极简 (Minimal)', value: 'Minimalist cinematography, monochromatic lighting, negative space, soft shadows, clean geometry' },
      { name: '新海诚 (唯美光影)', value: 'Makoto Shinkai movie style, hyper-detailed backgrounds, beautiful lens flare, emotive sunset lighting, vast blue sky gradients' },
      { name: '油画古典 (Classical)', value: 'Classical oil painting texture, Rembrandt lighting, deep chiaroscuro, rich warm tones, painterly strokes' }
    ]
  }
];

const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: '16:9 宽屏', value: '16:9' },
  { label: '9:16 竖屏', value: '9:16' }
];

const IMAGE_ENGINES: { label: string; value: ImageEngine; desc: string }[] = [
  { label: 'Gemini Engine', value: 'google', desc: '极致光影精度' },
  { label: 'RunningHub', value: 'runninghub', desc: '专业级角色一致性' }
];

const INITIAL_STATE: AppState = {
  lyrics: '',
  isAnalyzing: false,
  progress: 0,
  statusMessage: '',
  phase: 'idle',
  project: null,
  global_context: {
    style_package: "高对比度，细节丰富",
    visual_style_category: 'cinematic',
    visual_style_subcategory_name: '王家卫风格 (情绪化)',
    visual_style_preset: 'Wong Kar-wai style, moody lighting, saturated colors, nostalgic Hong Kong cinema aesthetic',
    core_colors: "极黑, 金色, 珍珠白",
    aspect_ratio: '16:9',
    image_engine: 'google',
    characters: []
  },
  error: null,
  activeView: 'context'
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [masterPlayingIdx, setMasterPlayingIdx] = useState<number>(0);
  const [isBatching, setIsBatching] = useState(false);

  const handleReset = () => {
    if (window.confirm('确定要放弃当前所有进度并重新开始吗？')) {
      setState(INITIAL_STATE);
    }
  };

  const handleScriptAnalysis = async () => {
    if (!state.lyrics) return;
    setState(s => ({ ...s, isAnalyzing: true, statusMessage: 'Gemini 正在深度解析剧本...', progress: 10 }));
    try {
      const charDrafts = await extractCharacters(state.lyrics);
      const envDNA = await forgeEnvironmentDNA(state.lyrics, state.global_context);
      const forgedChars: CharacterDNA[] = [];
      for (const draft of charDrafts) {
        const dna = await forgeCharacterDNA(draft, state.global_context);
        forgedChars.push(dna);
      }
      setState(s => ({ 
        ...s, isAnalyzing: false, phase: 'extracting_assets', activeView: 'foundry', 
        global_context: { ...s.global_context, characters: forgedChars, environment: envDNA } 
      }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: `分析失败: ${err.message}` }));
    }
  };

  const handleRenderAssets = async () => {
    if (!state.global_context.environment) return;
    setState(s => ({ ...s, isAnalyzing: true, statusMessage: `正在铸造视觉资产...`, progress: 20 }));
    try {
      const envPreview = await generateVisualPreview('google', state.global_context.environment.visual_anchor_prompt, 42, state.global_context.aspect_ratio);
      const updatedChars = [];
      for (let i = 0; i < state.global_context.characters.length; i++) {
        const char = state.global_context.characters[i];
        setState(s => ({ ...s, statusMessage: `正在渲染角色: ${char.name}...`, progress: 20 + (i + 1) * 10 }));
        const prompt = `${char.consistency_seed_prompt} in environment: ${state.global_context.environment?.visual_anchor_prompt}`;
        const previewUrl = await generateVisualPreview('google', prompt, char.seed, state.global_context.aspect_ratio);
        updatedChars.push({ ...char, preview_url: previewUrl });
      }
      setState(s => ({
        ...s, isAnalyzing: false, phase: 'assets_ready',
        global_context: {
          ...s.global_context,
          environment: { ...s.global_context.environment!, preview_url: envPreview },
          characters: updatedChars
        }
      }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: `资产铸造失败: ${err.message}` }));
    }
  };

  const reRenderSpecificCharacter = async (charId: string) => {
    const char = state.global_context.characters.find(c => c.char_id === charId);
    if (!char || !state.global_context.environment) return;
    setState(s => ({ ...s, isAnalyzing: true, statusMessage: `正在重绘角色: ${char.name}...`, progress: 50 }));
    try {
      const prompt = `${char.consistency_seed_prompt} in environment: ${state.global_context.environment.visual_anchor_prompt}`;
      const url = await generateVisualPreview('google', prompt, char.seed, state.global_context.aspect_ratio);
      setState(s => ({
        ...s, isAnalyzing: false,
        global_context: {
          ...s.global_context,
          characters: s.global_context.characters.map(c => c.char_id === charId ? { ...c, preview_url: url } : c)
        }
      }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: `角色重绘失败: ${err.message}` }));
    }
  };

  const handleGenerateStoryboard = async () => {
    setState(s => ({ ...s, isAnalyzing: true, statusMessage: '正在生成分镜脚本...', progress: 80 }));
    try {
      const { metadata, initial_script } = await generateStoryboard(state.lyrics, state.global_context.characters);
      setState(s => ({
        ...s, isAnalyzing: false, phase: 'script_ready', activeView: 'storyboard',
        project: {
          metadata,
          storyboard: initial_script.map((s, i) => ({ 
            ...s, id: `shot_${Date.now()}_${i}`, shot_number: i+1, visual_content: '', seed: Math.floor(Math.random()*1000000), video_status: 'idle'
          }))
        }
      }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: `分镜生成失败: ${err.message}` }));
    }
  };

  const renderSinglePhoto = async (index: number) => {
    if (!state.project || !state.global_context.environment) return;
    const item = state.project.storyboard[index];
    const chars = state.global_context.characters.filter(c => item.character_ids.includes(c.char_id));
    const prompt = refineShotPrompt(item, chars, state.global_context.environment, state.global_context);
    
    // 构造参考图列表（环境图 + 所有涉及角色的基准图）
    const refImages: string[] = [];
    if (state.global_context.environment.preview_url) {
        refImages.push(state.global_context.environment.preview_url);
    }
    chars.forEach(c => {
        if (c.preview_url) refImages.push(c.preview_url);
    });

    try {
      const url = await generateVisualPreview(state.global_context.image_engine, prompt, item.seed, state.global_context.aspect_ratio, refImages);
      const newShots = [...state.project.storyboard];
      newShots[index] = { ...item, preview_url: url, visual_content: prompt };
      setState(s => ({ ...s, project: { ...s.project!, storyboard: newShots } }));
    } catch (err: any) {
      console.error("Single Photo Render Error:", err);
      setState(s => ({ ...s, error: `分镜 ${index+1} 渲染失败: ${err.message}` }));
    }
  };

  const batchRenderAllPhotos = async () => {
    if (!state.project) return;
    setIsBatching(true);
    const engineName = state.global_context.image_engine === 'google' ? 'Gemini' : 'RunningHub';
    setState(s => ({ ...s, isAnalyzing: true, progress: 0, statusMessage: `正在使用 ${engineName} 批量渲染分镜...` }));
    const total = state.project.storyboard.length;
    for (let i = 0; i < total; i++) {
      setState(s => ({ ...s, progress: Math.floor((i / total) * 100), statusMessage: `渲染中: ${i+1}/${total}` }));
      await renderSinglePhoto(i);
    }
    setIsBatching(false);
    setState(s => ({ ...s, isAnalyzing: false }));
  };

  const renderSingleVideo = async (index: number) => {
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }
    if (!state.project || !state.global_context.environment) return;
    const item = state.project.storyboard[index];
    const chars = state.global_context.characters.filter(c => item.character_ids.includes(c.char_id));
    const prompt = refineShotPrompt(item, chars, state.global_context.environment, state.global_context);
    const startedShots = [...state.project.storyboard];
    startedShots[index] = { ...item, video_status: 'generating' };
    setState(s => ({ ...s, project: { ...s.project!, storyboard: startedShots } }));
    try {
      const url = await generateVideoForShot(prompt, state.global_context.aspect_ratio);
      const finishedShots = [...state.project.storyboard];
      finishedShots[index] = { ...item, video_url: url, video_status: 'ready' };
      setState(s => ({ ...s, project: { ...s.project!, storyboard: finishedShots } }));
    } catch (err: any) {
      const failedShots = [...state.project.storyboard];
      failedShots[index] = { ...item, video_status: 'idle' };
      setState(s => ({ ...s, project: { ...s.project!, storyboard: failedShots }, error: `分镜 ${index+1} 视频失败: ${err.message}` }));
    }
  };

  const batchRenderAllVideos = async () => {
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }
    if (!state.project) return;
    setIsBatching(true);
    setState(s => ({ ...s, isAnalyzing: true, progress: 0, statusMessage: '启动智能合成...' }));
    const total = state.project.storyboard.length;
    for (let i = 0; i < total; i++) {
      if (state.project.storyboard[i].video_url) continue;
      setState(s => ({ ...s, progress: Math.floor((i / total) * 100), statusMessage: `合成中: ${i+1}/${total}` }));
      await renderSingleVideo(i);
    }
    setIsBatching(false);
    setState(s => ({ ...s, isAnalyzing: false, phase: 'finalized', activeView: 'video_master' }));
  };

  const updateShot = (index: number, updated: StoryboardItem) => {
    if (!state.project) return;
    const newS = [...state.project.storyboard];
    newS[index] = updated;
    setState(s => ({...s, project: {...state.project!, storyboard: newS}}));
  };

  const updateEnvironment = (updates: Partial<EnvironmentDNA>) => {
    if (!state.global_context.environment) return;
    setState(s => ({
      ...s,
      global_context: {
        ...s.global_context,
        environment: { ...s.global_context.environment!, ...updates }
      }
    }));
  };

  const updateCharacter = (charId: string, updates: Partial<CharacterDNA>) => {
    setState(s => ({
      ...s,
      global_context: {
        ...s.global_context,
        characters: s.global_context.characters.map(c => c.char_id === charId ? { ...c, ...updates } : c)
      }
    }));
  };

  useEffect(() => {
    if (state.activeView === 'video_master' && videoPlayerRef.current) {
      const handleEnded = () => {
        if (state.project && masterPlayingIdx < state.project.storyboard.length - 1) {
          const nextIdx = masterPlayingIdx + 1;
          if (state.project.storyboard[nextIdx].video_url) setMasterPlayingIdx(nextIdx);
        }
      };
      videoPlayerRef.current.addEventListener('ended', handleEnded);
      return () => videoPlayerRef.current?.removeEventListener('ended', handleEnded);
    }
  }, [state.activeView, masterPlayingIdx, state.project]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#D4AF37]/30 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-3xl border-b border-white/10 z-50 px-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center font-black italic shadow-[0_0_25px_rgba(212,175,55,0.4)] text-black text-xl">F</div>
          <div><h1 className="text-sm font-black tracking-[0.4em] uppercase serif">Foundry</h1><span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest block">智能导剪专业版</span></div>
        </div>
        <nav className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 shadow-inner">
          <button onClick={() => setState(s => ({...s, activeView: 'context'}))} className={`px-8 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${state.activeView === 'context' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>01 剧本</button>
          <button disabled={state.phase === 'idle'} onClick={() => setState(s => ({...s, activeView: 'foundry'}))} className={`px-8 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${state.activeView === 'foundry' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>02 资产</button>
          <button disabled={state.phase !== 'assets_ready' && !state.project} onClick={() => setState(s => ({...s, activeView: 'storyboard'}))} className={`px-8 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${state.activeView === 'storyboard' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>03 分镜</button>
          <button disabled={!state.project} onClick={() => setState(s => ({...s, activeView: 'video_master'}))} className={`px-8 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${state.activeView === 'video_master' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>04 成片</button>
        </nav>
        <div className="flex items-center gap-4">
          <button onClick={handleReset} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black">重置</button>
          {state.phase === 'idle' && <button onClick={handleScriptAnalysis} className="px-8 py-3 bg-[#D4AF37] text-black rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.2)]">启动分析</button>}
          {state.phase === 'extracting_assets' && state.activeView === 'foundry' && <button onClick={handleRenderAssets} className="px-8 py-3 bg-[#D4AF37] text-black rounded-xl text-[11px] font-black uppercase tracking-widest">铸造预览</button>}
          {state.phase === 'assets_ready' && state.activeView === 'foundry' && <button onClick={handleGenerateStoryboard} className="px-8 py-3 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest">生成分镜</button>}
        </div>
      </header>

      <main className="pt-32 pb-40 px-12 max-w-[1700px] mx-auto">
        {state.error && (
          <div className="mb-10 p-6 bg-red-950/20 border border-red-900/40 rounded-[2rem] text-red-400 text-[11px] font-bold uppercase tracking-widest flex items-center justify-between backdrop-blur-xl">
            <span className="flex items-center gap-3"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>系统异常: {state.error}</span>
            <button onClick={() => setState(s => ({...s, error: null}))} className="p-2 hover:bg-white/10 rounded-full">✕</button>
          </div>
        )}

        {state.activeView === 'context' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-700">
            <div className="bg-[#050505] p-12 rounded-[4rem] border border-white/10 space-y-10">
              <div className="flex items-center gap-4"><div className="w-1 h-6 bg-[#D4AF37] rounded-full" /><h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">文学剧本输入</h2></div>
              <textarea value={state.lyrics} onChange={e => setState(s => ({...s, lyrics: e.target.value}))} placeholder="输入剧本..." className="w-full h-[550px] bg-black border border-white/10 rounded-[3rem] p-10 text-base outline-none resize-none serif leading-relaxed" />
            </div>
            <div className="bg-[#050505] p-12 rounded-[4rem] border border-white/10 space-y-12">
              <div className="space-y-8"><h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">画幅比例</h2><div className="grid grid-cols-2 gap-4">{ASPECT_RATIOS.map(ar => (<button key={ar.value} onClick={() => setState(s => ({...s, global_context: {...s.global_context, aspect_ratio: ar.value}}))} className={`p-8 rounded-3xl border transition-all text-[11px] font-black ${state.global_context.aspect_ratio === ar.value ? 'bg-white text-black shadow-2xl' : 'bg-white/5 border-white/5 text-zinc-200'}`}>{ar.label}</button>))}</div></div>
              <div className="space-y-8"><h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">导演风格预设</h2><div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-3">{STYLE_CATEGORIES.flatMap(c => c.subStyles).map(sub => (<button key={sub.name} onClick={() => setState(s => ({...s, global_context: {...s.global_context, visual_style_subcategory_name: sub.name, visual_style_preset: sub.value}}))} className={`p-6 rounded-3xl border text-left transition-all ${state.global_context.visual_style_subcategory_name === sub.name ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white/5 border-white/5 text-zinc-300'}`}><span className="text-[12px] font-bold block mb-1 uppercase">{sub.name}</span><span className="text-[9px] opacity-70 uppercase truncate">{sub.value}</span></button>))}</div></div>
            </div>
          </div>
        )}

        {state.activeView === 'foundry' && (
          <div className="space-y-16 animate-in fade-in duration-1000">
            {state.global_context.environment && (
              <div className="bg-[#050505] p-12 rounded-[5rem] border border-white/10 flex flex-col md:flex-row gap-12 shadow-2xl overflow-hidden">
                 <div className="w-full md:w-2/5 aspect-video rounded-[3rem] overflow-hidden border border-white/10 bg-zinc-950">
                    {state.global_context.environment.preview_url ? <img src={state.global_context.environment.preview_url} className="w-full h-full object-cover" alt="Env" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700 uppercase text-[10px] animate-pulse">待铸造</div>}
                 </div>
                 <div className="flex-grow space-y-8 py-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#D4AF37]">拍摄场景锚点 (Environment DNA)</span>
                    <input value={state.global_context.environment.description} onChange={e => updateEnvironment({ description: e.target.value })} className="w-full bg-transparent border-none outline-none text-4xl font-black italic uppercase serif text-white" />
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">环境视觉代码 (Visual DNA)</span>
                        <textarea value={state.global_context.environment.visual_anchor_prompt} onChange={e => updateEnvironment({ visual_anchor_prompt: e.target.value })} className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-zinc-300 text-[12px] mono leading-relaxed h-24 outline-none focus:border-[#D4AF37]/50" />
                    </div>
                 </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {state.global_context.characters.map((char, idx) => (
                <div key={char.char_id} className="bg-[#050505] p-10 rounded-[4rem] border border-white/10 group relative hover:border-[#D4AF37]/30 transition-all shadow-3xl">
                  <div className="aspect-square bg-zinc-950 rounded-[3rem] mb-8 overflow-hidden border border-white/5 relative">
                    {char.preview_url ? <img src={char.preview_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[4000ms]" alt={char.name} /> : <div className="w-full h-full flex items-center justify-center text-zinc-700 uppercase text-[10px] animate-pulse">待铸造</div>}
                    {char.preview_url && <button onClick={() => reRenderSpecificCharacter(char.char_id)} className="absolute bottom-6 right-6 w-12 h-12 bg-[#D4AF37] hover:bg-white text-black rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>}
                  </div>
                  <input value={char.name} onChange={e => updateCharacter(char.char_id, { name: e.target.value })} className="w-full bg-transparent border-none outline-none text-3xl font-black uppercase mb-4 serif text-white" />
                  <div className="space-y-6">
                      <textarea value={char.description} onChange={e => updateCharacter(char.char_id, { description: e.target.value })} className="w-full bg-transparent border-none outline-none text-zinc-300 text-[12px] italic h-16 resize-none" />
                      <div className="pt-4 border-t border-white/5">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">角色视觉代码 (Visual DNA)</span>
                        <textarea value={char.consistency_seed_prompt} onChange={e => updateCharacter(char.char_id, { consistency_seed_prompt: e.target.value })} className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-zinc-400 text-[10px] mono leading-relaxed h-28 outline-none focus:border-[#D4AF37]/50" />
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.activeView === 'storyboard' && state.project && (
          <div className="space-y-12 animate-in fade-in duration-700">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-10 gap-8">
                <div><h2 className="text-4xl font-black italic serif uppercase mb-2">导演脚本</h2><p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em]">基于资产基因对齐</p></div>
                <div className="bg-[#111] border border-white/10 p-2 rounded-[2.5rem] flex items-center shadow-2xl">
                   <div className="px-6 flex flex-col mr-4"><span className="text-[8px] font-black uppercase text-zinc-500 mb-0.5">渲染引擎</span><span className="text-[9px] font-bold text-[#D4AF37]">当前: {state.global_context.image_engine.toUpperCase()}</span></div>
                   <div className="flex gap-2">{IMAGE_ENGINES.map(engine => (<button key={engine.value} onClick={() => setState(s => ({...s, global_context: {...s.global_context, image_engine: engine.value}}))} className={`px-6 py-2 rounded-2xl transition-all ${state.global_context.image_engine === engine.value ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-zinc-400'}`}><span className="text-[10px] font-black uppercase">{engine.label}</span></button>))}</div>
                </div>
                <div className="flex gap-4"><button onClick={batchRenderAllPhotos} className="px-8 py-3 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest">批量渲染分镜</button><button onClick={batchRenderAllVideos} className="px-8 py-3 bg-[#D4AF37] text-black rounded-xl text-[11px] font-black uppercase tracking-widest">合成片段</button></div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">{state.project.storyboard.map((item, idx) => (<StoryboardCard key={item.id} item={item} context={state.global_context} onUpdate={(u) => updateShot(idx, u)} onRenderPhoto={() => renderSinglePhoto(idx)} onRenderVideo={() => renderSingleVideo(idx)} />))}</div>
          </div>
        )}

        {state.activeView === 'video_master' && state.project && (
          <div className="max-w-[1400px] mx-auto animate-in zoom-in duration-1000">
            <div className="bg-[#050505] p-12 rounded-[5rem] border border-white/10 shadow-2xl">
               <div className={`relative ${state.global_context.aspect_ratio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-zinc-950 rounded-[3.5rem] overflow-hidden mb-16 shadow-inner mx-auto max-h-[75vh] border border-white/5`}>
                  {state.project.storyboard[masterPlayingIdx]?.video_url ? <video ref={videoPlayerRef} src={state.project.storyboard[masterPlayingIdx].video_url} className="w-full h-full object-cover" autoPlay playsInline /> : <div className="w-full h-full flex flex-col items-center justify-center gap-10 text-zinc-500"><div className="w-32 h-32 border-2 border-white/10 border-t-[#D4AF37] rounded-full animate-spin" /><div className="text-center"><span className="text-[12px] font-black uppercase block mb-4 text-[#D4AF37] animate-pulse">渲染合成中...</span><span className="text-[24px] font-black italic serif text-white">镜头 {masterPlayingIdx + 1}</span></div></div>}
                  <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between pointer-events-none"><div className="bg-black/80 backdrop-blur-3xl px-12 py-8 rounded-[3rem] border border-white/10 max-w-[70%] shadow-3xl"><p className="text-lg font-bold italic serif text-white">"{state.project.storyboard[masterPlayingIdx]?.lyric_line || '（无对白）'}"</p></div><div className="bg-white text-black px-10 py-6 rounded-[2.5rem] text-[14px] font-black italic">{masterPlayingIdx + 1} / {state.project.storyboard.length}</div></div>
               </div>
               <div className="flex gap-8 overflow-x-auto pb-12 snap-x px-6">{state.project.storyboard.map((item, idx) => (<button key={item.id} onClick={() => setMasterPlayingIdx(idx)} className={`relative min-w-[280px] aspect-video rounded-[3rem] overflow-hidden border transition-all flex-shrink-0 snap-center ${masterPlayingIdx === idx ? 'border-[#D4AF37] scale-110 z-10 shadow-2xl ring-4 ring-[#D4AF37]/10' : 'border-white/5 opacity-30 grayscale hover:grayscale-0'}`}>{item.preview_url && <img src={item.preview_url} className="w-full h-full object-cover" alt="" /><div className="absolute top-6 left-6 w-8 h-8 bg-black/80 rounded-2xl flex items-center justify-center text-[11px] font-black">{idx + 1}</div>}</button>))}</div>
            </div>
          </div>
        )}
      </main>

      {state.isAnalyzing && (<div className="fixed inset-0 bg-black/98 backdrop-blur-[100px] z-[100] flex flex-col items-center justify-center animate-in fade-in"><div className="w-32 h-32 bg-[#D4AF37] rounded-[2.5rem] flex items-center justify-center font-black italic text-5xl animate-pulse text-black mb-24">F</div><div className="w-full max-w-lg px-16 space-y-12"><div className="flex justify-between items-end px-4"><span className="text-[14px] font-black uppercase tracking-[0.8em] text-[#D4AF37] serif">{state.statusMessage}</span><span className="text-xl font-black mono text-zinc-300">{state.progress}%</span></div><div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden relative"><div className="h-full bg-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,1)] transition-all duration-1000" style={{width: `${state.progress}%`}} /></div></div></div>)}
    </div>
  );
};

export default App;
