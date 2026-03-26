import React, { useState, useEffect } from 'react';
import { AnalysisResult, HistorySession } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Sparkles, Zap, Music, Music4, ShieldAlert, Heart, Clock, Anchor, X, CheckCircle2, Compass, Waves } from 'lucide-react';
import { clsx } from 'clsx';

interface EditorProps {
  text: string;
  setText: (text: string) => void;
  analysis: AnalysisResult | null;
  onAutoAnalyze?: (text: string) => void;
  onGenerateGhostText?: (text: string) => Promise<string | null>;
  onGhostAdopted?: (text: string) => void;
  history?: HistorySession[];
  onLoadSession?: (session: HistorySession) => void;
  isWorkspaceMode?: boolean;
  isSoulAnchorEnabled?: boolean;
  setIsSoulAnchorEnabled?: (enabled: boolean) => void;
  protectedFlaw?: string | null;
}

function InspirationCard({ icon, title, content, onClick }: { icon: React.ReactNode, title: string, content: string, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="group p-3.5 rounded-xl border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/60 hover:border-indigo-500/30 transition-all cursor-pointer backdrop-blur-md flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-zinc-800/50 rounded-md group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h3 className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{title}</h3>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors line-clamp-2">
        "{content}"
      </p>
    </div>
  );
}

