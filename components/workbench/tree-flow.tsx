"use client";

import {
  Background,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TracePanel } from "./mock-trace";

type TreeNodeData = {
  label: string;
  tone?: "default" | "active";
};

type TreeNodeModel = Node<TreeNodeData, "treeNode">;

type TreeFlowProps = {
  panel: Extract<TracePanel, { kind: "bst" }>;
  scale: number;
  onScaleChange: (nextScale: number) => void;
};

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

const TREE_LAYOUT_WIDTH = 320;
const TREE_LAYOUT_HEIGHT = 240;

function TreeNode({ data }: NodeProps<TreeNodeModel>) {
  const active = data.tone === "active";
  return (
    <div
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm ${
        active
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
      <span className="select-none">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
    </div>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function TreeViewportSync({
  scale,
  layoutSignature,
  nodeCount,
  size,
  onScaleChange,
}: {
  scale: number;
  layoutSignature: string;
  nodeCount: number;
  size: { width: number; height: number };
  onScaleChange: (nextScale: number) => void;
}) {
  const reactFlow = useReactFlow();
  const lastFitSignatureRef = useRef<string | null>(null);
  const lastAppliedScaleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!size.width || !size.height || !nodeCount) return;
    if (lastFitSignatureRef.current === layoutSignature) return;

    const rafId = window.requestAnimationFrame(async () => {
      await reactFlow.fitView({
        padding: 0.14,
        duration: 180,
        minZoom: 0.5,
        maxZoom: 0.95,
      });
      const fittedZoom = reactFlow.getZoom();
      lastFitSignatureRef.current = layoutSignature;
      lastAppliedScaleRef.current = fittedZoom;
      onScaleChange(fittedZoom);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [layoutSignature, nodeCount, onScaleChange, reactFlow, size.height, size.width]);

  useEffect(() => {
    if (!size.width || !size.height || !nodeCount) return;
    const currentZoom = reactFlow.getZoom();
    if (Math.abs(currentZoom - scale) < 0.01) {
      lastAppliedScaleRef.current = scale;
      return;
    }
    if (lastAppliedScaleRef.current !== null && Math.abs(lastAppliedScaleRef.current - scale) < 0.01) {
      return;
    }

    reactFlow.zoomTo(scale, { duration: 120 });
    lastAppliedScaleRef.current = scale;
  }, [nodeCount, reactFlow, scale, size.height, size.width]);

  return null;
}

export function TreeFlowViewport({ panel, scale, onScaleChange }: TreeFlowProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const layoutWidth = panel.layoutWidth ?? TREE_LAYOUT_WIDTH;
  const layoutHeight = panel.layoutHeight ?? TREE_LAYOUT_HEIGHT;

  const initialNodes: TreeNodeModel[] = useMemo(() => {
    return panel.items.map((item) => ({
      id: item.id,
      type: "treeNode",
      position: {
        x: (item.x / 100) * layoutWidth,
        y: (item.y / 100) * layoutHeight,
      },
      data: {
        label: item.label,
        tone: item.tone,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
  }, [layoutHeight, layoutWidth, panel.items]);

  const initialEdges = useMemo(
    () =>
      panel.edges.map((edge) => ({
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: "smoothstep" as const,
      })),
    [panel.edges],
  );

  const layoutSignature = useMemo(
    () =>
      JSON.stringify({
        layoutWidth,
        layoutHeight,
        items: panel.items.map((item) => [item.id, item.x, item.y]),
        edges: panel.edges,
      }),
    [layoutHeight, layoutWidth, panel.edges, panel.items],
  );

  return (
    <div ref={ref} className="h-full w-full">
      {size.width > 0 && size.height > 0 ? (
        <ReactFlow
          onInit={(instance: ReactFlowInstance<any, any>) => {
            onScaleChange(instance.getZoom());
          }}
          onMoveEnd={(event, viewport) => {
            if (event?.type === "wheel") {
              onScaleChange(viewport.zoom);
            }
          }}
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          selectionOnDrag={false}
          zoomOnScroll
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={1.9}
          className="bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
        >
          <TreeViewportSync
            scale={scale}
            layoutSignature={layoutSignature}
            nodeCount={panel.items.length}
            size={size}
            onScaleChange={onScaleChange}
          />
          <Background gap={16} size={1} color="rgba(229,231,235,0.42)" />
        </ReactFlow>
      ) : null}
    </div>
  );
}
