import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  Node,
  Connection,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  useStore
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NodeData, EdgeData } from '../App';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { GitMerge } from 'lucide-react';
import dagre from 'dagre';

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, ranksep: 120, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 180 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 140,
        y: nodeWithPosition.y - 90,
      },
    };
  });
};

const CustomNode = ({ data, id }: NodeProps<Node<NodeData>>) => {
  const source = data.source || 'Text';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const zoom = useStore((s) => s.transform[2]);
  
  // Semantic Zoom: Hide details if zoom is less than 0.6 and not a core/manual node
  const isZoomedOut = zoom < 0.6;
  const isCoreOrManual = source === 'Manual' || source === 'Merged' || data.type === 'core' || data.type === 'manual' || data.isConflict;
  const shouldCollapse = isZoomedOut && !isCoreOrManual;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(data.label);
    if ((data as any).onInteractionStart) {
      (data as any).onInteractionStart();
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== data.label) {
      let newSource = data.source;
      if (data.source === 'AI' || ['depth', 'breadth', 'challenge'].includes(data.type)) {
        newSource = 'Merged';
      }
      if ((data as any).onEditNode) {
        (data as any).onEditNode(id, editValue, newSource);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.label);
    }
  };
  
  let bgClass = 'bg-[#1a1a1a]';
  let borderClass = 'border-zinc-700';
  let textClass = 'text-zinc-100';
  let shadowClass = 'shadow-lg';
  let badge = '👤 主观点';
  let animationClass = '';
  let inlineStyle: React.CSSProperties | undefined = undefined;

  const [showGhost, setShowGhost] = useState(false);

  // Reset showGhost if the hint is consumed or changed
  useEffect(() => {
    if (data.isHintConsumed) {
      setShowGhost(false);
    }
  }, [data.isHintConsumed, data.hint]);

  if (data.isConflict) {
    bgClass = 'bg-amber-950/40';
    borderClass = 'border-amber-500 border-dashed';
    textClass = 'text-amber-100';
    shadowClass = 'shadow-[0_0_20px_rgba(245,158,11,0.5)]';
    badge = '⚠️ 逻辑冲突';
  } else if (data.isOrphan) {
    bgClass = 'bg-[#1a1a1a]/50';
    borderClass = 'border-zinc-700 border-dashed';
    textClass = 'text-zinc-500 line-through decoration-zinc-700';
    shadowClass = 'shadow-none';
    badge = '🔗 孤立节点';
    animationClass = 'opacity-60 grayscale';
  } else if (source === 'Manual' || data.type === 'manual') {
    bgClass = 'bg-[#1a1a1a]';
    borderClass = 'border-zinc-500';
    textClass = 'text-zinc-300';
    shadowClass = 'shadow-[0_0_15px_rgba(113,113,122,0.3)]';
    badge = '✍️ 手写锚点';
  } else if (source === 'Merged') {
    bgClass = 'bg-[#1a1a1a]';
    borderClass = 'border-transparent';
    textClass = 'text-zinc-100';
    badge = '🤝 缝合节点';
    
    let rightColor = '#3b82f6';
    if (data.type === 'breadth') rightColor = '#a855f7';
    if (data.type === 'challenge') rightColor = '#ef4444';
    
    shadowClass = `shadow-[0_0_15px_${rightColor}40]`;
    inlineStyle = {
      background: `linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(to right, #E2E8F0, ${rightColor}) border-box`,
      border: '2px solid transparent'
    };
  } else if (source === 'AI' || ['depth', 'breadth', 'challenge'].includes(data.type)) {
    badge = '✨ AI推演';
    if (data.type === 'depth') {
      borderClass = 'border-[#3B82F6] border-solid border-2';
      shadowClass = 'shadow-[0_0_15px_rgba(59,130,246,0.3)]';
    } else if (data.type === 'breadth') {
      borderClass = 'border-[#A855F7] border-solid border-2';
      shadowClass = 'shadow-[0_0_15px_rgba(168,85,247,0.3)]';
    } else if (data.type === 'challenge') {
      borderClass = 'border-[#DC2626] border-solid border-2';
      shadowClass = 'shadow-[0_0_15px_rgba(220,38,38,0.3)]';
    } else {
      borderClass = 'border-teal-400';
      shadowClass = 'shadow-[0_0_20px_rgba(45,212,191,0.4)]';
    }
  } else if (source === 'Sketch') {
    bgClass = 'bg-transparent';
    borderClass = 'border-indigo-500 border-dashed';
    textClass = 'text-indigo-100';
    shadowClass = 'shadow-[0_0_15px_rgba(99,102,241,0.3)]';
    badge = '✏️ 草图识别';
  }

  const handleClick = (e: React.MouseEvent) => {
    if ((data as any).onInteractionStart) {
      (data as any).onInteractionStart();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={twMerge(
        clsx(
          'px-4 py-3 rounded-lg border-2 backdrop-blur-md min-w-[150px] max-w-[250px] relative',
          'transition-colors duration-300',
          bgClass,
          borderClass,
          textClass,
          shadowClass,
          animationClass,
          data.label === '...' && 'opacity-40 hover:opacity-80 cursor-pointer'
        )
      )}
      style={inlineStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {data.isConflict && !shouldCollapse && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const onResolveConflict = (data as any).onResolveConflict as ((id: string, proposal: string) => void) | undefined;
            onResolveConflict?.(data.id, data.compromiseProposal || 'Merge nodes');
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 p-1.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.8)] text-white hover:bg-amber-400 transition-colors z-20"
          title="解决逻辑冲突"
        >
          <GitMerge className="w-3 h-3" />
        </button>
      )}
      {!shouldCollapse && (
        <div className="absolute -top-2 -right-2 bg-zinc-800 text-[9px] font-mono px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300 shadow-sm z-10">
          {badge}
        </div>
      )}
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-zinc-500" />
      
      {shouldCollapse ? (
        <div className="w-8 h-8 flex items-center justify-center m-auto relative">
          <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center opacity-80" style={{ color: inlineStyle?.border ? 'transparent' : 'inherit' }}>
            {data.type === 'depth' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
            {data.type === 'breadth' && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
            {data.type === 'challenge' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span
            className={clsx(
              'text-[9px] font-mono uppercase tracking-wider',
              'text-zinc-500'
            )}
          >
            {data.type}
          </span>
          
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full bg-black/40 text-white text-sm leading-tight p-1 rounded border border-zinc-600 focus:border-indigo-500 outline-none resize-none overflow-hidden"
              rows={Math.max(2, editValue.split('\n').length)}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm leading-tight whitespace-pre-wrap">{data.label}</span>
            </div>
          )}
          
          {/* Render the ghost suggestion preview and accept controls */}
          {showGhost && data.hint && !data.isHintConsumed && (
            <div className="mt-2 pt-2 border-t border-dashed border-zinc-800/80 flex flex-col gap-2">
              <span className="text-xs text-zinc-400 italic leading-snug whitespace-pre-wrap">
                {data.hint}
              </span>
              <div className="flex items-center gap-1.5 self-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGhost(false);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5"
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if ((data as any).onInjectHint) {
                      (data as any).onInjectHint(id);
                    }
                    setShowGhost(false);
                  }}
                  className="text-[10px] bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors flex items-center gap-0.5 font-medium"
                >
                  ✔ 采纳
                </button>
              </div>
            </div>
          )}

          {!(data as any).isInitialNode && (data as any).isIdle && data.isNewRound && data.hint && !data.isHintConsumed && !isEditing && !showGhost && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowGhost(true);
              }}
              className="mt-2 text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors flex items-center gap-1 w-fit"
            >
              💡 提示
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-zinc-500" />
    </motion.div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

