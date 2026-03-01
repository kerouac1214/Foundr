import React, { useRef } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { useUIStore } from './store/useUIStore';
import { useAppWorkflow } from './hooks/useAppWorkflow';
import { humanizeError } from './utils';
import { ASPECT_RATIOS, IMAGE_ENGINES, VIDEO_ENGINES } from './constants';
import { updateProviderConfigs } from './services/providers';

// Components
import ScriptEditor from './components/ScriptEditor';
import ContextSettings from './components/ContextSettings';
import AssetManager from './components/AssetManager';
import StoryboardBoard from './components/StoryboardBoard';
import Timeline from './components/Timeline';
import Toast from './components/Toast';
import Onboarding, { useOnboarding } from './components/Onboarding';
import ProjectList from './components/ProjectList';
import BatchProgressModal from './components/BatchProgressModal';
import ErrorBoundary from './components/ErrorBoundary';
import EpisodeDashboard from './components/EpisodeDashboard';
import ChapterSidebar from './components/ChapterSidebar';

const App: React.FC = () => {
  // Store State (Reactive with Selectors)
  const script = useProjectStore(s => s.script);
  const setScript = useProjectStore(s => s.setScript);
  const projectMetadata = useProjectStore(s => s.projectMetadata);
  const storyboard = useProjectStore(s => s.storyboard);
  const resetProject = useProjectStore(s => s.resetProject);
  const globalContext = useProjectStore(s => s.globalContext);
  const updateGlobalContext = useProjectStore(s => s.updateGlobalContext);
  const selectedChapterId = useProjectStore(s => s.selectedChapterId);
  const setSelectedChapterId = useProjectStore(s => s.setSelectedChapterId);
  const updateChapterContent = useProjectStore(s => s.updateChapterContent);

  // UI Store State (Individual Selectors for Stability)
  const activeView = useUIStore(s => s.activeView);
  const setActiveView = useUIStore(s => s.setActiveView);
  const isAnalyzing = useUIStore(s => s.isAnalyzing);
  const progress = useUIStore(s => s.progress);
  const statusMessage = useUIStore(s => s.statusMessage);
  const error = useUIStore(s => s.error);
  const setError = useUIStore(s => s.setError);
  const toast = useUIStore(s => s.toast);
  const hideToast = useUIStore(s => s.hideToast);
  const batchProgress = useUIStore(s => s.batchProgress);
  const setBatchProgress = useUIStore(s => s.setBatchProgress);

  console.log('App Rendering:', { activeView, hasScript: !!script, selectedChapterId, isAnalyzing });

  // Workflow Actions
  const {
    handleGenerateStoryboard,
    handleExtractAssets,
    handleRenderAssets,
    reRenderSpecificCharacter,
    reRenderSpecificScene,
    generateAllAssets,
    renderSinglePhoto,
    renderCandidates,
    renderSingleVideo,
    batchRenderAllPhotos,
    batchRenderAllVideos,
    handleMasterSynthesis,
    repairProjectAssets,
    cancelBatch,
    handleFullScriptAnalysis,
    handleInsertShot,
    handleDeriveShots,
    handleDeriveThreeShots,
    handleGenerateNarrativeGrid,
    handleRefineShot,
    handleRefineDNA
  } = useAppWorkflow();

  // Local UI State
  const [showProjectList, setShowProjectList] = React.useState(false);
  const [imageLayout, setImageLayout] = React.useState<'list' | 'grid'>('grid');
  const [showTimeline, setShowTimeline] = React.useState(true);
  const [masterPlayingIdx, setMasterPlayingIdx] = React.useState(0);
  const [previzActiveIdx, setPrevizActiveIdx] = React.useState(0);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const scrollBoardRef = useRef<HTMLDivElement>(null);

  // Onboarding
  const { showOnboarding, setShowOnboarding, resetOnboarding } = useOnboarding();

  // Video Autoplay Logic
  React.useEffect(() => {
    if (activeView === 'video_master' && videoPlayerRef.current) {
      const handleEnded = () => {
        if (storyboard && masterPlayingIdx < storyboard.length - 1) {
          const nextIdx = masterPlayingIdx + 1;
          if (storyboard[nextIdx].video_url) setMasterPlayingIdx(nextIdx);
        }
      };
      videoPlayerRef.current.addEventListener('ended', handleEnded);
      return () => videoPlayerRef.current?.removeEventListener('ended', handleEnded);
    }
  }, [activeView, masterPlayingIdx, storyboard]);

  // Sync Engine Configs
  React.useEffect(() => {
    if (globalContext.engine_configs) {
      updateProviderConfigs(globalContext.engine_configs);
    }
  }, [globalContext.engine_configs]);

  // Defensive: Clear selectedChapterId if it's invalid
  React.useEffect(() => {
    if (selectedChapterId) {
      const chapterExists = projectMetadata?.chapters?.some(c => c.id === selectedChapterId);
      if (!chapterExists) {
        console.warn('App: selectedChapterId is invalid, clearing it.');
        setSelectedChapterId(null);
      }
    }
  }, [selectedChapterId, projectMetadata]);

  // Repair Assets on Load
  React.useEffect(() => {
    if (projectMetadata?.id) {
      repairProjectAssets();
    }
  }, [projectMetadata?.id]);

  // Rate Limit / Retry logic (Simplified for now, moving elaborate logic to store/hook later if needed)
  const rateLimitCountdown = 0; // Placeholder until fully migrated
  const lastFailedOperation = null; // Placeholder

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-director-dark text-director-text font-sans overflow-hidden">
        {/* Modern Header */}
        <header className="h-16 border-b border-gray-800 bg-director-dark/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-director-accent rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">F</div>
            <div className="hidden sm:block">
              <h1 className="text-xs font-black tracking-widest uppercase text-white">Foundry</h1>
              <span className="text-[10px] text-gray-500 font-medium">Director Pro</span>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-gray-800">
            <button onClick={() => setActiveView('context')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'context' ? 'bg-director-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>剧本</button>
            <button onClick={() => setActiveView('episodes')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'episodes' ? 'bg-director-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>分集</button>
            <button onClick={() => setActiveView('storyboard')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'storyboard' ? 'bg-director-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>看板</button>
            <button onClick={() => setActiveView('foundry')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'foundry' ? 'bg-director-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>资产</button>
            <div className="w-[1px] h-4 bg-gray-700 mx-1"></div>
            <button onClick={() => setActiveView('images')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'images' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-gray-400 hover:text-[#D4AF37]'}`}>画面预演</button>
            <button onClick={() => setActiveView('video_fragments')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'video_fragments' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-gray-400 hover:text-[#D4AF37]'}`}>分镜视频</button>
            <button onClick={() => setActiveView('video_master')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${activeView === 'video_master' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-emerald-500'}`}>最终母带</button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowProjectList(true)} className="p-2 text-gray-400 hover:text-white transition-colors" title="项目列表">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </button>
            <button onClick={resetProject} className="text-[10px] font-bold text-gray-500 hover:text-red-400 px-3 py-1.5 transition-colors">重置</button>
            {(activeView === 'context' || activeView === 'episodes') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const state = useProjectStore.getState();
                    if (!state.script) {
                      useUIStore.getState().showToast('请输入全剧本后再进行架构分析', 'error');
                      return;
                    }
                    handleFullScriptAnalysis();
                  }}
                  disabled={isAnalyzing}
                  className="px-4 py-1.5 bg-[#4F46E5] hover:bg-[#6366F1] text-white rounded-md text-[10px] font-bold tracking-widest transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  title="Step 1：将长剧本切分为章节"
                >
                  {isAnalyzing ? '架构分析中...' : '全剧架构分析'}
                </button>
              </div>
            )}
            {(activeView === 'foundry' || activeView === 'episodes') && (
              <button
                onClick={handleExtractAssets}
                disabled={isAnalyzing}
                className="director-button text-[10px] tracking-widest"
                title="Step 2：从全剧本中提取角色与场景资产"
              >
                {isAnalyzing ? '提取中...' : '提取资产 (Step 2)'}
              </button>
            )}
            {activeView === 'video_fragments' && (
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 mx-2">
                {VIDEO_ENGINES.map(engine => (
                  <button
                    key={engine.value}
                    onClick={() => updateGlobalContext({ video_engine: engine.value as any })}
                    className={`px-3 py-1 rounded-md transition-all text-[9px] font-bold uppercase ${globalContext.video_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-500 hover:text-white'}`}
                    title={engine.desc}
                  >
                    {engine.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {error && (
            <div className="m-6 bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <span className="text-xs text-red-400">{humanizeError(error).message}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {/* Chapter Sidebar (If in Full Script mode) */}
            {projectMetadata?.chapters && projectMetadata.chapters.length > 0 && (activeView === 'context' || activeView === 'storyboard') && (
              <ChapterSidebar
                chapters={projectMetadata.chapters}
                onSelectChapter={setSelectedChapterId}
                onGenerateChapter={handleGenerateStoryboard}
                isAnalyzing={isAnalyzing}
              />
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              {/* Views */}
              <div className="max-w-7xl mx-auto space-y-12 pb-32">
                {activeView === 'context' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[70vh]">
                    <div className="director-panel p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-director-accent animate-pulse" />
                          <h4 className="text-xs font-black tracking-widest text-white uppercase">剧本文学 (Literary Script)</h4>
                        </div>
                        {selectedChapterId && (
                          <span className="text-[10px] text-director-accent font-bold uppercase tracking-widest">编辑章节模式</span>
                        )}
                      </div>
                      <ScriptEditor
                        script={(selectedChapterId && projectMetadata?.chapters?.some(c => c.id === selectedChapterId)) ? (projectMetadata?.chapters?.find(c => c.id === selectedChapterId)?.content || '') : script}
                        onChange={(val) => {
                          const chapterExists = selectedChapterId && projectMetadata?.chapters?.some(c => c.id === selectedChapterId);
                          console.log('App: ScriptEditor onChange. Length:', val.length, 'ChapterMode:', !!chapterExists, 'ID:', selectedChapterId);
                          if (!selectedChapterId || !chapterExists) {
                            setScript(val);
                          } else {
                            updateChapterContent(selectedChapterId, val);
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-6">
                      <div className="director-panel p-6 shrink-0 border border-gray-800 rounded-3xl bg-[#050505]">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-4">
                          <h3 className="text-[10px] font-black tracking-widest text-gray-500 uppercase">制片风格</h3>
                        </div>
                        <ContextSettings />
                      </div>
                      <div className="flex-grow director-panel p-6 border border-gray-800 rounded-3xl bg-[#050505] flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-2 border-dashed border-gray-800 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <p className="text-xs text-gray-500 text-center leading-relaxed max-w-[180px]">
                          输入剧本后点击<span className="text-director-accent font-bold">"全剧架构分析"</span>，系统将自动分集并在"分集"页中展示结果。
                        </p>
                        {projectMetadata?.chapters && projectMetadata.chapters.length > 0 && (
                          <button
                            onClick={() => setActiveView('episodes')}
                            className="px-4 py-2 bg-director-accent/10 hover:bg-director-accent/20 border border-director-accent/30 text-director-accent rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                          >
                            查看分集 ({projectMetadata.chapters.length} 集) →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeView === 'episodes' && (
                  <EpisodeDashboard
                    metadata={projectMetadata}
                    context={globalContext}
                    isAnalyzing={isAnalyzing}
                    onBackToScript={() => setActiveView('context')}
                    onGenerateChapter={(chapterId) => {
                      setSelectedChapterId(chapterId);
                      handleGenerateStoryboard(chapterId);
                    }}
                  />
                )}

                {activeView === 'storyboard' && (
                  <StoryboardBoard
                    onRenderPhoto={renderSinglePhoto}
                    onRenderCandidates={renderCandidates}
                    onRenderVideo={renderSingleVideo}
                    mode="text-only"
                    onInsertShot={handleInsertShot}
                    onDeriveShot={handleDeriveShots}
                    onDeriveThreeShots={handleDeriveThreeShots}
                    onGenerateNarrativeGrid={handleGenerateNarrativeGrid}
                    onRefineShot={handleRefineShot}
                  />
                )}

                {activeView === 'foundry' && (
                  <AssetManager
                    onReRenderCharacter={reRenderSpecificCharacter}
                    onReRenderScene={reRenderSpecificScene}
                    onGenerateAll={generateAllAssets}
                    onRefineDNA={handleRefineDNA}
                    isGenerating={isAnalyzing}
                  />
                )}

                {(activeView === 'images' || activeView === 'video_fragments') && (
                  <div className="flex flex-col h-full gap-8">
                    <div ref={scrollBoardRef} className="flex-grow overflow-y-auto pr-2 scroll-smooth">
                      <StoryboardBoard
                        onRenderPhoto={renderSinglePhoto}
                        onRenderCandidates={renderCandidates}
                        onRenderVideo={renderSingleVideo}
                        layout={imageLayout}
                        viewMode={activeView === 'images' ? 'images_only' : 'videos_only'}
                        onInsertShot={handleInsertShot}
                        onDeriveShot={handleDeriveShots}
                        onDeriveThreeShots={handleDeriveThreeShots}
                        onGenerateNarrativeGrid={handleGenerateNarrativeGrid}
                        onRefineShot={handleRefineShot}
                      />
                    </div>

                    {/* Timeline Toggle & Component */}
                    {activeView === 'video_fragments' && (
                      <div className="mt-auto pt-4 border-t border-white/5 relative">
                        <div className="flex justify-between items-center mb-2 px-2">
                          <span className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">镜头序列</span>
                          <button
                            onClick={() => setShowTimeline(!showTimeline)}
                            className="text-[10px] font-bold text-[#D4AF37] hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full border border-white/5"
                          >
                            {showTimeline ? '隐藏序列' : '展开序列'}
                            <svg className={`w-3 h-3 transition-transform ${showTimeline ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                        </div>

                        {showTimeline && (
                          <div className="pb-2 animate-in slide-in-from-bottom-4 duration-300">
                            <Timeline
                              storyboard={storyboard}
                              currentIndex={previzActiveIdx}
                              onSeek={(idx) => {
                                setPrevizActiveIdx(idx);
                                const boardEl = scrollBoardRef.current;
                                if (boardEl) {
                                  const cards = boardEl.querySelectorAll('[data-shot-number]');
                                  if (cards[idx]) {
                                    cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeView === 'video_master' && (
                  <div className="max-w-[1200px] mx-auto">
                    <div className="bg-black rounded-3xl overflow-hidden border border-gray-800 shadow-2xl relative">
                      <div className={`${globalContext.aspect_ratio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-zinc-900`}>
                        {storyboard[masterPlayingIdx]?.video_url ? (
                          <video ref={videoPlayerRef} src={storyboard[masterPlayingIdx].video_url} className="w-full h-full object-cover" autoPlay playsInline />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">等待渲染...</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-8">
                      <Timeline storyboard={storyboard} currentIndex={masterPlayingIdx} onSeek={setMasterPlayingIdx} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Loading Overlay */}
        {isAnalyzing && (
          <div className="fixed inset-0 bg-black/98 backdrop-blur-[100px] z-[100] flex flex-col items-center justify-center animate-in fade-in">
            <div className="w-32 h-32 bg-[#D4AF37] rounded-[2.5rem] flex items-center justify-center font-black italic text-5xl animate-pulse text-black mb-24">F</div>
            <div className="w-full max-w-lg px-16 space-y-12">
              <div className="flex justify-between items-end px-4">
                <span className="text-[14px] font-black uppercase tracking-[0.8em] text-[#D4AF37] serif">{statusMessage}</span>
                <span className="text-xl font-black mono text-zinc-300">{progress}%</span>
              </div>
              <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden relative">
                <div className="h-full bg-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,1)] transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

        {/* Onboarding */}
        {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}

        {/* Project List */}
        {showProjectList && (
          <ProjectList
            currentState={{
              project: { metadata: projectMetadata!, storyboard },
              global_context: globalContext,
            } as any}
            onLoadProject={(loadedState) => {
              if (loadedState.project) {
                useProjectStore.getState().setProjectMetadata(loadedState.project.metadata);
                useProjectStore.getState().setStoryboard(loadedState.project.storyboard);
              }
              if (loadedState.global_context) {
                useProjectStore.getState().updateGlobalContext(loadedState.global_context);
              }
              setShowProjectList(false);
              useUIStore.getState().showToast('项目已加载', 'success');
            }}
            onClose={() => setShowProjectList(false)}
          />
        )}

        {/* Batch Progress Modal */}
        {batchProgress && (
          <BatchProgressModal
            progress={batchProgress}
            onCancel={() => {
              cancelBatch();
              setBatchProgress(null);
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
