"use client";

import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import { useEffect, useRef, useState } from "react";
import { TraceContentCell, TraceFrame, TraceMapEntry, TracePanel } from "./mock-trace";
import { NodeFlowViewport } from "./tree-flow";

function isNodeFlowKind(
  panel: TracePanel,
): panel is Extract<TracePanel, { kind: "bst" | "list" }> {
  return panel.kind === "bst" || panel.kind === "list";
}

type DragPositions = Record<
  string,
  { x: number; y: number; width?: number; height?: number; scale?: number }
>;

type PanelPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type PanelVisibilityMode = "open" | "minimized" | "closed";

type PanelFocusRequest = {
  panelId: string;
  token: number;
};

type InteractionState = {
  mode: "drag" | "resize";
  panelId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  panelStart: PanelPosition;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  captureTarget: HTMLElement | null;
  resizeFrom?: {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function panelKey(panelId: string) {
  return `panel:${panelId}`;
}

function setPanelScale(
  setPositions: Dispatch<SetStateAction<DragPositions>>,
  panel: TracePanel,
  nextScale: number,
) {
  setPositions((current) => {
    const key = panelKey(panel.id);
    const prior = current[key] ?? {
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      scale: panel.scale,
    };

    return {
      ...current,
      [key]: {
        ...prior,
        scale: clamp(nextScale, 0.75, 1.9),
      },
    };
  });
}

function getEffectiveMinSize(panel: TracePanel) {
  return {
    width: 2,
    height: 2,
  };
}

function getEffectiveMaxSize(panel: TracePanel) {
  return {
    width: panel.maxWidth ?? 96,
    height: panel.maxHeight ?? 96,
  };
}

function getPanelPosition(panel: TracePanel, positions: DragPositions): PanelPosition {
  const current = positions[panelKey(panel.id)] ?? {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    scale: panel.scale,
  };
  const scale = current.scale ?? panel.scale;
  const minSize = getEffectiveMinSize(panel);
  const maxSize = getEffectiveMaxSize(panel);

  return {
    x: current.x,
    y: current.y,
    width: clamp(current.width ?? panel.width, minSize.width, maxSize.width),
    height: clamp(current.height ?? panel.height, minSize.height, maxSize.height),
    scale,
  };
}

function formatDimensions(dimensions?: number[]) {
  return dimensions && dimensions.length ? dimensions.join(" x ") : null;
}

function bringPanelToFront(order: string[], panelId: string) {
  return [...order.filter((id) => id !== panelId), panelId];
}

function syncPanelOrder(order: string[], panels: TracePanel[]) {
  const panelIds = panels.map((panel) => panel.id);
  const panelIdSet = new Set(panelIds);
  const retained = order.filter((panelId) => panelIdSet.has(panelId));
  const additions = panelIds.filter((panelId) => !retained.includes(panelId));
  return [...retained, ...additions];
}

function summarizeContentCell(cell: TraceContentCell): unknown {
  if (cell.kind === "value" || cell.kind === "ref") {
    return {
      kind: cell.kind,
      id: cell.id,
      label: cell.label,
      targetPanelId: cell.kind === "ref" ? cell.targetPanelId ?? null : null,
      clickable: cell.kind === "ref" ? cell.clickable !== false : false,
      tone: cell.tone ?? "default",
      containsActive: !!cell.containsActive,
    };
  }

  return {
    kind: cell.kind,
    id: cell.id,
    layout: cell.layout ?? "row",
    dimensions: cell.dimensions ?? [],
    tone: cell.tone ?? "default",
    containsActive: !!cell.containsActive,
    cells: cell.cells.map((child) => summarizeContentCell(child)),
  };
}

function summarizeMapEntry(entry: TraceMapEntry): unknown {
  return {
    id: entry.id,
    tone: entry.tone ?? "default",
    containsActive: !!entry.containsActive,
    key: summarizeContentCell(entry.key),
    value: summarizeContentCell(entry.value),
  };
}

function getPanelSignature(panel: TracePanel) {
  if (panel.kind === "array") {
    return JSON.stringify({
      kind: panel.kind,
      title: panel.title,
      layout: panel.layout ?? "row",
      dimensions: panel.dimensions ?? [],
      cells: panel.cells.map((cell) => summarizeContentCell(cell)),
    });
  }

  if (panel.kind === "map") {
    return JSON.stringify({
      kind: panel.kind,
      title: panel.title,
      entries: panel.entries.map((entry) => summarizeMapEntry(entry)),
    });
  }

  return JSON.stringify({
    kind: panel.kind,
    title: panel.title,
    items: panel.items.map((item) => ({
      id: item.id,
      label: item.label,
      x: item.x,
      y: item.y,
      tone: item.tone ?? "default",
      shape: item.shape ?? "circle",
    })),
    edges: panel.edges,
  });
}

function clampCanvasZoom(value: number) {
  return clamp(value, 0.3, 1.6);
}

function panelHasActiveFocus(panel: TracePanel) {
  const hasActiveCell = (cell: TraceContentCell): boolean => {
    if (cell.kind === "value" || cell.kind === "ref") {
      return cell.tone === "active" || !!cell.containsActive;
    }
    return (
      cell.tone === "active" ||
      !!cell.containsActive ||
      cell.cells.some((child) => hasActiveCell(child))
    );
  };

  if (panel.kind === "array") {
    return panel.cells.some((cell) => hasActiveCell(cell));
  }

  if (panel.kind === "map") {
    return panel.entries.some(
      (entry) =>
        entry.tone === "active" ||
        !!entry.containsActive ||
        hasActiveCell(entry.key) ||
        hasActiveCell(entry.value),
    );
  }

  return panel.items.some((item) => item.tone === "active");
}

function getResizeCursor(resizeFrom: NonNullable<InteractionState["resizeFrom"]>) {
  const { left, right, top, bottom } = resizeFrom;
  if ((left && top) || (right && bottom)) {
    return "nwse-resize";
  }
  if ((right && top) || (left && bottom)) {
    return "nesw-resize";
  }
  if (left || right) {
    return "ew-resize";
  }
  if (top || bottom) {
    return "ns-resize";
  }
  return "default";
}

function ValueToken({ cell }: { cell: Extract<TraceContentCell, { kind: "value" }> }) {
  const isActive = cell.tone === "active";
  const containsActive = !!cell.containsActive;

  return (
    <div
      className={`flex min-h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5 py-2 text-[13px] font-semibold shadow-sm ${
        isActive
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : containsActive
            ? "border-[#fdba74] bg-[#fffbeb] text-[#9a3412]"
            : "border-[#d1d5db] bg-white text-[#111827]"
      }`}
    >
      <span className="whitespace-nowrap">{cell.label}</span>
    </div>
  );
}

function ReferenceToken({
  cell,
  onReferenceClick,
}: {
  cell: Extract<TraceContentCell, { kind: "ref" }>;
  onReferenceClick: (panelId: string) => void;
}) {
  const isActive = cell.tone === "active";
  const containsActive = !!cell.containsActive;
  const isClickable = cell.clickable !== false && !!cell.targetPanelId;

  if (!isClickable) {
    return (
      <div
        className={`flex min-h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5 py-2 text-[13px] font-semibold shadow-sm ${
          isActive
            ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
            : containsActive
              ? "border-[#fdba74] bg-[#fffbeb] text-[#9a3412]"
              : "border-[#d1d5db] bg-[#f9fafb] text-[#6b7280]"
        }`}
      >
        <span className="whitespace-nowrap">{cell.label}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onReferenceClick(cell.targetPanelId!);
      }}
      className={`flex min-h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5 py-2 text-[13px] font-semibold shadow-sm transition hover:-translate-y-[1px] ${
        isActive
          ? "border-[#fb923c] bg-[#fff7ed] text-[#c2410c]"
          : containsActive
            ? "border-[#fdba74] bg-[#fffbeb] text-[#9a3412]"
            : "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe]"
      }`}
    >
      <span className="whitespace-nowrap">{cell.label}</span>
    </button>
  );
}

function ContentView({
  layout,
  cells,
  depth,
  onReferenceClick,
}: {
  layout: "row" | "matrix" | "stack";
  cells: TraceContentCell[];
  depth: number;
  onReferenceClick: (panelId: string) => void;
}) {
  if (layout === "matrix") {
    return (
      <div className="space-y-1.5">
        {cells.map((row, rowIndex) => {
          if (row.kind === "array") {
            return (
              <div key={row.id} className="flex items-center gap-1.5">
                <div className="w-5 text-right text-[10px] font-semibold text-[#94a3b8]">
                  {rowIndex}
                </div>
                <div className="flex min-w-max items-start gap-1.5">
                  {row.cells.map((child) => (
                    <ContentCellView
                      key={child.id}
                      cell={child}
                      depth={depth + 1}
                      onReferenceClick={onReferenceClick}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={row.id} className="flex items-center gap-1.5">
              <div className="w-5 text-right text-[10px] font-semibold text-[#94a3b8]">
                {rowIndex}
              </div>
              <ContentCellView cell={row} depth={depth + 1} onReferenceClick={onReferenceClick} />
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === "stack") {
    return (
      <div className="space-y-2">
        {cells.map((child, index) => (
          <div key={child.id} className="rounded-xl border border-[#e2e8f0] bg-white/70 px-2.5 py-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Slice {index}
            </div>
            <ContentCellView cell={child} depth={depth + 1} onReferenceClick={onReferenceClick} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-w-max items-start gap-1.5 pb-1">
      {cells.map((child) => (
        <ContentCellView
          key={child.id}
          cell={child}
          depth={depth + 1}
          onReferenceClick={onReferenceClick}
        />
      ))}
    </div>
  );
}

function ContentCellView({
  cell,
  depth,
  onReferenceClick,
}: {
  cell: TraceContentCell;
  depth: number;
  onReferenceClick: (panelId: string) => void;
}) {
  const nestedBg = depth % 2 === 0 ? "bg-[#fffaf5]" : "bg-white";
  if (cell.kind === "value") {
    return <ValueToken cell={cell} />;
  }

  if (cell.kind === "ref") {
    return <ReferenceToken cell={cell} onReferenceClick={onReferenceClick} />;
  }

  const isActive = cell.tone === "active";
  const containsActive = !!cell.containsActive;
  const dimensionsLabel = formatDimensions(cell.dimensions);
  const layout = cell.layout ?? "row";

  return (
    <div
      className={`rounded-xl border px-2.5 py-2.5 shadow-sm ${nestedBg} ${
        isActive
          ? "border-[#fb923c] ring-1 ring-[#fdba74]"
          : containsActive
            ? "border-[#fdba74]"
            : "border-[#e5e7eb]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
        <span>
          {layout === "matrix" ? "Matrix" : layout === "stack" ? "Nested Blocks" : "Nested Array"}
        </span>
        {dimensionsLabel ? <span>{dimensionsLabel}</span> : null}
      </div>
      {cell.cells.length ? (
        <ContentView
          layout={layout}
          cells={cell.cells}
          depth={depth}
          onReferenceClick={onReferenceClick}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-[#d1d5db] px-3 py-2 text-xs text-[#6b7280]">
          Empty
        </div>
      )}
    </div>
  );
}

function ArrayPanelBody({
  panel,
  scale,
  setPositions,
  onReferenceClick,
  isResizing,
}: {
  panel: Extract<TracePanel, { kind: "array" }>;
  scale: number;
  setPositions: Dispatch<SetStateAction<DragPositions>>;
  onReferenceClick: (panelId: string) => void;
  isResizing: boolean;
}) {
  const dimensionsLabel = formatDimensions(panel.dimensions);
  const layout = panel.layout ?? "row";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dragScroll, setDragScroll] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    const zoomStep = delta > 0 ? -0.08 : 0.08;
    setPanelScale(setPositions, panel, scale + zoomStep);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const container = scrollRef.current;
    if (!container) return;

    setDragScroll({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
    container.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragScroll || dragScroll.pointerId !== event.pointerId) return;
    const container = scrollRef.current;
    if (!container) return;

    container.scrollLeft = dragScroll.scrollLeft - (event.clientX - dragScroll.startClientX);
    container.scrollTop = dragScroll.scrollTop - (event.clientY - dragScroll.startClientY);
  }

  function endPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (container && dragScroll?.pointerId === event.pointerId && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    setDragScroll(null);
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      style={{
        overflow: isResizing ? "hidden" : undefined,
        overscrollBehavior: "contain",
      }}
      className={`absolute inset-0 overflow-auto p-3 ${
        dragScroll ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className="inline-block min-w-full origin-top-left align-top"
        style={{
          zoom: scale,
        }}
      >
        {panel.cells.length ? (
          <div className="min-w-max pb-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              <span>
                {layout === "matrix" ? "2D Array" : layout === "stack" ? "Multi-D Array" : "Array"}
              </span>
              <div className="flex items-center gap-2">
                {dimensionsLabel ? <span>{dimensionsLabel}</span> : null}
                <span>{Math.round(scale * 100)}%</span>
              </div>
            </div>
            <ContentView
              layout={layout}
              cells={panel.cells}
              depth={0}
              onReferenceClick={onReferenceClick}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-[#d1d5db] text-sm text-[#6b7280]">
            No objects yet for this step.
          </div>
        )}
      </div>
    </div>
  );
}

function MapPanelBody({
  panel,
  scale,
  setPositions,
  onReferenceClick,
  isResizing,
}: {
  panel: Extract<TracePanel, { kind: "map" }>;
  scale: number;
  setPositions: Dispatch<SetStateAction<DragPositions>>;
  onReferenceClick: (panelId: string) => void;
  isResizing: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dragScroll, setDragScroll] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
    const zoomStep = delta > 0 ? -0.08 : 0.08;
    setPanelScale(setPositions, panel, scale + zoomStep);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const container = scrollRef.current;
    if (!container) return;

    setDragScroll({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
    container.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragScroll || dragScroll.pointerId !== event.pointerId) return;
    const container = scrollRef.current;
    if (!container) return;

    container.scrollLeft = dragScroll.scrollLeft - (event.clientX - dragScroll.startClientX);
    container.scrollTop = dragScroll.scrollTop - (event.clientY - dragScroll.startClientY);
  }

  function endPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (container && dragScroll?.pointerId === event.pointerId && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    setDragScroll(null);
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      style={{
        overflow: isResizing ? "hidden" : undefined,
        overscrollBehavior: "contain",
      }}
      className={`absolute inset-0 overflow-auto p-3 ${
        dragScroll ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className="inline-block min-w-full origin-top-left align-top"
        style={{
          zoom: scale,
        }}
      >
        {panel.entries.length ? (
          <div className="min-w-max space-y-2 pb-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              <span>Map</span>
              <div className="flex items-center gap-2">
                <span>{panel.entries.length} entries</span>
                <span>{Math.round(scale * 100)}%</span>
              </div>
            </div>
            {panel.entries.map((entry) => {
              const entryActive =
                entry.tone === "active" || !!entry.containsActive;
              return (
                <div
                  key={entry.id}
                  className={`grid min-w-[420px] grid-cols-[minmax(140px,1fr)_20px_minmax(180px,1.4fr)] items-start gap-3 rounded-xl border px-3 py-3 shadow-sm ${
                    entryActive
                      ? "border-[#fdba74] bg-[#fffaf0]"
                      : "border-[#e5e7eb] bg-white"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      Key
                    </div>
                    <ContentCellView
                      cell={entry.key}
                      depth={0}
                      onReferenceClick={onReferenceClick}
                    />
                  </div>
                  <div className="pt-7 text-center text-[13px] font-semibold text-[#94a3b8]">
                    →
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      Value
                    </div>
                    <ContentCellView
                      cell={entry.value}
                      depth={0}
                      onReferenceClick={onReferenceClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-[#d1d5db] text-sm text-[#6b7280]">
            Map is empty for this step.
          </div>
        )}
      </div>
    </div>
  );
}

function VisualizationPanel({
  panel,
  positions,
  setPositions,
  fitRequestToken,
  requestFitView,
  trackingEnabled,
  toggleTracking,
  zIndex,
  onFocusPanel,
  onReferenceClick,
  onMinimizePanel,
  onClosePanel,
  panelRef,
}: {
  panel: TracePanel;
  positions: DragPositions;
  setPositions: Dispatch<SetStateAction<DragPositions>>;
  fitRequestToken: number;
  requestFitView: (panelId: string) => void;
  trackingEnabled: boolean;
  toggleTracking: (panelId: string) => void;
  zIndex: number;
  onFocusPanel: (panelId: string) => void;
  onReferenceClick: (panelId: string) => void;
  onMinimizePanel: (panelId: string) => void;
  onClosePanel: (panelId: string) => void;
  panelRef: (node: HTMLElement | null) => void;
}) {
  const currentPanelPosition = getPanelPosition(panel, positions);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  useEffect(() => {
    if (!interaction) return;
    const activeInteraction = interaction;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      activeInteraction.mode === "drag"
        ? "grabbing"
        : getResizeCursor(
            activeInteraction.resizeFrom ?? {
              left: false,
              right: true,
              top: false,
              bottom: true,
            },
          );

    function onPointerMove(event: PointerEvent) {
      const host = document.querySelector<HTMLElement>('[data-canvas-root="true"]');
      if (!host) return;

      event.preventDefault();

      const rect = host.getBoundingClientRect();
      const dxPct = ((event.clientX - activeInteraction.startClientX) / rect.width) * 100;
      const dyPct = ((event.clientY - activeInteraction.startClientY) / rect.height) * 100;

      setPositions((current) => {
        const next = { ...current };

        if (activeInteraction.mode === "drag") {
          const maxX = Math.max(2, 98 - activeInteraction.panelStart.width);
          const maxY = Math.max(4, 96 - activeInteraction.panelStart.height);
          next[panelKey(activeInteraction.panelId)] = {
            ...activeInteraction.panelStart,
            x: clamp(activeInteraction.panelStart.x + dxPct, 2, maxX),
            y: clamp(activeInteraction.panelStart.y + dyPct, 4, maxY),
          };
          return next;
        }

        const resizeFrom = activeInteraction.resizeFrom ?? {
          left: false,
          right: true,
          top: false,
          bottom: true,
        };
        const rightEdge = activeInteraction.panelStart.x + activeInteraction.panelStart.width;
        const bottomEdge = activeInteraction.panelStart.y + activeInteraction.panelStart.height;
        const maxRight = Math.min(
          activeInteraction.maxWidth + activeInteraction.panelStart.x,
          98,
        );
        const maxBottom = Math.min(
          activeInteraction.maxHeight + activeInteraction.panelStart.y,
          96,
        );

        let nextX = activeInteraction.panelStart.x;
        let nextY = activeInteraction.panelStart.y;
        let nextWidth = activeInteraction.panelStart.width;
        let nextHeight = activeInteraction.panelStart.height;

        if (resizeFrom.right) {
          nextWidth = clamp(
            activeInteraction.panelStart.width + dxPct,
            activeInteraction.minWidth,
            Math.max(activeInteraction.minWidth, maxRight - activeInteraction.panelStart.x),
          );
        }

        if (resizeFrom.bottom) {
          nextHeight = clamp(
            activeInteraction.panelStart.height + dyPct,
            activeInteraction.minHeight,
            Math.max(activeInteraction.minHeight, maxBottom - activeInteraction.panelStart.y),
          );
        }

        if (resizeFrom.left) {
          const rawNextX = clamp(
            activeInteraction.panelStart.x + dxPct,
            2,
            rightEdge - activeInteraction.minWidth,
          );
          nextWidth = clamp(
            rightEdge - rawNextX,
            activeInteraction.minWidth,
            activeInteraction.maxWidth,
          );
          nextX = rightEdge - nextWidth;
        }

        if (resizeFrom.top) {
          const rawNextY = clamp(
            activeInteraction.panelStart.y + dyPct,
            4,
            bottomEdge - activeInteraction.minHeight,
          );
          nextHeight = clamp(
            bottomEdge - rawNextY,
            activeInteraction.minHeight,
            activeInteraction.maxHeight,
          );
          nextY = bottomEdge - nextHeight;
        }

        next[panelKey(activeInteraction.panelId)] = {
          ...activeInteraction.panelStart,
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        };
        return next;
      });
    }

    function onPointerUp() {
      if (
        activeInteraction.captureTarget &&
        activeInteraction.captureTarget.hasPointerCapture(activeInteraction.pointerId)
      ) {
        activeInteraction.captureTarget.releasePointerCapture(activeInteraction.pointerId);
      }
      setInteraction(null);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [interaction, setPositions]);

  function startInteraction(
    event: ReactPointerEvent<HTMLElement>,
    mode: InteractionState["mode"],
    resizeFrom?: NonNullable<InteractionState["resizeFrom"]>,
  ) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    onFocusPanel(panel.id);

    const minSize = getEffectiveMinSize(panel);
    const maxSize = getEffectiveMaxSize(panel);
    const captureTarget = event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    setInteraction({
      mode,
      panelId: panel.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      panelStart: currentPanelPosition,
      minWidth: minSize.width,
      minHeight: minSize.height,
      maxWidth: maxSize.width,
      maxHeight: maxSize.height,
      captureTarget,
      resizeFrom,
    });
  }

  const resizeHandles = [
    {
      key: "top",
      className: "absolute left-3 right-3 top-0 z-20 h-3 cursor-ns-resize",
      resizeFrom: { left: false, right: false, top: true, bottom: false },
    },
    {
      key: "bottom",
      className: "absolute bottom-0 left-3 right-3 z-20 h-3 cursor-ns-resize",
      resizeFrom: { left: false, right: false, top: false, bottom: true },
    },
    {
      key: "left",
      className: "absolute bottom-3 left-0 top-3 z-20 w-3 cursor-ew-resize",
      resizeFrom: { left: true, right: false, top: false, bottom: false },
    },
    {
      key: "right",
      className: "absolute bottom-3 right-0 top-3 z-20 w-3 cursor-ew-resize",
      resizeFrom: { left: false, right: true, top: false, bottom: false },
    },
    {
      key: "top-left",
      className: "absolute left-0 top-0 z-30 h-5 w-5 cursor-nwse-resize",
      resizeFrom: { left: true, right: false, top: true, bottom: false },
    },
    {
      key: "top-right",
      className: "absolute right-0 top-0 z-30 h-5 w-5 cursor-nesw-resize",
      resizeFrom: { left: false, right: true, top: true, bottom: false },
    },
    {
      key: "bottom-left",
      className: "absolute bottom-0 left-0 z-30 h-5 w-5 cursor-nesw-resize",
      resizeFrom: { left: true, right: false, top: false, bottom: true },
    },
    {
      key: "bottom-right",
      className: "absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize",
      resizeFrom: { left: false, right: true, top: false, bottom: true },
    },
  ] as const;
  const isResizing = interaction?.mode === "resize";

  return (
    <article
      ref={panelRef}
      onPointerDown={() => onFocusPanel(panel.id)}
      className="absolute overflow-hidden rounded-xl border border-[#d6d9df] bg-white shadow-sm"
      style={{
        left: `${currentPanelPosition.x}%`,
        top: `${currentPanelPosition.y}%`,
        width: `${currentPanelPosition.width}%`,
        height: `${currentPanelPosition.height}%`,
        zIndex,
      }}
    >
      <div
        onPointerDown={(event) => startInteraction(event, "drag")}
        className="flex cursor-grab items-center justify-between border-b border-[#f3f4f6] bg-white/95 px-3 py-2 text-xs active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-[#111827]">{panel.title}</span>
          <span className="rounded-md bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] text-[#6b7280]">
            {panel.typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isNodeFlowKind(panel) ? (
            <>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleTracking(panel.id);
                }}
                className={`rounded-md border px-2 py-1 text-[10px] ${
                  trackingEnabled
                    ? "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]"
                    : "border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                }`}
              >
                {trackingEnabled ? "Track On" : "Track Off"}
              </button>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  requestFitView(panel.id);
                }}
                className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[10px] text-[#4b5563] hover:bg-[#f9fafb]"
              >
                Fit
              </button>
            </>
          ) : null}
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMinimizePanel(panel.id);
            }}
            className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[10px] text-[#4b5563] hover:bg-[#f9fafb]"
          >
            Minimize
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClosePanel(panel.id);
            }}
            className="rounded-md border border-[#fecaca] bg-[#fff1f2] px-2 py-1 text-[10px] text-[#b91c1c] hover:bg-[#ffe4e6]"
          >
            Close
          </button>
        </div>
      </div>
      <div
        className={`relative h-[calc(100%-37px)] overflow-hidden ${
          panel.kind === "bst"
            ? "bg-[radial-gradient(circle_at_top,#fff7ed,transparent_35%),linear-gradient(#ffffff,#fcfcfd)]"
            : "bg-[#fcfcfd]"
        }`}
      >
        {isNodeFlowKind(panel) ? (
          <NodeFlowViewport
            panel={panel}
            scale={currentPanelPosition.scale}
            onScaleChange={(nextScale) => setPanelScale(setPositions, panel, nextScale)}
            fitRequestToken={fitRequestToken}
            trackingEnabled={trackingEnabled}
          />
        ) : panel.kind === "map" ? (
          <MapPanelBody
            panel={panel}
            scale={currentPanelPosition.scale}
            setPositions={setPositions}
            onReferenceClick={onReferenceClick}
            isResizing={!!isResizing}
          />
        ) : (
          <ArrayPanelBody
            panel={panel as Extract<TracePanel, { kind: "array" }>}
            scale={currentPanelPosition.scale}
            setPositions={setPositions}
            onReferenceClick={onReferenceClick}
            isResizing={!!isResizing}
          />
        )}
        {resizeHandles.map((handle) => (
          <div
            key={handle.key}
            onPointerDown={(event) => startInteraction(event, "resize", handle.resizeFrom)}
            style={{ touchAction: "none" }}
            className={handle.className}
          />
        ))}
      </div>
    </article>
  );
}

export function ResultsPane({
  frame,
  totalFrames,
  phase,
  errorInfo,
  onPrev,
  onNext,
}: {
  frame: TraceFrame;
  totalFrames: number;
  phase: "idle" | "running" | "ready" | "error";
  errorInfo: { errorType: string; message: string; traceback: string; line: number | null } | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [positions, setPositions] = useState<DragPositions>({});
  const [fitRequests, setFitRequests] = useState<Record<string, number>>({});
  const [trackingModes, setTrackingModes] = useState<Record<string, boolean>>({});
  const [panelOrder, setPanelOrder] = useState<string[]>([]);
  const [panelVisibilityModes, setPanelVisibilityModes] = useState<
    Record<string, PanelVisibilityMode>
  >({});
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [focusRequest, setFocusRequest] = useState<PanelFocusRequest | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const panelSignatureRef = useRef<Record<string, string>>({});
  const panelElementRefs = useRef<Record<string, HTMLElement | null>>({});
  const focusRequestCounterRef = useRef(0);

  function requestFitView(panelId: string) {
    setFitRequests((current) => ({
      ...current,
      [panelId]: (current[panelId] ?? 0) + 1,
    }));
  }

  function focusPanel(panelId: string) {
    setPanelOrder((current) => bringPanelToFront(current, panelId));
  }

  function focusAndTrackPanel(panelId: string) {
    focusPanel(panelId);
    focusRequestCounterRef.current += 1;
    setFocusRequest({
      panelId,
      token: focusRequestCounterRef.current,
    });
  }

  function toggleTracking(panelId: string) {
    setTrackingModes((current) => ({
      ...current,
      [panelId]: !(current[panelId] ?? true),
    }));
  }

  function minimizePanel(panelId: string) {
    setPanelVisibilityModes((current) => ({
      ...current,
      [panelId]: "minimized",
    }));
  }

  function closePanel(panelId: string) {
    setPanelVisibilityModes((current) => ({
      ...current,
      [panelId]: "closed",
    }));
  }

  function openPanel(panelId: string) {
    setPanelVisibilityModes((current) => ({
      ...current,
      [panelId]: "open",
    }));
    focusAndTrackPanel(panelId);
  }

  function registerPanelElement(panelId: string, node: HTMLElement | null) {
    panelElementRefs.current[panelId] = node;
  }

  function scrollPanelIntoView(panelId: string) {
    const panelElement = panelElementRefs.current[panelId];
    if (!panelElement) {
      return false;
    }
    panelElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    return true;
  }

  useEffect(() => {
    setTrackingModes((current) => {
      const next = { ...current };
      let changed = false;
      for (const panel of frame.panels) {
        if (!isNodeFlowKind(panel) || panel.id in next) {
          continue;
        }
        next[panel.id] = true;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [frame.panels]);

  useEffect(() => {
    setPanelOrder((current) => syncPanelOrder(current, frame.panels));
  }, [frame.panels]);

  useEffect(() => {
    const changedPanelIds: string[] = [];
    const activeChangedPanelIds: string[] = [];
    const newOrRestoredPanelIds: string[] = [];
    const nextVisibilityModes = { ...panelVisibilityModes };
    let visibilityChanged = false;

    for (const panel of frame.panels) {
      const signature = getPanelSignature(panel);
      const previousSignature = panelSignatureRef.current[panel.id];
      const mode = nextVisibilityModes[panel.id];

      if (!mode) {
        nextVisibilityModes[panel.id] = "open";
        visibilityChanged = true;
        changedPanelIds.push(panel.id);
        newOrRestoredPanelIds.push(panel.id);
        if (panelHasActiveFocus(panel)) {
          activeChangedPanelIds.push(panel.id);
        }
      } else if (previousSignature !== undefined && previousSignature !== signature) {
        changedPanelIds.push(panel.id);
        if (panelHasActiveFocus(panel)) {
          activeChangedPanelIds.push(panel.id);
        }
        if (mode !== "open") {
          nextVisibilityModes[panel.id] = "open";
          visibilityChanged = true;
          newOrRestoredPanelIds.push(panel.id);
        }
      }

      panelSignatureRef.current[panel.id] = signature;
    }

    if (visibilityChanged) {
      setPanelVisibilityModes(nextVisibilityModes);
    }

    if (changedPanelIds.length) {
      const focusTargetPanelId =
        newOrRestoredPanelIds[newOrRestoredPanelIds.length - 1] ??
        activeChangedPanelIds[activeChangedPanelIds.length - 1] ??
        changedPanelIds[changedPanelIds.length - 1] ??
        null;

      if (focusTargetPanelId) {
        setPanelOrder((current) => bringPanelToFront(current, focusTargetPanelId));
        focusRequestCounterRef.current += 1;
        setFocusRequest({
          panelId: focusTargetPanelId,
          token: focusRequestCounterRef.current,
        });
      }
    }
  }, [frame.panels, panelVisibilityModes]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    let timeoutId = 0;
    let attemptCount = 0;
    let cancelled = false;

    const tryScroll = () => {
      if (cancelled) {
        return;
      }

      scrollPanelIntoView(focusRequest.panelId);
      attemptCount += 1;

      if (attemptCount < 8) {
        timeoutId = window.setTimeout(tryScroll, 90);
        return;
      }

      setFocusRequest((current) =>
        current?.token === focusRequest.token ? null : current,
      );
    };

    timeoutId = window.setTimeout(tryScroll, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [canvasZoom, focusRequest, frame.panels, positions, panelVisibilityModes]);

  useEffect(() => {
    setPositions((current) => {
      const nextPositions: DragPositions = {};

      for (const panel of frame.panels) {
        const prior = current[panelKey(panel.id)] ?? {
          x: panel.x,
          y: panel.y,
          width: panel.width,
          height: panel.height,
          scale: panel.scale,
        };
        const scale = prior.scale ?? panel.scale;
        const minSize = getEffectiveMinSize(panel);
        const maxSize = getEffectiveMaxSize(panel);

        nextPositions[panelKey(panel.id)] = {
          x: prior.x,
          y: prior.y,
          width: clamp(prior.width ?? panel.width, minSize.width, maxSize.width),
          height: clamp(prior.height ?? panel.height, minSize.height, maxSize.height),
          scale,
        };

        if (!isNodeFlowKind(panel)) {
          continue;
        }
      }

      return nextPositions;
    });
  }, [frame]);

  const panelById = new Map(frame.panels.map((panel) => [panel.id, panel]));
  const orderedPanels = panelOrder
    .map((panelId) => panelById.get(panelId))
    .filter((panel): panel is TracePanel => !!panel);
  const activePanelId = [...orderedPanels]
    .reverse()
    .find((panel) => panelVisibilityModes[panel.id] === "open")?.id;
  const visiblePanels = orderedPanels.filter(
    (panel) => panelVisibilityModes[panel.id] !== "minimized" && panelVisibilityModes[panel.id] !== "closed",
  );
  const tabPanels = orderedPanels.filter((panel) => panelVisibilityModes[panel.id] !== "closed");

  return (
    <section className="relative flex min-h-[720px] min-w-0 flex-1 overflow-hidden rounded-xl border border-[#d1d5db] bg-[#fafafa] shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-[#e5e7eb] bg-white/95 px-4 py-3">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-h-11 min-w-max items-center gap-2 pr-2">
              {tabPanels.length ? (
                tabPanels.map((panel) => {
                  const mode = panelVisibilityModes[panel.id] ?? "open";
                  const isActive = activePanelId === panel.id;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => openPanel(panel.id)}
                      className={`flex items-center gap-2 rounded-t-xl border px-3 py-2 text-left text-xs transition ${
                        mode === "minimized"
                          ? "border-[#d1d5db] bg-[#f8fafc] text-[#64748b]"
                          : isActive
                            ? "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                      }`}
                    >
                      <span className="max-w-[160px] truncate font-medium">{panel.title}</span>
                      <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px]">
                        {mode === "minimized" ? "Hidden" : panel.typeLabel}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-[#d1d5db] px-3 py-2 text-xs text-[#94a3b8]">
                  No active panels
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-[#fafafa] px-1.5 py-1">
              <button
                type="button"
                onClick={() => setCanvasZoom((current) => clampCanvasZoom(current - 0.1))}
                className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs text-[#4b5563] hover:bg-[#f9fafb]"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom(1)}
                className="rounded-md px-2 py-1 text-xs font-medium text-[#4b5563] hover:bg-white"
              >
                {Math.round(canvasZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom((current) => clampCanvasZoom(current + 0.1))}
                className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs text-[#4b5563] hover:bg-[#f9fafb]"
              >
                +
              </button>
            </div>
            <button
              onClick={onPrev}
              disabled={phase === "running" || frame.index === 0}
              className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={onNext}
              disabled={phase === "running" || frame.index === totalFrames - 1}
              className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            <div className="rounded-md bg-[#f3f4f6] px-3 py-2 text-sm text-[#4b5563]">
              {frame.index + 1} / {totalFrames}
            </div>
          </div>
        </div>

        <div
          ref={canvasViewportRef}
          className="flex-1 overflow-auto bg-[linear-gradient(#fcfcfd,#f8fafc)]"
        >
          <div
            data-canvas-root="true"
            className="relative min-h-[2200px] min-w-[1180px] w-full bg-[radial-gradient(circle_at_top_left,#ffffff,#f8fafc_45%,#eef2ff_100%)]"
            style={{ zoom: canvasZoom }}
          >
            {visiblePanels.map((panel, index) => (
              <VisualizationPanel
                key={panel.id}
                panel={panel}
                positions={positions}
                setPositions={setPositions}
                fitRequestToken={fitRequests[panel.id] ?? 0}
                requestFitView={requestFitView}
                trackingEnabled={trackingModes[panel.id] ?? true}
                toggleTracking={toggleTracking}
                zIndex={20 + index}
                onFocusPanel={focusPanel}
                onReferenceClick={focusAndTrackPanel}
                onMinimizePanel={minimizePanel}
                onClosePanel={closePanel}
                panelRef={(node) => registerPanelElement(panel.id, node)}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="flex w-[240px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white/96">
        <div className="border-b border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
          Variables
        </div>
        <div className="space-y-2 overflow-auto p-4">
          {frame.variables.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-sm"
            >
              <span className="font-medium text-[#374151]">{item.name}</span>
              <span className="font-mono text-[#111827]">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[#f3f4f6] px-4 py-3 text-sm font-medium text-[#111827]">
          Output
        </div>
        <div className="space-y-3 overflow-auto p-4 text-sm text-[#4b5563]">
          {phase === "error" && errorInfo ? (
            <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-[#7f1d1d]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dc2626]">
                Runtime error
              </div>
              <div className="mt-2 break-words text-sm font-semibold text-[#991b1b] [overflow-wrap:anywhere]">
                {errorInfo.errorType}
              </div>
              <div className="mt-1 break-words text-sm text-[#7f1d1d] [overflow-wrap:anywhere]">
                {errorInfo.message}
              </div>
              {errorInfo.line ? (
                <div className="mt-2 text-xs font-medium text-[#b91c1c]">
                  Line {errorInfo.line}
                </div>
              ) : null}
              <details className="mt-3 rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-xs text-[#7f1d1d]">
                <summary className="cursor-pointer select-none font-medium text-[#b91c1c]">
                  Traceback
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#7f1d1d] [overflow-wrap:anywhere]">
                  {errorInfo.traceback}
                </pre>
              </details>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-[#d1fae5] bg-[#ecfdf5] px-3 py-3 text-[#065f46]">
                {frame.status}
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 font-mono text-xs text-[#374151]">
                {frame.stdout}
              </div>
            </>
          )}
        </div>
      </aside>
    </section>
  );
}