interface LogicMapProps {
  nodes?: NodeData[];
  edges?: EdgeData[];
  isIdle?: boolean;
  onEditNode?: (id: string, newLabel: string) => void;
  onAddNode?: (position: { x: number, y: number }) => void;
  onAddEdge?: (source: string, target: string) => void;
  onUpdateNodePosition?: (id: string, position: { x: number, y: number }) => void;
  onResolveConflict?: (id: string, proposal: string) => void;
  onManualEdit?: () => void;
  onInteractionStart?: () => void;
  onInjectHint?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

function LogicMapInner({ nodes = [], edges = [], isIdle = false, onEditNode, onAddNode, onAddEdge, onUpdateNodePosition, onResolveConflict, onManualEdit, onInteractionStart, onInjectHint, onDeleteNode }: LogicMapProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  // Simple auto-layout logic for nodes since Gemini might not return positions
  const initialNodes = useMemo(() => {
    if (nodes.length === 0) {
      return [
        { id: 'bg1', type: 'custom', position: { x: 150, y: 150 }, data: { id: 'bg1', label: '...', type: 'core', isGap: false, source: 'AI', onResolveConflict, onEditNode, onInteractionStart, onInjectHint } },
        { id: 'bg2', type: 'custom', position: { x: 450, y: 250 }, data: { id: 'bg2', label: '...', type: 'intent', isGap: true, source: 'AI', onResolveConflict, onEditNode, onInteractionStart, onInjectHint } },
        { id: 'bg3', type: 'custom', position: { x: 250, y: 450 }, data: { id: 'bg3', label: '...', type: 'fact', isGap: false, source: 'AI', onResolveConflict, onEditNode, onInteractionStart, onInjectHint } },
      ];
    }
    const mappedNodes = nodes.map((node, index) => {
      const hasIncomingEdges = edges.some(edge => edge.target === node.id);
      const isInitialNode = !hasIncomingEdges || 
                            node.type === 'core' || 
                            node.type === 'manual' || 
                            node.source === 'Manual' || 
                            node.source === 'Text';
      return {
        id: node.id,
        type: 'custom',
        position: node.position || { x: 0, y: 0 },
        data: { ...node, isInitialNode, isIdle, onResolveConflict, onEditNode, onInteractionStart, onInjectHint },
      };
    });
    
    return getLayoutedElements(mappedNodes, edges, 'LR');
  }, [nodes, edges, isIdle, onResolveConflict, onEditNode, onInteractionStart, onInjectHint]);

  const initialEdges = useMemo(() => {
    if (edges.length === 0 && nodes.length === 0) {
      return [
        { id: 'e-bg1', source: 'bg1', target: 'bg2', animated: true, style: { stroke: '#2dd4bf', strokeWidth: 2, opacity: 0.5, strokeDasharray: '5,5' } },
        { id: 'e-bg2', source: 'bg2', target: 'bg3', animated: true, style: { stroke: '#2dd4bf', strokeWidth: 2, opacity: 0.5, strokeDasharray: '5,5' } },
      ];
    }
    return edges.map((edge, index) => {
      const targetNode = nodes.find(n => n.id === edge.target);
      const sourceNode = nodes.find(n => n.id === edge.source);
      const isAI = targetNode?.source === 'AI' || ['depth', 'breadth', 'challenge'].includes(targetNode?.type || '');
      const isMerged = targetNode?.source === 'Merged';

      if (isAI || isMerged) {
        let color = '#2dd4bf'; // default teal
        if (targetNode?.type === 'depth') color = '#3B82F6'; // blue
        else if (targetNode?.type === 'breadth') color = '#A855F7'; // purple
        else if (targetNode?.type === 'challenge') color = '#DC2626'; // red
        
        return {
          id: `e${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          animated: isAI, // Only animate if it's purely AI, not Merged
          zIndex: 1000,
          style: { 
            stroke: color, 
            strokeWidth: 2, 
            strokeDasharray: isAI ? '5,5' : 'none', // Solid line for Merged
            filter: `drop-shadow(0 0 5px ${color}80)` 
          },
          labelStyle: { fill: color, fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: '#050505', fillOpacity: 1, rx: 4, ry: 4 },
          labelBgPadding: [8, 4] as [number, number],
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: color,
          },
        };
      } else {
        return {
          id: `e${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          animated: false,
          zIndex: 1000,
          style: { 
            stroke: '#52525b', 
            strokeWidth: 2,
          },
          labelStyle: { fill: '#a1a1aa', fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: '#050505', fillOpacity: 1, rx: 4, ry: 4 },
          labelBgPadding: [8, 4] as [number, number],
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#52525b',
          },
        };
      }
    });
  }, [edges, nodes]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    const hasDrag = changes.some((c: any) => c.type === 'position' && c.dragging);
    if (hasDrag) {
      if (onInteractionStart) onInteractionStart();
      if (onManualEdit) onManualEdit();
    }
    
    // Sync positions back to parent on drag stop (when dragging is false but position changed)
    const positionChanges = changes.filter((c: any) => c.type === 'position' && c.position && !c.dragging);
    if (positionChanges.length > 0 && onUpdateNodePosition) {
      positionChanges.forEach((c: any) => {
        onUpdateNodePosition(c.id, c.position);
      });
    }
  }, [onNodesChange, onManualEdit, onUpdateNodePosition, onInteractionStart]);

