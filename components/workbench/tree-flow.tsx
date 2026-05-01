"use client";

import {
  Background,
  Handle,
  MarkerType,
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
  shape?: "circle" | "pill";
};

type TreeNodeModel = Node<TreeNodeData, "treeNode">;

type TreeFlowProps = {
  panel: Extract<TracePanel, { kind: "bst" | "list" }>;
  scale: number;
  onScaleChange: (nextScale: number) => void;
  fitRequestToken: number;
};

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

const TREE_LAYOUT_WIDTH = 320;
const TREE_LAYOUT_HEIGHT = 240;

function TreeNode({ data }: NodeProps<TreeNodeModel>) {
  const active = data.tone === "active";
  const isListNode = data.shape === "pill";
  return (
    <div
      className={`relative flex items-center justify-center border text-[11px] font-semibold shadow-sm ${
        isListNode ? "h-11 min-w-[56px] rounded-2xl px-4" : "h-10 w-10 rounded-full"
      } ${
        active
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <Handle
        type="target"
        position={isListNode ? Position.Left : Position.Top}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
      <span className="select-none">{data.label}</span>
      <Handle
        type="source"
        position={isListNode ? Position.Right : Position.Bottom}
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
  fitRequestToken,
  nodeCount,
  size,
  onScaleChange,
}: {
  scale: number;
  fitRequestToken: number;
  nodeCount: number;
  size: { width: number; height: number };
  onScaleChange: (nextScale: number) => void;
}) {
  const reactFlow = useReactFlow();
  const lastFitRequestRef = useRef<number>(fitRequestToken);
  const lastAppliedScaleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!size.width || !size.height || !nodeCount) return;
    if (fitRequestToken === lastFitRequestRef.current) return;

    const rafId = window.requestAnimationFrame(async () => {
      await reactFlow.fitView({
        padding: 0.14,
        duration: 180,
        minZoom: 0.5,
        maxZoom: 0.95,
      });
      const fittedZoom = reactFlow.getZoom();
      lastFitRequestRef.current = fitRequestToken;
      lastAppliedScaleRef.current = fittedZoom;
      onScaleChange(fittedZoom);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [fitRequestToken, nodeCount, onScaleChange, reactFlow, size.height, size.width]);

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

export function NodeFlowViewport({ panel, scale, onScaleChange, fitRequestToken }: TreeFlowProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const layoutWidth = panel.layoutWidth ?? TREE_LAYOUT_WIDTH;
  const layoutHeight = panel.layoutHeight ?? TREE_LAYOUT_HEIGHT;
  const isListPanel = panel.kind === "list";

  const initialNodes: TreeNodeModel[] = useMemo(() => {
    return panel.items.map((item) => ({
      id: item.id,
      type: "treeNode",
      position: {
        x: isListPanel ? item.x : (item.x / 100) * layoutWidth,
        y: isListPanel ? item.y : (item.y / 100) * layoutHeight,
      },
      data: {
        label: item.label,
        tone: item.tone,
        shape: item.shape,
      },
      sourcePosition: item.shape === "pill" ? Position.Right : Position.Bottom,
      targetPosition: item.shape === "pill" ? Position.Left : Position.Top,
    }));
  }, [isListPanel, layoutHeight, layoutWidth, panel.items]);

  const initialEdges = useMemo(
    () =>
      panel.edges.map((edge) => ({
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: isListPanel ? ("straight" as const) : ("smoothstep" as const),
        markerEnd: isListPanel
          ? {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: "#475569",
            }
          : undefined,
        style: isListPanel
          ? {
              stroke: "#475569",
              strokeWidth: 2.2,
            }
          : undefined,
      })),
    [isListPanel, panel.edges],
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
          className={`${
            isListPanel
              ? "bg-[linear-gradient(#ffffff,#fcfcfd)]"
              : "bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
          }`}
        >
          <TreeViewportSync
            scale={scale}
            fitRequestToken={fitRequestToken}
            nodeCount={panel.items.length}
            size={size}
            onScaleChange={onScaleChange}
          />
          <Background
            gap={isListPanel ? 20 : 16}
            size={1}
            color={isListPanel ? "rgba(226,232,240,0.52)" : "rgba(229,231,235,0.42)"}
          />
        </ReactFlow>
      ) : null}
    </div>
  );
}
