import React, { useEffect, useState } from 'react';
import { BatchProgress } from '../types';

interface BatchProgressModalProps {
  progress: BatchProgress;
  onCancel: () => void;
  onPause?: () => void;
  isPaused?: boolean;
}

const BatchProgressModal: React.FC<BatchProgressModalProps> = ({
  progress,
  onCancel,
  onPause,
  isPaused = false
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - progress.startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [progress.startTime, isPaused]);

  const percentage = Math.floor((progress.current / progress.total) * 100);
  const avgTimePerShot = progress.current > 0 ? elapsedTime / progress.current : 0;
  const remainingShots = progress.total - progress.current;
  const estimatedTimeRemaining = avgTimePerShot * remainingShots;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  const operationName = progress.operation === 'photo' ? '图片渲染' : '视频合成';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-3xl mx-4 bg-[#0a0a0a] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-12 py-8 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black mb-2">批量{operationName}</h2>
            <p className="text-zinc-500 text-sm">
              {isPaused ? '已暂停' : '处理中...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onPause && (
              <button
                onClick={onPause}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
              >
                {isPaused ? '继续' : '暂停'}
              </button>
            )}
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white rounded-xl text-sm font-bold transition-all"
            >
              取消
            </button>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="px-12 py-8 grid grid-cols-4 gap-6">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
            <p className="text-zinc-500 text-xs font-bold uppercase mb-2">总计</p>
            <p className="text-3xl font-black">{progress.total}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
            <p className="text-emerald-400 text-xs font-bold uppercase mb-2">成功</p>
            <p className="text-3xl font-black text-emerald-400">{progress.succeeded}</p>
          </div>
          <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/20">
            <p className="text-red-400 text-xs font-bold uppercase mb-2">失败</p>
            <p className="text-3xl font-black text-red-400">{progress.failed}</p>
          </div>
          <div className="bg-[#D4AF37]/10 rounded-2xl p-6 border border-[#D4AF37]/20">
            <p className="text-[#D4AF37] text-xs font-bold uppercase mb-2">进度</p>
            <p className="text-3xl font-black text-[#D4AF37]">{percentage}%</p>
          </div>
        </div>

        {/* Current Shot Preview */}
        {progress.currentShotNumber && (
          <div className="px-12 pb-8">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-6">
                {progress.currentShotPreview && (
                  <div className="w-32 h-20 rounded-xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0">
                    <img
                      src={progress.currentShotPreview}
                      alt={`镜头 ${progress.currentShotNumber}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-grow">
                  <p className="text-zinc-500 text-xs font-bold uppercase mb-1">当前处理</p>
                  <p className="text-xl font-black">镜头 #{progress.currentShotNumber}</p>
                </div>
                <div className="w-12 h-12 border-2 border-white/10 border-t-[#D4AF37] rounded-full animate-spin" />
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="px-12 pb-8">
          <div className="flex justify-between items-end mb-3">
            <span className="text-sm font-bold text-zinc-400">
              {progress.current} / {progress.total} 已完成
            </span>
            {estimatedTimeRemaining > 0 && !isPaused && (
              <span className="text-sm font-bold text-zinc-400">
                预计剩余: {formatTime(estimatedTimeRemaining)}
              </span>
            )}
          </div>
          <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Time Info */}
        <div className="px-12 pb-10 flex justify-between text-sm">
          <span className="text-zinc-500">
            已用时间: <span className="font-bold text-white">{formatTime(elapsedTime)}</span>
          </span>
          {avgTimePerShot > 0 && (
            <span className="text-zinc-500">
              平均速度: <span className="font-bold text-white">{formatTime(avgTimePerShot)}/镜头</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchProgressModal;