  const onConnect = useCallback((params: Connection) => {
    const targetNode = flowNodes.find(n => n.id === params.target);
    const sourceNode = flowNodes.find(n => n.id === params.source);
    const isAI = targetNode?.data?.source === 'AI' || ['depth', 'breadth', 'challenge'].includes((targetNode?.data?.type as string) || '');
    const isMerged = targetNode?.data?.source === 'Merged';

    let color = '#52525b';
    let edgeStyle: any = { stroke: color, strokeWidth: 2 };

    if (isAI || isMerged) {
      color = '#2dd4bf';
      if (targetNode?.data?.type === 'depth') color = '#3B82F6';
      else if (targetNode?.data?.type === 'breadth') color = '#A855F7';
      else if (targetNode?.data?.type === 'challenge') color = '#DC2626';
      edgeStyle = { stroke: color, strokeWidth: 2, strokeDasharray: isAI ? '5,5' : 'none', filter: `drop-shadow(0 0 5px ${color}80)` };
    }

    setEdges((eds) => addEdge({ 
      ...params, 
      animated: isAI, 
      style: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: color }
    } as any, eds));
    
    if (onInteractionStart) onInteractionStart();
    if (onAddEdge && params.source && params.target) {
      onAddEdge(params.source as string, params.target as string);
      if (onManualEdit) onManualEdit();
    }
  }, [setEdges, onAddEdge, onManualEdit, onInteractionStart, flowNodes]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.detail === 2) {
      if (onInteractionStart) onInteractionStart();
      if (onAddNode) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        onAddNode(position);
        if (onManualEdit) onManualEdit();
      }
    }
  }, [onAddNode, onManualEdit, screenToFlowPosition, onInteractionStart]);

  const [menu, setMenu] = useState<{ id?: string, top: number, left: number, type: 'pane' | 'node' } | null>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ top: event.clientY, left: event.clientX, type: 'pane' });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({ id: node.id, top: event.clientY, left: event.clientX, type: 'node' });
  }, []);

  const closeMenu = () => setMenu(null);

  const handleAddNodeFromMenu = () => {
    if (menu && menu.type === 'pane') {
      const position = screenToFlowPosition({ x: menu.left, y: menu.top });
      onAddNode?.(position);
      if (onManualEdit) onManualEdit();
    }
    closeMenu();
  };

  const handleDeleteNodeFromMenu = () => {
    if (menu && menu.type === 'node' && menu.id) {
      onDeleteNode?.(menu.id);
      if (onManualEdit) onManualEdit();
    }
    closeMenu();
  };

  // Update flow when props change, but only if the number of nodes changes or if it's a completely new set
  // This prevents resetting positions when just editing a label
  React.useEffect(() => {
    setNodes((nds) => {
      // If the incoming nodes have the same IDs, just update their data to preserve local positions
      if (nds.length === initialNodes.length && nds.every((n, i) => n.id === initialNodes[i].id)) {
        return nds.map((n, i) => ({ ...n, data: initialNodes[i].data }));
      }
      // Otherwise, it's a new set of nodes (e.g. after AI analysis or adding a node)
      // We should merge the existing positions if they exist
      return initialNodes.map(inNode => {
        const existingNode = nds.find(n => n.id === inNode.id);
        if (existingNode && !inNode.position) {
          return { ...inNode, position: existingNode.position };
        }
        return inNode;
      });
    });
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Auto-Fitting Protocol
  React.useEffect(() => {
    if (flowNodes.length > 0) {
      // Small timeout to ensure DOM is updated before calculating bounds
      const timer = setTimeout(() => {
        fitView({
          padding: 0.2,
          duration: 800,
          minZoom: 0.2,
          maxZoom: 0.9,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [flowNodes.length, fitView]);

  return (
    <div className="w-full h-full relative" onContextMenu={(e) => e.preventDefault()}>
      {/* Neuron Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-indigo-500/5 blur-xl"
            style={{
              width: Math.random() * 100 + 50,
              height: Math.random() * 100 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 50 - 25],
              y: [0, Math.random() * 50 - 25],
              scale: [1, Math.random() * 0.5 + 0.8, 1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onClick={closeMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 50 }}
        minZoom={0.2}
        maxZoom={1.5}
        className="bg-transparent z-10"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={24} size={1} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-400" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.isConflict) return '#f59e0b';
            if (n.data?.source === 'Merged') return '#a855f7';
            if (n.data?.source === 'Manual' || n.data?.type === 'manual') return '#3b82f6';
            if (n.data?.isGap || n.data?.source === 'AI') return '#2dd4bf';
            if (n.data?.source === 'Sketch') return '#6366f1';
            return '#3f3f46';
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          className="!border !border-white/10 !backdrop-blur-md !rounded-lg overflow-hidden !bg-zinc-900/50"
        />
      </ReactFlow>

      {menu && (
        <div 
          className="fixed z-50 bg-[#0d0d0d]/90 backdrop-blur-md border border-zinc-800/50 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] py-1 min-w-[120px]"
          style={{ top: menu.top, left: menu.left }}
        >
          {menu.type === 'pane' && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
              onClick={handleAddNodeFromMenu}
            >
              + 新建节点
            </button>
          )}
          {menu.type === 'node' && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              onClick={handleDeleteNodeFromMenu}
            >
              🗑️ 删除节点
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LogicMap(props: LogicMapProps) {
  return (
    <ReactFlowProvider>
      <LogicMapInner {...props} />
    </ReactFlowProvider>
  );
}
