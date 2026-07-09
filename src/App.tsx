/// <reference types="vite/client" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from './components/Editor';
import { LogicMap } from './components/LogicMap';
import { ImageUploader } from './components/ImageUploader';
import { BrainCircuit, Upload, Loader2, Sparkles, X, Clock, ArrowLeft, ShieldAlert, Download, Anchor, GitMerge, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from '@google/genai';
import { clsx } from 'clsx';
import { toPng, toJpeg } from 'html-to-image';

export type HistorySession = {
  id: string;
  title: string;
  date: string;
  text: string;
  analysis: AnalysisResult | null;
};

export type NodeData = {
  id: string;
  label: string;
  type: string;
  isGap: boolean;
  source?: 'Text' | 'Sketch' | 'AI' | 'Merged' | 'Manual';
  isConflict?: boolean;
  compromiseProposal?: string;
  position?: { x: number; y: number };
  ghostHint?: string;
  hint?: string;
  isHintConsumed?: boolean;
  isNewRound?: boolean;
  isOrphan?: boolean;
};

export type EdgeData = {
  source: string;
  target: string;
  label?: string;
};

export const DEFAULT_NODES: NodeData[] = [
  { id: 'bg1', label: '...', type: 'core', isGap: false, source: 'AI', position: { x: 150, y: 150 } },
  { id: 'bg2', label: '...', type: 'intent', isGap: true, source: 'AI', position: { x: 450, y: 250 } },
  { id: 'bg3', label: '...', type: 'fact', isGap: false, source: 'AI', position: { x: 250, y: 450 } },
];

export const DEFAULT_EDGES: EdgeData[] = [
  { source: 'bg1', target: 'bg2' },
  { source: 'bg2', target: 'bg3' },
];

export type AnalysisResult = {
  logs?: string[];
  entropy: 'low' | 'high';
  socraticQuestions?: string[];
  analysis?: {
    anchoredSoul?: string;
    socraticPillars?: {
      depth: string;
      breadth: string;
      challenge: string;
    };
    ghostSuggestion?: string;
    ghostSuggestionType?: 'depth' | 'breadth' | 'challenge' | 'general';
    criticalError?: { error: string; fix: string };
    logicGaps?: string[];
    branches?: string[];
    nodes?: NodeData[];
    edges?: EdgeData[];
  };
};

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    // key 不再放前端;所有请求转发到 /api/gemini,由后端补上真实 key
    aiClient = new GoogleGenAI({
      apiKey: 'proxy-placeholder',
      httpOptions: { baseUrl: window.location.origin + '/api/gemini' },
    });
  }
  return aiClient;
}

