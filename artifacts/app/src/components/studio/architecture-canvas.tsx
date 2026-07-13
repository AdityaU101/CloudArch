import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type EdgeProps,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Trash2, Undo2, Sparkles, X } from "lucide-react";
import { ServiceNode, type ServiceNodeData } from "./service-node";
import { ComponentPalette } from "./component-palette";
import { InsightsPanel } from "./insights-panel";
import { computeInsights } from "@/lib/architecture-insights";
import { specFor, CATEGORIES } from "@/lib/cloud-catalog";
import type { CloudProvider } from "@/lib/cloud-providers";
import { StudioProviderContext } from "./provider-context";
import { mermaidToGraph } from "@/lib/mermaid-to-graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- edge deletion wiring ---------------------------------------------------
const EdgeActionsContext = createContext<{ deleteEdge: (id: string) => void }>({ deleteEdge: () => {} });

/** An edge with a delete (×) affordance that appears on hover or when selected. */
function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const { deleteEdge } = useContext(EdgeActionsContext);
  const [hover, setHover] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={26} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2 p-2"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <button
            type="button"
            title="Delete connection"
            onClick={(e) => {
              e.stopPropagation();
              deleteEdge(id);
            }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition-all",
              hover || selected
                ? "scale-100 border-destructive/60 text-destructive opacity-100"
                : "scale-75 border-border opacity-0",
            )}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes: NodeTypes = { service: ServiceNode };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

const defaultEdgeOptions = {
  type: "deletable",
  animated: true,
  style: { stroke: "hsl(var(--primary))", strokeWidth: 1.75 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(36 100% 50%)", width: 18, height: 18 },
};

let seq = 0;
const nextId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

function seedToGraph(mermaid?: string, provider: CloudProvider = "aws"): { nodes: Node[]; edges: Edge[] } {
  const g = mermaidToGraph(mermaid ?? "", provider);
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      type: "service",
      position: n.position,
      data: { type: n.type, label: n.label } satisfies ServiceNodeData,
    })),
    edges: g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "deletable" })),
  };
}

// --- lifted graph state -----------------------------------------------------
export interface ArchitectureGraph {
  seed: { nodes: Node[]; edges: Edge[] };
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  setNodes: ReturnType<typeof useNodesState<Node>>[1];
  setEdges: ReturnType<typeof useEdgesState<Edge>>[1];
}

/**
 * Owns the editable graph. Lives in the parent (the diagram tab) so the design
 * survives switching between the Studio and Blueprint views. Reseeds only when
 * a new architecture is generated (the Mermaid source changes).
 */
export function useArchitectureGraph(seedMermaid?: string, provider: CloudProvider = "aws"): ArchitectureGraph {
  const seed = useMemo(() => seedToGraph(seedMermaid, provider), [seedMermaid, provider]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seed.edges);
  const firstRun = useRef(true);

  useEffect(() => {
    // Initial state is already seeded; only repopulate on subsequent generations.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setNodes(seed.nodes);
    setEdges(seed.edges);
  }, [seed, setNodes, setEdges]);

  return { seed, nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges };
}

interface CanvasProps {
  graph: ArchitectureGraph;
  /** Which cloud the design targets; drives service names and pricing. */
  provider?: CloudProvider;
  height?: number;
}

const fitOptions = { padding: 0.18, maxZoom: 1.15, minZoom: 0.4 };

function CanvasInner({ graph, provider = "aws", height = 720 }: CanvasProps) {
  const { seed, nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges } = graph;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Refit whenever a new design is generated (seed identity changes) or on mount.
  useEffect(() => {
    const t = setTimeout(() => fitView({ ...fitOptions, duration: 400 }), 60);
    return () => clearTimeout(t);
  }, [seed, fitView]);

  const types = useMemo(() => nodes.map((n) => (n.data as ServiceNodeData).type), [nodes]);
  const insights = useMemo(() => computeInsights(types, provider), [types, provider]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const deleteEdge = useCallback((id: string) => setEdges((eds) => eds.filter((e) => e.id !== id)), [setEdges]);

  const placeNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      const spec = specFor(type, provider);
      const node: Node = {
        id: nextId(),
        type: "service",
        position,
        data: { type, label: spec?.label ?? type } satisfies ServiceNodeData,
      };
      setNodes((nds) => nds.concat(node));
    },
    [setNodes, provider],
  );

  const addToCenter = useCallback(
    (type: string) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const pos = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 200, y: 160 };
      placeNode(type, { x: pos.x + (Math.random() * 48 - 24), y: pos.y + (Math.random() * 48 - 24) });
    },
    [placeNode, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/cloudarch-node");
      if (!type) return;
      placeNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [placeNode, screenToFlowPosition],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setNodes, setEdges]);

  const miniMapColor = useCallback((n: Node) => {
    const spec = specFor((n.data as ServiceNodeData).type);
    return spec ? `hsl(${CATEGORIES[spec.category].hue})` : "hsl(var(--muted-foreground))";
  }, []);

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-card/30" style={{ height }}>
      <ComponentPalette onAdd={addToCenter} />

      <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <EdgeActionsContext.Provider value={{ deleteEdge }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onSelectionChange={({ nodes: sn, edges: se }) => {
              setSelectedNodeId(sn[0]?.id ?? null);
              setSelectedEdgeId(se[0]?.id ?? null);
            }}
            fitView
            fitViewOptions={fitOptions}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2.5}
            className="bg-transparent"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="hsl(var(--border))" />
            <Controls
              className="!rounded-lg !border !border-border !bg-card !shadow-lg [&>button:hover]:!bg-muted [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground"
              showInteractive={false}
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={miniMapColor}
              nodeStrokeWidth={2}
              maskColor="hsl(var(--background) / 0.7)"
              className="!rounded-lg !border !border-border !bg-card"
            />
          </ReactFlow>
        </EdgeActionsContext.Provider>

        {/* Floating toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 shadow-lg backdrop-blur"
          >
            <span className="px-2 text-[11px] font-medium text-muted-foreground">
              {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} link{edges.length === 1 ? "" : "s"}
            </span>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={() => fitView({ ...fitOptions, duration: 400 })}>
              <Maximize2 className="h-3.5 w-3.5" /> Fit
            </Button>
            <AnimatePresence>
              {(selectedNodeId || selectedEdgeId) && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 whitespace-nowrap px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => (selectedNodeId ? deleteSelectedNode() : selectedEdgeId && deleteEdge(selectedEdgeId))}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {selectedNodeId ? "Delete node" : "Delete link"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {nodes.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={clearAll}>
                <Undo2 className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </motion.div>
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">Start designing</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Drag a component from the left, or click one to drop it here. Connect nodes to model dependencies, and hover a link to remove it.
            </p>
          </div>
        )}
      </div>

      <InsightsPanel insights={insights} />
    </div>
  );
}

/**
 * Interactive architecture studio: a live, editable graph with a component
 * palette and a cost/tradeoff rail that recomputes on every edit.
 */
export function ArchitectureCanvas(props: CanvasProps) {
  return (
    <StudioProviderContext.Provider value={props.provider ?? "aws"}>
      <ReactFlowProvider>
        <CanvasInner {...props} />
      </ReactFlowProvider>
    </StudioProviderContext.Provider>
  );
}
