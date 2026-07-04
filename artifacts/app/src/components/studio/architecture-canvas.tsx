import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Trash2, Undo2, Sparkles } from "lucide-react";
import { ServiceNode, type ServiceNodeData } from "./service-node";
import { ComponentPalette } from "./component-palette";
import { InsightsPanel } from "./insights-panel";
import { computeInsights } from "@/lib/architecture-insights";
import { specFor, CATEGORIES } from "@/lib/aws-catalog";
import { mermaidToGraph } from "@/lib/mermaid-to-graph";
import { Button } from "@/components/ui/button";

const nodeTypes: NodeTypes = { service: ServiceNode };

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(36 100% 50%)", width: 16, height: 16 },
};

let seq = 0;
const nextId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

function seedToNodes(mermaid?: string): { nodes: Node[]; edges: Edge[] } {
  const g = mermaidToGraph(mermaid ?? "");
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      type: "service",
      position: n.position,
      data: { type: n.type, label: n.label } satisfies ServiceNodeData,
    })),
    edges: g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

interface CanvasProps {
  /** AI-generated Mermaid diagram used to seed the editable graph. */
  seedMermaid?: string;
  height?: number;
}

function CanvasInner({ seedMermaid, height = 620 }: CanvasProps) {
  const seed = useMemo(() => seedToNodes(seedMermaid), [seedMermaid]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seed.edges);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reseed when a new architecture is generated.
  useEffect(() => {
    setNodes(seed.nodes);
    setEdges(seed.edges);
    setSelectedId(null);
    // Fit after the DOM settles.
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
    return () => clearTimeout(t);
  }, [seed, setNodes, setEdges, fitView]);

  const types = useMemo(() => nodes.map((n) => (n.data as ServiceNodeData).type), [nodes]);
  const insights = useMemo(() => computeInsights(types), [types]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const placeNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      const spec = specFor(type);
      const node: Node = {
        id: nextId(),
        type: "service",
        position,
        data: { type, label: spec?.label ?? type } satisfies ServiceNodeData,
      };
      setNodes((nds) => nds.concat(node));
    },
    [setNodes],
  );

  const addToCenter = useCallback(
    (type: string) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const pos = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 200, y: 160 };
      // small jitter so stacked adds don't overlap perfectly
      placeNode(type, { x: pos.x + (Math.random() * 40 - 20), y: pos.y + (Math.random() * 40 - 20) });
    },
    [placeNode, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/cloudarch-node");
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      placeNode(type, position);
    },
    [placeNode, screenToFlowPosition],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
  }, [setNodes, setEdges]);

  const miniMapColor = useCallback((n: Node) => {
    const spec = specFor((n.data as ServiceNodeData).type);
    return spec ? `hsl(${CATEGORIES[spec.category].hue})` : "hsl(var(--muted-foreground))";
  }, []);

  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-border bg-card/30"
      style={{ height }}
    >
      <ComponentPalette onAdd={addToCenter} />

      <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onSelectionChange={({ nodes: sel }) => setSelectedId(sel[0]?.id ?? null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={2}
          className="bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--border))" />
          <Controls className="!rounded-lg !border !border-border !bg-card !shadow-lg [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground" showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={miniMapColor}
            nodeStrokeWidth={2}
            maskColor="hsl(var(--background) / 0.7)"
            className="!rounded-lg !border !border-border !bg-card"
          />
        </ReactFlow>

        {/* Floating toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 shadow-lg backdrop-blur"
          >
            <span className="px-2 text-[11px] font-medium text-muted-foreground">
              {nodes.length} node{nodes.length === 1 ? "" : "s"}
            </span>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={() => fitView({ padding: 0.2, duration: 400 })}>
              <Maximize2 className="h-3.5 w-3.5" /> Fit
            </Button>
            <AnimatePresence>
              {selectedId && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive" onClick={deleteSelected}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
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
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Drag a component from the left, or click one to drop it here. Connect nodes to model dependencies.
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
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