function calculateSimilarity(str1: string, str2: string) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1;
  
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };
  
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  
  let intersection = 0;
  b1.forEach(b => { if (b2.has(b)) intersection++; });
  const union = b1.size + b2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function mergeGraphs(oldNodes: NodeData[], oldEdges: EdgeData[], newNodes: NodeData[], newEdges: EdgeData[]) {
  const mergedNodes: NodeData[] = [];
  const mergedEdges: EdgeData[] = [];
  
  const oldNodesMap = new Map(oldNodes.map(n => [n.id, n]));
  
  // 1. Match new nodes to old nodes
  newNodes.forEach(newNode => {
    let matchedOldNode = oldNodesMap.get(newNode.id);
    
    // If ID doesn't match, try similarity
    if (!matchedOldNode) {
      let bestMatch: NodeData | null = null;
      let bestScore = 0;
      oldNodesMap.forEach(oldNode => {
        const score = calculateSimilarity(oldNode.label, newNode.label);
        if (score > 0.6 && score > bestScore) {
          bestScore = score;
          bestMatch = oldNode;
        }
      });
      if (bestMatch) {
        matchedOldNode = bestMatch;
        newNode.id = matchedOldNode.id; // Align ID
      }
    }
    
    if (matchedOldNode) {
      mergedNodes.push({
        ...newNode,
        id: matchedOldNode.id,
        position: matchedOldNode.position,
        isOrphan: false,
        source: matchedOldNode.source === 'Manual' || matchedOldNode.source === 'Merged' ? matchedOldNode.source : newNode.source,
        label: matchedOldNode.source === 'Manual' || matchedOldNode.source === 'Merged' ? matchedOldNode.label : newNode.label,
        isHintConsumed: matchedOldNode.hint === newNode.hint ? matchedOldNode.isHintConsumed : false
      });
      oldNodesMap.delete(matchedOldNode.id);
    } else {
      mergedNodes.push({ ...newNode, isOrphan: false });
    }
  });
  
  // 2. Handle Orphan Nodes
  oldNodesMap.forEach(oldNode => {
    mergedNodes.push({
      ...oldNode,
      isOrphan: true
    });
  });
  
  // 3. Merge Edges
  const edgeSet = new Set<string>();
  const addEdge = (e: EdgeData) => {
    const key = `${e.source}->${e.target}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      mergedEdges.push(e);
    }
  };
  
  const mergedNodeIds = new Set(mergedNodes.map(n => n.id));
  
  // Keep old edges if both nodes still exist
  oldEdges.forEach(e => {
    if (mergedNodeIds.has(e.source) && mergedNodeIds.has(e.target)) {
      addEdge(e);
    }
  });
  
  // Add new edges
  newEdges.forEach(e => {
    if (mergedNodeIds.has(e.source) && mergedNodeIds.has(e.target)) {
      addEdge(e);
    }
  });
  
  return { nodes: mergedNodes, edges: mergedEdges };
}

const SparklesEffect = () => {
  const sparks = React.useMemo(() => {
    return [...Array(15)].map((_, i) => {
      const startX = 15 + Math.random() * 70;
      const startY = 30 + Math.random() * 40;
      const endX = startX + (Math.random() - 0.5) * 84;
      const peakY = startY - 33.6 - Math.random() * 50.4;
      const endY = startY + 16.8 + Math.random() * 33.6;
      
      return {
        id: i,
        startX,
        startY,
        endX,
        peakY,
        endY,
        duration: 1.0 + Math.random() * 1.0,
        delay: Math.random() * 2,
        size: Math.random() > 0.5 ? 'w-1 h-1' : 'w-1.5 h-1.5',
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 rounded-lg">
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          className={`absolute ${spark.size} bg-indigo-200 rounded-full`}
          initial={{ 
            opacity: 0, 
            scale: 0, 
            left: `${spark.startX}%`, 
            top: `${spark.startY}%` 
          }}
          animate={{ 
            opacity: [0, 0.8, 0], 
            scale: [0, 1.2, 0], 
            left: [`${spark.startX}%`, `${spark.endX}%`], 
            top: [`${spark.startY}%`, `${spark.peakY}%`, `${spark.endY}%`] 
          }}
          transition={{ 
            duration: spark.duration, 
            repeat: Infinity, 
            delay: spark.delay,
            times: [0, 0.4, 1],
            ease: ["easeOut", "easeIn"]
          }}
          style={{
            boxShadow: "0 0 6px 1px rgba(165, 180, 252, 0.5)"
          }}
        />
      ))}
    </div>
  );
};

export default function App() {
  const [text, setText] = useState('');
  const [baseTextLength, setBaseTextLength] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [sketchThumbnail, setSketchThumbnail] = useState<string | null>(null);
  const [currentLog, setCurrentLog] = useState<string>("");
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [appMode, setAppMode] = useState<'brainstorm' | 'pro'>('brainstorm');
  const [hoveredMode, setHoveredMode] = useState<'brainstorm' | 'pro' | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [isSoulAnchorEnabled, setIsSoulAnchorEnabled] = useState(false);
  const [protectedFlaw, setProtectedFlaw] = useState<string | null>(null);
  const [showLogicConflictModal, setShowLogicConflictModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<{ summary: string; actionList: string[] } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);
  const adoptedGhostTexts = useRef<string[]>([]);

  useEffect(() => {
    if (showExportModal && !exportData && !isExporting) {
      generateExportData();
      
      const flowEl = document.querySelector('.react-flow') as HTMLElement;
      if (flowEl) {
        toPng(flowEl, { backgroundColor: '#050505' })
          .then((dataUrl) => {
            setSnapshotImage(dataUrl);
          })
          .catch((err) => {
            console.error('Failed to capture topology', err);
          });
      }
    } else if (!showExportModal) {
      setSnapshotImage(null);
      setExportData(null);
    }
  }, [showExportModal]);

  const generateExportData = async () => {
    setIsExporting(true);
    try {
      const ai = getAIClient();
      const prompt = `You are an AI assistant generating an export summary for a brainstorming session.
      User's original text: "${text}"
      Current Logic Map Nodes: ${JSON.stringify(analysis?.analysis?.nodes || [])}
      
      Task 1: Executive Summary. Generate a max 150-word summary of the core conclusion based ONLY on the user's text and the resolved AI logic branches. Do NOT introduce new facts.
      Task 2: Action List. Scan the nodes for unresolved AI questions (types: depth, breadth, challenge) and conflicts. Generate a specific, actionable Todo list. You MUST reference specific node labels in the tasks (e.g., "针对节点【API 功耗】寻求技术专家意见").
      
      CRITICAL LANGUAGE RULE: Your output MUST strictly match the language of the User's original text. If the user wrote in Chinese, output ONLY in Chinese. If English, ONLY English. Do NOT mix languages.
      
      Return JSON strictly matching this schema:
      {
        "summary": "...",
        "actionList": ["...", "..."]
      }`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              actionList: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "actionList"]
          }
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      setExportData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadSnapshot = async () => {
    if (!exportData) return;
    
    const exportEl = document.getElementById('export-content');
    if (!exportEl) return;

    try {
      const dataUrl = await toJpeg(exportEl, { quality: 0.95, backgroundColor: '#111' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mindstitch-snapshot-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowExportModal(false);
    } catch (e) {
      console.error('Failed to generate JPG', e);
      alert('Failed to generate image. Please try again.');
    }
  };

  // Mind Version Control
  const [historyStack, setHistoryStack] = useState<{text: string, analysis: AnalysisResult | null}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const snapshot = historyStack[prevIndex];
      setText(snapshot.text);
      setAnalysis(snapshot.analysis);
      setHistoryIndex(prevIndex);
      setHasManualEdits(false); // Reset manual edits flag on undo
    } else if (historyIndex === 0) {
      // Undo to initial empty state
      setText('');
      setAnalysis(null);
      setHistoryIndex(-1);
      setHasManualEdits(false);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = historyStack[nextIndex];
      setText(snapshot.text);
      setAnalysis(snapshot.analysis);
      setHistoryIndex(nextIndex);
      setHasManualEdits(false);
    }
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('mindstitch_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
    const savedMode = localStorage.getItem('mindstitch_mode');
    if (savedMode === 'brainstorm' || savedMode === 'pro') {
      setAppMode(savedMode);
      setShowModeSelector(false);
    }
  }, []);

  React.useEffect(() => {
    if (!text.trim()) {
      setBaseTextLength(0);
    }
  }, [text]);

  React.useEffect(() => {
    if (!text.trim() && !analysis) return;
    
    const title = text.trim().split('\n')[0].slice(0, 30) || 'Untitled Idea';
    
    setHistory(prev => {
      const existingIdx = prev.findIndex(h => h.id === currentSessionId);
      const newSession: HistorySession = {
        id: currentSessionId,
        title,
        date: new Date().toISOString(),
        text,
        analysis
      };
      
      let nextHistory;
      if (existingIdx >= 0) {
        nextHistory = [...prev];
        nextHistory[existingIdx] = newSession;
      } else {
        nextHistory = [newSession, ...prev];
      }
      
      localStorage.setItem('mindstitch_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [text, analysis, currentSessionId]);

  const handleBackToStart = () => {
    setText('');
    setAnalysis(null);
    setCurrentSessionId(Date.now().toString());
    setHasManualEdits(false);
    setSketchThumbnail(null);
    setIsWorkspaceMode(false);
    setProtectedFlaw(null);
  };

  const handleEditNode = (nodeId: string, newLabel: string, source: 'Manual' | 'AI' | 'Merged' = 'Manual') => {
    if (!newLabel.trim()) return;
    setHasManualEdits(true);
    
    // If text is empty, sync the new label to the text area to enable the "Stitch Thoughts" button
    if (!text.trim() && newLabel !== '...' && newLabel !== '新节点') {
      setText(newLabel);
    }

    setAnalysis(prev => {
      const currentNodes = prev?.analysis?.nodes || DEFAULT_NODES;
      const currentEdges = prev?.analysis?.edges || DEFAULT_EDGES;
      return {
        ...prev,
        entropy: prev?.entropy || 'high',
        analysis: {
          ...prev?.analysis,
          nodes: currentNodes.map(n => n.id === nodeId ? { ...n, label: newLabel, source, isGap: false } : n),
          edges: currentEdges
        }
      };
    });
  };

  const handleAddNode = (position: { x: number, y: number }) => {
    const newNodeId = `manual-${Date.now()}`;
    setHasManualEdits(true);
    setAnalysis(prev => {
      const currentNodes = prev?.analysis?.nodes || DEFAULT_NODES;
      const currentEdges = prev?.analysis?.edges || DEFAULT_EDGES;
      return {
        ...prev,
        entropy: prev?.entropy || 'high',
        analysis: {
          ...prev?.analysis,
          nodes: [...currentNodes, { id: newNodeId, label: '新节点', type: 'manual', isGap: false, source: 'Manual', position }],
          edges: currentEdges
        }
      };
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    setHasManualEdits(true);
    setAnalysis(prev => {
      const currentNodes = prev?.analysis?.nodes || DEFAULT_NODES;
      const currentEdges = prev?.analysis?.edges || DEFAULT_EDGES;
      return {
        ...prev,
        entropy: prev?.entropy || 'high',
        analysis: {
          ...prev?.analysis,
          nodes: currentNodes.filter(n => n.id !== nodeId),
          edges: currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId)
        }
      };
    });
  };

  const handleAddEdge = (source: string, target: string) => {
    setHasManualEdits(true);
    setAnalysis(prev => {
      const currentNodes = prev?.analysis?.nodes || DEFAULT_NODES;
      const currentEdges = prev?.analysis?.edges || DEFAULT_EDGES;
      // Check if edge already exists
      if (currentEdges.some(e => e.source === source && e.target === target)) return prev;
      
      return {
        ...prev,
        entropy: prev?.entropy || 'high',
        analysis: {
          ...prev?.analysis,
          nodes: currentNodes,
          edges: [...currentEdges, { source, target }]
        }
      };
    });
  };

  const handleInteractionStart = () => {
    if (!isWorkspaceMode) {
      setIsWorkspaceMode(true);
      // Initialize state with default nodes if it's empty, so edits aren't lost
      setAnalysis(prev => {
        if (prev?.analysis?.nodes) return prev;
        return {
          entropy: 'high',
          analysis: {
            nodes: DEFAULT_NODES,
            edges: DEFAULT_EDGES
          }
        };
      });
    }
  };

  const handleUpdateNodePosition = (nodeId: string, position: { x: number, y: number }) => {
    setAnalysis(prev => {
      if (!prev?.analysis?.nodes) return prev;
      return {
        ...prev,
        analysis: {
          ...prev.analysis,
          nodes: prev.analysis.nodes.map(n => n.id === nodeId ? { ...n, position } : n)
        }
      };
    });
  };

  const handleAnalyzeText = async (overrideText?: string | React.MouseEvent, mergeManualEdits: boolean = false) => {
    setIsWorkspaceMode(true);
    const textToAnalyze = typeof overrideText === 'string' ? overrideText : text;
    
    if (!textToAnalyze.trim()) {
      // Empty text: clear map and push to history
      setAnalysis(null);
      setHistoryStack(prev => {
        const newStack = prev.slice(0, historyIndex + 1);
        newStack.push({ text: '', analysis: null });
        if (newStack.length > 20) newStack.shift();
        return newStack;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 19));
      setHasManualEdits(false);
      return;
    }
    
    if (typeof overrideText === 'string') {
      setText(overrideText);
    }

    if (hasManualEdits && !mergeManualEdits && typeof overrideText !== 'string') {
      setShowMergeModal(true);
      return;
    }

    setIsAnalyzing(true);
    setCurrentLog("Initializing thought process...");
    
    const manualEditsContext = mergeManualEdits && analysis?.analysis?.nodes 
      ? `\n\nRespect the user's manual changes as priority anchors in the next logic iteration. User's manually edited nodes: ${JSON.stringify(analysis.analysis.nodes)}` 
      : '';

    const existingContext = analysis?.analysis?.nodes?.length
      ? `\n\nExisting Logic Map Nodes: ${JSON.stringify(analysis.analysis.nodes)}\nExisting Logic Map Edges: ${JSON.stringify(analysis.analysis.edges)}\n\nPlease perform a Delta Merge: keep existing valid nodes/edges, and add new ones based on the user's updated text. Do not start from scratch unless the user's text is completely unrelated.`
      : '';

    const modeContext = appMode === 'brainstorm' 
      ? `\n\nMODE: Brainstorm Mode. Focus on intuition and simple language. Convert technical terms to intuitive questions in nodes (e.g., instead of "RGB to Frequency Mapping", use "How to make colors feel like vibes?").`
      : `\n\nMODE: Pro Mode. Focus on frameworks, technical accuracy, and precise terminology.`;

    const languageContext = `\n\nLANGUAGE LOCK: Strictly enforce that AI output (Map nodes, Ghost text, Guides, actionItems) matches the user's input language. ZERO mixed-language content. If the user writes in Chinese, output ONLY in Chinese. If English, ONLY English.`;

    const soulAnchorContext = isSoulAnchorEnabled
      ? `\n\nSOUL ANCHOR ENABLED: The user's text is locked and protected. Do not attempt to rewrite or alter their core premise. If you detect a critical logic error in their protected text, populate the 'criticalError' field with the error and a proposed fix.`
      : ``;

    const previousGhostContext = analysis?.analysis?.ghostSuggestion 
      ? `\n\nCRITICAL: The previous ghost suggestion was "${analysis.analysis.ghostSuggestion}". You MUST generate a completely different and new ghostSuggestion this time. Do not repeat the previous suggestion.`
      : '';

    const adoptedGhostContext = adoptedGhostTexts.current.length > 0
      ? `\n\nRecently Adopted AI Suggestions (User pressed Tab to accept these):\n${adoptedGhostTexts.current.join('\n')}`
      : '';

    try {
      const ai = getAIClient();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: textToAnalyze,
        config: {
          systemInstruction: `You are "MindStitch", an advanced thought enhancement AI.
Your core task is to assist users in deep thinking.

Core Principles:
1. Semantic Density Check: Evaluate the "Semantic Density" of the input. If it's a short but high-value/explosive idea (e.g., "Real-time audio for blind users on TikTok"), it has HIGH density -> proceed to analysis. If it's low density/vague (e.g., "I want an app"), set entropy to 'low' and provide 1-2 context-aware Socratic questions (e.g., mentioning specific ByteDance constraints, algorithm compatibility, etc.). Do NOT use a hard word count limit. Even if entropy is 'low', you MUST still generate \`nodes\` and \`edges\` reflecting the current rough idea, using \`gap\` nodes to represent your Socratic questions.
2. Anchoring: Never alter, rewrite, or polish the user's original text. The user's words are the "soul" and must be preserved.
3. Non-intrusive Extension: Only provide supplements when the user's logic breaks, information is missing, or arguments are needed.
4. Visual Logic: Reflect the growth process of thoughts in a structured way (nodes and edges).${manualEditsContext}${existingContext}${modeContext}${languageContext}${soulAnchorContext}${previousGhostContext}${adoptedGhostContext}

Workflow:
Step 1: Output real-time thought logs in the "logs" array. Example logs: "正在解析人类意图中的核心锚点...", "正在识别草图中的非线性分支...", "正在将技术术语转写为苏格拉底式直觉提问...".
Step 2: If low density, set entropy to 'low' and set ghostSuggestion to a Mad-libs template (e.g., "我要对【人群】用【方法】解决【痛点】") to guide the user to complete their thought. Do NOT use a hard word count limit. Even if entropy is 'low', you MUST still generate "nodes" and "edges" reflecting the current rough idea, using "gap" nodes to represent your Socratic questions.
Step 3: If high density, extract and Classify (Core points, known facts, fuzzy intents).
Step 4: Logic Gap Diagnosis (Assess completeness. Mark missing links as [Logic Gap]).
Step 5: Generate 3 structured Socratic Pillars (Depth, Breadth, Challenge) to guide the user's next steps.
Step 6: Generate a single-line, high-context ghost suggestion (Linguistic Ghost Text) to inspire the user's next sentence. This is "Intent Continuation". Content should supplement what the user hasn't finished, or be a literary/creative continuation. Use a first-person or suggestive tone (e.g., "Perhaps we can try..."). This MUST be aligned with one of the Socratic Pillars. Set ghostSuggestionType to 'depth', 'breadth', or 'challenge' accordingly.
Step 7: Generate a Logic Map (nodes and edges). Nodes MUST use types 'depth', 'breadth', or 'challenge' to represent their nature. Use 'manual' for user's explicit points. For each AI-generated node, provide a "hint" (Structural Hint). This is a "Logic Breakthrough". Content MUST be hardcore strategies, technical paths, or specific factual support answering the node's question. Use an objective, structured strategy (e.g., list 3 specific technical tradeoffs).

CRITICAL INSTRUCTIONS FOR "Merged" NODES:
1. If the user's text effectively responds to a previous "AI" node (e.g., answers a Socratic question) AND the user's response is substantial (e.g., more than 10 characters), OR incorporates the "Recently Adopted AI Suggestions", you MUST change that node's \`source\` to "Merged".
2. You MUST preserve the exact \`id\` of the original node when converting it to "Merged".
3. Once a node is "Merged" or "Text" (Soul), you CANNOT change it back to "AI". Its text has high priority.
4. "Merged" nodes represent a synthesis of the user's thought and AI's prompt.
5. To perform a Semantic Bridge: Compare the user's new text against the existing "AI" nodes. If a new sentence or paragraph directly addresses the question or topic of an existing "AI" node, update that specific node's \`label\` to reflect the user's answer and change its \`source\` to "Merged". Do NOT create a new node for the answer if it perfectly maps to an existing AI question node.

Return the result strictly as a JSON object matching the schema. Always put the "logs" array as the FIRST key in your JSON response.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              logs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Real-time thought logs. MUST be the first key."
              },
              entropy: {
                type: Type.STRING,
                description: "Either 'low' or 'high'",
              },
              socraticQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "1-2 sharp Socratic questions if entropy is low",
              },
              analysis: {
                type: Type.OBJECT,
                properties: {
                  anchoredSoul: {
                    type: Type.STRING,
                    description: "The user's key points repeated verbatim",
                  },
                  socraticPillars: {
                    type: Type.OBJECT,
                    properties: {
                      depth: { type: Type.STRING, description: "[深度深挖] 向下钻取事实支撑" },
                      breadth: { type: Type.STRING, description: "[水平碰撞] 横向寻找替代路径" },
                      challenge: { type: Type.STRING, description: "[逆向挑战] 反向推演核心假设" }
                    },
                    description: "3 structured Socratic pillars. MUST match user's language."
                  },
                  ghostSuggestion: {
                    type: Type.STRING,
                    description: "ONE single-line, high-context suggestion to inspire the user's next sentence. MUST match user's language."
                  },
                  ghostSuggestionType: {
                    type: Type.STRING,
                    description: "'depth', 'breadth', 'challenge', or 'general'"
                  },
                  criticalError: {
                    type: Type.OBJECT,
                    properties: {
                      error: { type: Type.STRING, description: "Description of the critical logic gap/error" },
                      fix: { type: Type.STRING, description: "Proposed fix for the error" }
                    },
                    description: "Populate ONLY if Soul Anchor is enabled and a critical logic error exists in the user's text."
                  },
                  logicGaps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Identified logic gaps",
                  },
                  branches: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Option A and Option B for future development",
                  },
                  nodes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        type: { type: Type.STRING, description: "'depth', 'breadth', 'challenge', or 'manual'" },
                        isGap: { type: Type.BOOLEAN },
                        source: { type: Type.STRING, description: "Must be 'Text', 'AI', 'Sketch', 'Merged', or 'Manual'" },
                        hint: { type: Type.STRING, description: "Hardcore strategy, technical path, or specific fact answering this node's question. Used for '💡 提示'." }
                      },
                      required: ["id", "label", "type", "isGap", "source"]
                    }
                  },
                  edges: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        source: { type: Type.STRING },
                        target: { type: Type.STRING },
                        label: { type: Type.STRING }
                      },
                      required: ["source", "target"]
                    }
                  }
                },
                required: ["nodes", "edges"]
              }
            },
            required: ["entropy", "analysis"]
          }
        }
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        const logsMatch = fullText.match(/"logs"\s*:\s*\[(.*?)\]/s);
        if (logsMatch) {
          const logsStr = logsMatch[1];
          const individualLogs = logsStr.match(/"([^"]+)"/g);
          if (individualLogs && individualLogs.length > 0) {
            const latestLog = individualLogs[individualLogs.length - 1].replace(/"/g, '');
            setCurrentLog(latestLog);
          }
        }
      }
      
      let responseText = fullText || "{}";
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      
      const data: AnalysisResult = JSON.parse(responseText);
      console.log('Analysis result:', data);
      
      const oldNodes = analysis?.analysis?.nodes || [];
      const oldEdges = analysis?.analysis?.edges || [];
      const newNodes = data.analysis?.nodes || [];
      const newEdges = data.analysis?.edges || [];
      
      const { nodes: mergedNodes, edges: mergedEdges } = mergeGraphs(oldNodes, oldEdges, newNodes, newEdges);
      
      if (data.analysis) {
        data.analysis.nodes = mergedNodes.map(n => ({
          ...n,
          isNewRound: true // Mark all as new round to trigger ghost reset
        }));
        data.analysis.edges = mergedEdges;
      }

      setAnalysis(data);
      
      // Update history stack
      setHistoryStack(prev => {
        const newStack = prev.slice(0, historyIndex + 1);
        newStack.push({ text: textToAnalyze, analysis: data });
        if (newStack.length > 20) newStack.shift();
        return newStack;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 19));
      setHasManualEdits(false);
      adoptedGhostTexts.current = [];

      if (isSoulAnchorEnabled && data.analysis?.criticalError && !protectedFlaw) {
        setShowLogicConflictModal(true);
      }
      setBaseTextLength(textToAnalyze.length);
    } catch (error: any) {
      console.error('Failed to analyze text', error);
      alert(`Failed to analyze text: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setCurrentLog("");
    }
  };

  const handleImageUpload = async (base64Image: string, mimeType: string) => {
    setIsAnalyzing(true);
    setShowUploader(false);
    setSketchThumbnail(`data:${mimeType || 'image/jpeg'};base64,${base64Image.split(',')[1]}`);
    setCurrentLog("Initializing vision models...");
    try {
      const ai = getAIClient();
      const existingNodes = analysis?.analysis?.nodes || [];
      const existingEdges = analysis?.analysis?.edges || [];

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image.split(',')[1],
                mimeType: mimeType || "image/jpeg",
              }
            },
            {
              text: `Analyze this hand-drawn sketch and perform a 'Delta Merge' with the existing logic map.
Existing Nodes: ${JSON.stringify(existingNodes)}
Existing Edges: ${JSON.stringify(existingEdges)}

Instructions:
1. Output real-time thought logs in the "logs" array (e.g., "OCR extracting labels...", "Comparing sketch with text nodes...").
2. Match entities from the sketch with existing text-based nodes.
3. Do NOT clear the map; only add new entities or links found in the sketch.
4. For NEW nodes found only in the sketch, set "source": "Sketch".
5. For existing nodes that are ALSO found in the sketch, set "source": "Merged".
6. For existing nodes NOT in the sketch, keep their original source.
7. SOFT CONFLICT RESOLUTION: If the sketch contradicts the existing text-based logic (e.g., opposite relationships, fundamentally different structures), do NOT fail. Instead, add the conflicting sketch node, set "isConflict": true, and provide a "compromiseProposal" (e.g., "AI proposes: Use a hybrid API approach to balance power and limits").
8. Return the fully merged array of nodes and edges.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              logs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Real-time thought logs. MUST be the first key."
              },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING, description: "'depth', 'breadth', 'challenge', or 'manual'" },
                    isGap: { type: Type.BOOLEAN },
                    source: { type: Type.STRING, description: "Must be 'Text', 'Sketch', 'AI', 'Merged', or 'Manual'" },
                    isConflict: { type: Type.BOOLEAN },
                    compromiseProposal: { type: Type.STRING }
                  },
                  required: ["id", "label", "type", "isGap", "source"]
                }
              },
              edges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                    label: { type: Type.STRING }
                  },
                  required: ["source", "target"]
                }
              }
            },
            required: ["logs", "nodes", "edges"]
          }
        }
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        const logsMatch = fullText.match(/"logs"\s*:\s*\[(.*?)\]/s);
        if (logsMatch) {
          const logsStr = logsMatch[1];
          const individualLogs = logsStr.match(/"([^"]+)"/g);
          if (individualLogs && individualLogs.length > 0) {
            const latestLog = individualLogs[individualLogs.length - 1].replace(/"/g, '');
            setCurrentLog(latestLog);
          }
        }
      }

      let responseText = fullText || "{}";
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      
      const data = JSON.parse(responseText);
      
      const oldNodes = analysis?.analysis?.nodes || [];
      const oldEdges = analysis?.analysis?.edges || [];
      const newNodes = data.nodes || [];
      const newEdges = data.edges || [];
      
      const { nodes: mergedNodes, edges: mergedEdges } = mergeGraphs(oldNodes, oldEdges, newNodes, newEdges);

      setAnalysis((prev) => ({
        entropy: 'high',
        analysis: {
          ...prev?.analysis,
          nodes: mergedNodes.map(n => ({ ...n, isNewRound: true })),
          edges: mergedEdges,
        },
      }));
      setHasManualEdits(false);
    } catch (error: any) {
      console.error('Failed to analyze image', error);
      alert(`Failed to analyze image: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setCurrentLog("");
    }
  };

  const handleResolveConflict = (nodeId: string, proposal: string) => {
    const accept = window.confirm(`Conflict detected!\n\nAI Compromise Proposal:\n${proposal}\n\nClick OK to accept this compromise, or Cancel to keep the nodes separate.`);
    if (accept) {
      setAnalysis(prev => {
        if (!prev?.analysis?.nodes) return prev;
        return {
          ...prev,
          analysis: {
            ...prev.analysis,
            nodes: prev.analysis.nodes.map(n => n.id === nodeId ? { ...n, isConflict: false, label: proposal, source: 'Merged' } : n)
          }
        };
      });
    }
  };

  const handleGenerateGhostText = async (currentText: string): Promise<string | null> => {
    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are MindStitch, an advanced thought enhancement AI. The user is writing a text. Based on the following text, generate a single-line, high-context ghost suggestion to inspire their next sentence. Content should supplement what the user hasn't finished, or be a literary/creative continuation. Use a first-person or suggestive tone (e.g., "Perhaps we can try..."). Output ONLY the suggestion text, nothing else.\n\nText:\n${currentText}`
      });
      return response.text?.trim() || null;
    } catch (e) {
      console.error("Failed to generate ghost text:", e);
      return null;
    }
  };

  const memoizedNodes = React.useMemo(() => analysis?.analysis?.nodes || [], [analysis?.analysis?.nodes]);
  const memoizedEdges = React.useMemo(() => analysis?.analysis?.edges || [], [analysis?.analysis?.edges]);

  const isHighDensity = Math.max(0, text.length - baseTextLength) > 100;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-zinc-300 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-md z-10 flex-nowrap">
        <div className="flex items-center gap-3 flex-nowrap shrink-0">
          {isWorkspaceMode && (
            <button 
              onClick={handleBackToStart}
              className="p-2 mr-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
              title="Back to Start"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0">
            <GitMerge className="w-5 h-5 text-[#E2E8F0]" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-medium tracking-tight text-zinc-100 shrink-0">MindStitch</h1>
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 rounded-full ml-2 shrink-0">
            v2.0.26
          </span>
        </div>

        {/* Undo/Redo Controls */}
        {isWorkspaceMode && (
          <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50 flex-nowrap shrink-0">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-zinc-800 rounded transition-colors shrink-0"
              title="Undo (Stitch state)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <div className="w-px h-4 bg-zinc-800 shrink-0"></div>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= historyStack.length - 1}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-zinc-800 rounded transition-colors shrink-0"
              title="Redo (Stitch state)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 flex-nowrap shrink-0">
          <button
            onClick={() => {
              setShowUploader(true);
              setIsWorkspaceMode(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg border border-zinc-800/50 hover:bg-zinc-800/50 shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Sketch</span>
          </button>
          <button
            onClick={() => setShowModeSelector(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-800/50 border border-zinc-800/50 shrink-0"
          >
            {appMode === 'brainstorm' ? <Zap className="w-4 h-4 text-[#E2E8F0]" strokeWidth={1.5} /> : <BrainCircuit className="w-4 h-4 text-[#E2E8F0]" strokeWidth={1.5} />}
            <span>{appMode === 'brainstorm' ? 'Brainstorm' : 'Pro'}</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg border border-zinc-800/50 hover:bg-zinc-800/50 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Crystallize</span>
          </button>
          <div className="relative flex items-center gap-2 overflow-visible shrink-0 ml-6">
            <button
              onClick={handleAnalyzeText}
              disabled={isAnalyzing || !text.trim()}
              className={clsx(
                "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-lg overflow-hidden shrink-0",
                isHighDensity 
                  ? "bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]" 
                  : "bg-indigo-600/80 hover:bg-indigo-500 shadow-[0_0_10px_rgba(129,140,248,0.2)]"
              )}
            >
              {isHighDensity && <SparklesEffect />}
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Sparkles className="w-4 h-4 relative z-10" />}
              <span className="relative z-10">Stitch Thoughts</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Editor */}
        <div className="w-1/2 border-r border-zinc-800/50 flex flex-col relative bg-[#0d0d0d]">
          <Editor 
            text={text} 
            setText={setText} 
            analysis={analysis} 
            onAutoAnalyze={handleAnalyzeText} 
            onGenerateGhostText={handleGenerateGhostText}
            onGhostAdopted={(text) => {
              adoptedGhostTexts.current.push(text);
            }}
            history={history}
            onLoadSession={(session) => {
              setText(session.text);
              setAnalysis(session.analysis);
              setCurrentSessionId(session.id);
              setHasManualEdits(false);
              setIsWorkspaceMode(true);
              setProtectedFlaw(null);
            }}
            isWorkspaceMode={isWorkspaceMode}
            isSoulAnchorEnabled={isSoulAnchorEnabled}
            setIsSoulAnchorEnabled={setIsSoulAnchorEnabled}
            protectedFlaw={protectedFlaw}
          />
        </div>

        {/* Right Pane: Logic Map */}
        <div className="w-1/2 relative bg-[#050505]">
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 right-4 w-64 p-3 bg-zinc-900 border border-indigo-500/30 rounded-lg shadow-xl z-[1000]"
                >
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-xs text-zinc-300 font-medium">{currentLog || "Thinking..."}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          <LogicMap 
            nodes={memoizedNodes} 
            edges={memoizedEdges} 
            onEditNode={handleEditNode} 
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onAddEdge={handleAddEdge}
            onUpdateNodePosition={handleUpdateNodePosition}
            onResolveConflict={handleResolveConflict}
            onManualEdit={() => setHasManualEdits(true)}
            onInteractionStart={handleInteractionStart}
            onInjectHint={(nodeId) => {
              const node = memoizedNodes.find(n => n.id === nodeId);
              if (node) {
                setAnalysis(prev => {
                  if (!prev) return prev;
                  const newNodes = prev.analysis?.nodes?.map(n => {
                    if (n.id === nodeId) {
                      return { 
                        ...n, 
                        label: n.hint ? `${n.label}\n\n${n.hint}` : n.label,
                        isHintConsumed: true 
                      };
                    }
                    return n;
                  });
                  
                  const newAnalysis = {
                    ...prev,
                    analysis: {
                      ...prev.analysis,
                      nodes: newNodes
                    }
                  } as AnalysisResult;
                  
                  // Update current history snapshot so undo/redo preserves the used state
                  setHistoryStack(history => {
                    const newHistory = [...history];
                    if (historyIndex >= 0 && historyIndex < newHistory.length) {
                      newHistory[historyIndex] = {
                        ...newHistory[historyIndex],
                        analysis: newAnalysis
                      };
                    }
                    return newHistory;
                  });
                  
                  return newAnalysis;
                });
              }
            }}
          />
          
          {/* Sketch History Sidebar/Popover */}
          {sketchThumbnail && (
            <div className="absolute bottom-6 right-6 z-20 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sketch Reference</span>
                <button onClick={() => setSketchThumbnail(null)} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <img src={sketchThumbnail} alt="Uploaded Sketch" className="w-48 h-auto rounded-lg border border-zinc-800/50" />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showModeSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-2xl p-8 bg-zinc-900/80 border border-zinc-700/50 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700 mb-6 relative">
                  <AnimatePresence mode="wait">
                    {hoveredMode === 'pro' || (appMode === 'pro' && hoveredMode === null) ? (
                      <motion.div
                        key="pro"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <BrainCircuit className="w-8 h-8 text-[#E2E8F0]" strokeWidth={1.5} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="brainstorm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Zap className="w-8 h-8 text-[#E2E8F0]" strokeWidth={1.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <h2 className="text-3xl font-medium text-zinc-100 tracking-tight mb-3">Choose Your Mindset</h2>
                <p className="text-zinc-400 text-sm max-w-md mx-auto">
                  Select how MindStitch should interact with your thoughts. You can change this later.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setAppMode('brainstorm');
                    setShowModeSelector(false);
                    localStorage.setItem('mindstitch_mode', 'brainstorm');
                  }}
                  onMouseEnter={() => setHoveredMode('brainstorm')}
                  onMouseLeave={() => setHoveredMode(null)}
                  className="group flex flex-col items-center p-6 bg-zinc-800/30 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-indigo-500/50 rounded-2xl transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-[#E2E8F0]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-100 mb-2">Brainstorm Mode</h3>
                  <p className="text-xs text-zinc-400 text-center leading-relaxed">
                    Focus on intuition and simple language. Technical terms are converted into intuitive questions.
                  </p>
                </button>
                
                <button
                  onClick={() => {
                    setAppMode('pro');
                    setShowModeSelector(false);
                    localStorage.setItem('mindstitch_mode', 'pro');
                  }}
                  onMouseEnter={() => setHoveredMode('pro')}
                  onMouseLeave={() => setHoveredMode(null)}
                  className="group flex flex-col items-center p-6 bg-zinc-800/30 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-emerald-500/50 rounded-2xl transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="w-6 h-6 text-[#E2E8F0]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-100 mb-2">Pro Mode</h3>
                  <p className="text-xs text-zinc-400 text-center leading-relaxed">
                    Focus on frameworks, technical accuracy, and precise terminology for deep architectural thinking.
                  </p>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showLogicConflictModal && analysis?.analysis?.criticalError && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-lg p-6 bg-zinc-900 border border-red-500/30 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.15)]"
            >
              <h2 className="text-lg font-medium text-red-400 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Logic Gap Detected
              </h2>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-zinc-300 leading-relaxed mb-2">
                  <span className="font-semibold text-red-300">Error:</span> {analysis.analysis.criticalError.error}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-emerald-300">Proposed Fix:</span> {analysis.analysis.criticalError.fix}
                </p>
              </div>
              <p className="text-xs text-zinc-500 mb-6">
                Your text is protected by the Soul Anchor. Would you like to apply this fix or keep your original thought?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowLogicConflictModal(false);
                    setProtectedFlaw(analysis.analysis!.criticalError!.error);
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  [坚持我见]
                </button>
                <button
                  onClick={() => {
                    setShowLogicConflictModal(false);
                    setText(text + '\n\n' + analysis.analysis!.criticalError!.fix);
                    setProtectedFlaw(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-400 rounded-lg transition-colors shadow-lg shadow-red-500/25"
                >
                  [修正并缝合]
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
            <div className="bg-[#111] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-[#111] z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Mind Snapshot
                </h2>
                <button onClick={() => setShowExportModal(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-8" id="export-content">
                {isExporting ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Crystallizing thoughts...
                  </div>
                ) : exportData ? (
                  <>
                    <section>
                      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Executive Summary</h3>
                      <p className="text-zinc-200 leading-relaxed">{exportData.summary}</p>
                    </section>
                    
                    <section>
                      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">The Raw Record</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-[#050505] border border-zinc-800 rounded-lg p-4">
                          <h4 className="text-xs font-semibold text-zinc-600 mb-2">SOUL ANCHOR</h4>
                          <div className="text-sm text-zinc-300 whitespace-pre-wrap font-serif">{text}</div>
                        </div>
                        <div className="bg-[#050505] border border-zinc-800 rounded-lg p-4 flex flex-col">
                          <h4 className="text-xs font-semibold text-zinc-600 mb-2">TOPOLOGY BLUEPRINT</h4>
                          <div className="relative flex-1 min-h-[200px] rounded overflow-hidden border border-zinc-800/50">
                            {snapshotImage ? (
                              <img src={snapshotImage} alt="Topology" className="w-full h-full object-contain" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">Capturing blueprint...</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                    
                    <section>
                      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Action List</h3>
                      <ul className="space-y-2">
                        {exportData.actionList.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </>
                ) : null}
              </div>
              
              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 sticky bottom-0 bg-[#111] z-10">
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  disabled={isExporting || !exportData}
                  onClick={downloadSnapshot}
                  className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Confirm Export
                </button>
              </div>
            </div>
          </div>
        )}
        {showUploader && (
          <ImageUploader
            onUpload={handleImageUpload}
            onClose={() => setShowUploader(false)}
          />
        )}
        {showMergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-lg p-6 bg-zinc-900 border border-indigo-500/30 rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.15)]"
            >
              <h2 className="text-lg font-medium text-indigo-400 mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 rounded-md">🔄</span> Merge Manual Edits?
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                Detected manual edits in Logic Map. Merge them with the new text changes?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setHasManualEdits(false);
                    handleAnalyzeText(undefined, false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  No: Discard manual edits
                </button>
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    handleAnalyzeText(undefined, true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors shadow-lg shadow-indigo-500/25"
                >
                  Yes: Sync both
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
