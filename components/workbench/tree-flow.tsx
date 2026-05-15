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
  containsActive?: boolean;
  targetPanelId?: string;
  clickable?: boolean;
  onReferenceClick?: (panelId: string) => void;
};

type TreeNodeModel = Node<TreeNodeData, "treeNode">;

type TreeFlowProps = {
  panel: Extract<TracePanel, { kind: "bst" | "list" }>;
  scale: number;
  onScaleChange: (nextScale: number) => void;
  fitRequestToken: number;
  trackingEnabled: boolean;
  onReferenceClick: (panelId: string) => void;
};

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

const TREE_LAYOUT_WIDTH = 320;
const TREE_LAYOUT_HEIGHT = 240;

function TreeNode({ data }: NodeProps<TreeNodeModel>) {
  const active = data.tone === "active";
  const containsActive = !!data.containsActive;
  const isListNode = data.shape === "pill";
  const isClickable = data.clickable !== false && !!data.targetPanelId && !!data.onReferenceClick;
  return (
    <div
      className={`nodrag nopan relative flex items-center justify-center border text-[11px] font-semibold shadow-sm ${
        isListNode ? "h-11 min-w-[56px] rounded-2xl px-4" : "h-10 w-10 rounded-full"
      } ${
        active
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : containsActive
            ? "border-[#fdba74] bg-[#fffbeb] text-[#9a3412]"
            : isClickable
              ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]"
          : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <Handle
        type="target"
        position={isListNode ? Position.Left : Position.Top}
        style={{ width: 8, height: 8, border: "none", background: "transparent", opacity: 0 }}
      />
      {isClickable ? (
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onReferenceClick?.(data.targetPanelId!);
          }}
          className="nodrag nopan select-none whitespace-nowrap rounded px-1 hover:underline"
        >
          {data.label}
        </button>
      ) : (
        <span className="select-none whitespace-nowrap">{data.label}</span>
      )}
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
  trackingEnabled,
  activeNodeFocus,
  isListPanel,
}: {
  scale: number;
  fitRequestToken: number;
  nodeCount: number;
  size: { width: number; height: number };
  onScaleChange: (nextScale: number) => void;
  trackingEnabled: boolean;
  activeNodeFocus: { id: string; x: number; y: number } | null;
  isListPanel: boolean;
}) {
  const reactFlow = useReactFlow();
  const lastFitRequestRef = useRef<number>(fitRequestToken);
  const lastAppliedScaleRef = useRef<number | null>(null);
  const lastTrackedNodeRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!trackingEnabled || !activeNodeFocus || !size.width || !size.height || !nodeCount) return;
    const signature = `${activeNodeFocus.id}:${Math.round(activeNodeFocus.x)}:${Math.round(activeNodeFocus.y)}`;
    if (lastTrackedNodeRef.current === signature) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const viewport = reactFlow.getViewport();
      const zoom = viewport.zoom;
      const screenX = activeNodeFocus.x * zoom + viewport.x;
      const screenY = activeNodeFocus.y * zoom + viewport.y;
      const horizontalPadding = isListPanel
        ? { left: 144, right: 120 }
        : { left: 88, right: 88 };
      const verticalPadding = isListPanel
        ? { top: 44, bottom: 44 }
        : { top: 72, bottom: 72 };
      let nextViewportX = viewport.x;
      let nextViewportY = viewport.y;

      if (screenX < horizontalPadding.left) {
        nextViewportX += horizontalPadding.left - screenX;
      } else if (screenX > size.width - horizontalPadding.right) {
        nextViewportX -= screenX - (size.width - horizontalPadding.right);
      }

      if (screenY < verticalPadding.top) {
        nextViewportY += verticalPadding.top - screenY;
      } else if (screenY > size.height - verticalPadding.bottom) {
        nextViewportY -= screenY - (size.height - verticalPadding.bottom);
      }

      const moved =
        Math.abs(nextViewportX - viewport.x) > 0.5 || Math.abs(nextViewportY - viewport.y) > 0.5;

      if (moved) {
        reactFlow.setViewport(
          {
            x: nextViewportX,
            y: nextViewportY,
            zoom,
          },
          { duration: 180 },
        );
      }
      lastTrackedNodeRef.current = signature;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activeNodeFocus, isListPanel, nodeCount, reactFlow, size.height, size.width, trackingEnabled]);

  return null;
}

export function NodeFlowViewport({
  panel,
  scale,
  onScaleChange,
  fitRequestToken,
  trackingEnabled,
  onReferenceClick,
}: TreeFlowProps) {
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
        containsActive: item.containsActive,
        targetPanelId: item.targetPanelId,
        clickable: item.clickable,
        onReferenceClick,
      },
      style: {
        pointerEvents: "all",
      },
      sourcePosition: item.shape === "pill" ? Position.Right : Position.Bottom,
      targetPosition: item.shape === "pill" ? Position.Left : Position.Top,
    }));
  }, [isListPanel, layoutHeight, layoutWidth, onReferenceClick, panel.items]);

  const nodePositionById = useMemo(
    () =>
      new Map(
        initialNodes.map((node) => [
          node.id,
          {
            x: node.position.x,
            y: node.position.y,
          },
        ]),
      ),
    [initialNodes],
  );

  const activeNodeFocus = useMemo(() => {
    const activeItem = panel.items.find((item) => item.tone === "active");
    if (!activeItem) {
      return null;
    }

    const baseX = isListPanel ? activeItem.x : (activeItem.x / 100) * layoutWidth;
    const baseY = isListPanel ? activeItem.y : (activeItem.y / 100) * layoutHeight;
    const centerX = baseX + (activeItem.shape === "pill" ? 28 : 20);
    const centerY = baseY + (activeItem.shape === "pill" ? 22 : 20);

    return {
      id: activeItem.id,
      x: centerX,
      y: centerY,
    };
  }, [isListPanel, layoutHeight, layoutWidth, panel.items]);

  const initialEdges = useMemo(
    () =>
      panel.edges.map((edge) => ({
        id: (() => {
          if (!isListPanel) {
            return `${edge.from}-${edge.to}`;
          }

          const sourcePosition = nodePositionById.get(edge.from);
          const targetPosition = nodePositionById.get(edge.to);
          const sourceKey = sourcePosition
            ? `${Math.round(sourcePosition.x)}-${Math.round(sourcePosition.y)}`
            : "missing";
          const targetKey = targetPosition
            ? `${Math.round(targetPosition.x)}-${Math.round(targetPosition.y)}`
            : "missing";
          return `${edge.from}-${edge.to}-${sourceKey}-${targetKey}`;
        })(),
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
    [isListPanel, nodePositionById, panel.edges],
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
            trackingEnabled={trackingEnabled}
            activeNodeFocus={activeNodeFocus}
            isListPanel={isListPanel}
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