export function Editor({ 
  text, 
  setText, 
  analysis, 
  onAutoAnalyze, 
  onGenerateGhostText,
  onGhostAdopted,
  history = [], 
  onLoadSession, 
  isWorkspaceMode = false,
  isSoulAnchorEnabled = false,
  setIsSoulAnchorEnabled,
  protectedFlaw
}: EditorProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(text.length);
  const mirrorRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const idleTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const resetInquiryState = () => {
    setGhostText(null);
    setIsGenerating(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  useEffect(() => {
    resetInquiryState();
  }, [text]);

  useEffect(() => {
    if (!isWorkspaceMode || !text.trim() || isGenerating || ghostText) {
      setIsIdle(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 5000);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [text, isWorkspaceMode, isGenerating, ghostText]);

  const handleSparkleClick = async () => {
    if (!onGenerateGhostText) return;
    
    // 1. Clear First
    resetInquiryState();
    
    setIsGenerating(true);
    setIsIdle(false);
    
    try {
      // 2. Fixed Insertion Point
      const newGhost = await onGenerateGhostText(text);
      if (newGhost) {
        setGhostText(newGhost);
        setIsGenerating(false);
      } else {
        setIsGenerating(false);
      }
    } catch (e) {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart);
    }
  }, [text]);

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPos(e.currentTarget.selectionStart);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const acceptGhost = () => {
    if (!ghostText) return;
    const suggestion = ghostText;
    const space = (text.endsWith(' ') || text.endsWith('\n') || text === '') ? '' : ' ';
    const newText = text + space + suggestion;
    setText(newText);
    resetInquiryState();
    if (onGhostAdopted) {
      onGhostAdopted(suggestion);
    }
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = newText.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        setCursorPos(newPos);
      }
    }, 0);
  };

  const cancelGhost = () => {
    resetInquiryState();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && isWorkspaceMode && ghostText) {
      e.preventDefault();
      acceptGhost();
    }
    if (e.key === 'Escape' && ghostText) {
      e.preventDefault();
      cancelGhost();
    }
  };
  const ghostType = analysis?.analysis?.ghostSuggestionType || 'general';
  let ghostColorClass = 'text-blue-300/70';
  let ghostBorderClass = 'border-blue-400/30';
  let ghostBgClass = 'bg-blue-500/10';
  let ghostIconColor = 'text-blue-400';
  
  if (ghostType === 'depth') {
    ghostColorClass = 'text-blue-300/70';
    ghostBorderClass = 'border-blue-400/30';
    ghostBgClass = 'bg-blue-500/10';
    ghostIconColor = 'text-blue-400';
  } else if (ghostType === 'breadth') {
    ghostColorClass = 'text-purple-300/70';
    ghostBorderClass = 'border-purple-400/30';
    ghostBgClass = 'bg-purple-500/10';
    ghostIconColor = 'text-purple-400';
  } else if (ghostType === 'challenge') {
    ghostColorClass = 'text-red-300/70';
    ghostBorderClass = 'border-red-400/30';
    ghostBgClass = 'bg-red-500/10';
    ghostIconColor = 'text-red-400';
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-y-auto">
      {isWorkspaceMode && text.trim() && (
        <div className="sticky top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-zinc-800/50">
          <button
            onClick={() => setIsSoulAnchorEnabled?.(!isSoulAnchorEnabled)}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300",
              isSoulAnchorEnabled 
                ? "bg-[#E2E8F0] text-zinc-900 shadow-[0_0_15px_rgba(226,232,240,0.4)]" 
                : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700/50"
            )}
            title={isSoulAnchorEnabled ? "Soul Anchor Enabled: Your text is protected from AI alteration" : "Enable Soul Anchor to protect your text"}
          >
            <Anchor className={clsx("w-4 h-4", isSoulAnchorEnabled ? "text-zinc-900" : "text-zinc-400")} />
            {isSoulAnchorEnabled ? "Soul Anchor ON" : "Soul Anchor OFF"}
          </button>
          
          {protectedFlaw && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-medium text-red-400">
              <ShieldAlert className="w-3 h-3" />
              <span>Logic Flaw Protected</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 flex flex-col relative p-6">
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 flex flex-col relative">
            {(!isWorkspaceMode || !text.trim()) && (
              <>
                <div className="absolute top-0 right-0 group z-50">
                  <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors">
                    <Clock className="w-5 h-5" />
                  </button>
                  <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-3 border-b border-zinc-800">
                      <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">历史灵感记录</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {history.length === 0 ? (
                        <div className="p-4 text-center text-sm text-zinc-600">暂无记录</div>
                      ) : (
                        history.map(h => (
                          <div 
                            key={h.id} 
                            onClick={() => onLoadSession?.(h)}
                            className="p-3 hover:bg-zinc-800/50 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="text-sm text-zinc-300 truncate">{h.title}</div>
                            <div className="text-xs text-zinc-600 mt-1">{new Date(h.date).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col pt-4 pb-6"
                >
                  <h2 className="text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500 mb-6 tracking-tight">
                    我们要从哪块灵感碎片开始？
                  </h2>
                </motion.div>
              </>
            )}

            <div className={clsx("relative flex-1 flex flex-col", (!isWorkspaceMode || !text.trim()) ? "min-h-[200px] mb-6" : "")}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onSelect={handleSelect}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                placeholder={(!isWorkspaceMode || !text.trim()) ? "试着补全：I want to [Action] for [Audience] using [Method]." : "Start typing your thoughts..."}
                className={clsx(
                  "w-full h-full flex-1 bg-transparent text-zinc-100 font-sans text-lg leading-relaxed resize-none outline-none transition-all z-10",
                  (!isWorkspaceMode || !text.trim()) ? "absolute inset-0 bg-zinc-900/20 border border-zinc-800/50 rounded-2xl p-6 focus:border-indigo-500/50 focus:bg-zinc-900/40 placeholder:text-zinc-600" : "placeholder:text-zinc-700"
                )}
                spellCheck={false}
                autoFocus
              />
            
              {/* Ghost Overlay */}
              <div 
                ref={mirrorRef}
                className={clsx(
                  "absolute inset-0 pointer-events-none overflow-hidden font-sans text-lg leading-relaxed whitespace-pre-wrap break-words z-20",
                  (!isWorkspaceMode || !text.trim()) ? "p-6 border border-transparent" : ""
                )}
                aria-hidden="true"
              >
                <span className="text-transparent">{text}</span>
                {isWorkspaceMode && text.trim() && (
                  <span className="pointer-events-auto relative inline-flex items-center z-10">
                    {isIdle && !isGenerating && !ghostText && (
                      <button 
                        onClick={handleSparkleClick}
                        className={`absolute left-1 top-1/2 -translate-y-1/2 ${ghostIconColor} hover:opacity-80 transition-colors z-10 animate-pulse`}
                        title="Click to generate suggestion"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                    {isGenerating && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin">
                        <Zap className="w-4 h-4" />
                      </span>
                    )}
                    {ghostText && (
                      <span className={`${ghostColorClass} ml-1 pl-2 border-l-2 ${ghostBorderClass} cursor-pointer`} onClick={acceptGhost}>
                        {ghostText}
                        <span className={`text-[10px] ml-2 ${ghostColorClass} border ${ghostBorderClass} px-1 rounded ${ghostBgClass}`}>Tab to accept</span>
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

          {isWorkspaceMode && text.trim() && analysis?.analysis?.socraticPillars && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 pt-6 border-t border-zinc-800/50"
            >
              <div className="flex items-center gap-2 mb-4 text-[#E2E8F0]">
                <Compass className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-xs font-medium uppercase tracking-wider">Socratic Guidance</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: '深度深挖', text: analysis.analysis.socraticPillars.depth, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/20' },
                  { label: '水平碰撞', text: analysis.analysis.socraticPillars.breadth, color: 'text-[#A855F7]', bg: 'bg-[#A855F7]/10', border: 'border-[#A855F7]/20' },
                  { label: '逆向挑战', text: analysis.analysis.socraticPillars.challenge, color: 'text-[#DC2626]', bg: 'bg-[#DC2626]/10', border: 'border-[#DC2626]/20' }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-start gap-3 p-3 rounded-lg ${item.bg} border ${item.border} hover:bg-zinc-800/50 transition-all cursor-pointer group`}
                  >
                    <div className={`text-xs font-bold ${item.color} mt-0.5 shrink-0 w-16`}>[{item.label}]</div>
                    <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors leading-relaxed">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {(!isWorkspaceMode || !text.trim()) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                缺乏灵感？试试这些：
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InspirationCard 
                  icon={<Music className="w-4 h-4 text-[#E2E8F0]" />}
                  title="字节生态专区"
                  content="为视障人士‘翻译’抖音变装梗的视觉潜台词。"
                  onClick={() => onAutoAnalyze?.("为视障人士‘翻译’抖音变装梗的视觉潜台词。")}
                />
                <InspirationCard 
                  icon={<Waves className="w-4 h-4 text-[#E2E8F0]" strokeWidth={1.5} />}
                  title="感官跨界"
                  content="让红绿色盲通过音频频率的震动‘感知’标准色彩。"
                  onClick={() => onAutoAnalyze?.("让红绿色盲通过音频频率的震动‘感知’标准色彩。")}
                />
                <InspirationCard 
                  icon={<Music4 className="w-4 h-4 text-[#E2E8F0]" />}
                  title="艺术创作"
                  content="用摇滚乐的节奏重塑莫扎特的古典乐，创造一种‘冲突的美学’。"
                  onClick={() => onAutoAnalyze?.("用摇滚乐的节奏重塑莫扎特的古典乐，创造一种‘冲突的美学’。")}
                />
                <InspirationCard 
                  icon={<Heart className="w-4 h-4 text-[#E2E8F0]" />}
                  title="社会价值"
                  content="设计一个能检测算法偏见并自动‘提醒’用户的飞书助手。"
                  onClick={() => onAutoAnalyze?.("设计一个能检测算法偏见并自动‘提醒’用户的飞书助手。")}
                />
              </div>
            </motion.div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
