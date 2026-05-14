export type AxisAlignedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasViewportSnapshot = {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getCanvasScrollTarget(
  viewport: CanvasViewportSnapshot,
  viewportRect: AxisAlignedRect,
  panelRect: AxisAlignedRect,
) {
  const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const centeredLeft =
    viewport.scrollLeft +
    (panelRect.left - viewportRect.left) -
    Math.max(0, (viewport.clientWidth - panelRect.width) / 2);
  const centeredTop =
    viewport.scrollTop +
    (panelRect.top - viewportRect.top) -
    Math.max(0, (viewport.clientHeight - panelRect.height) / 2);

  return {
    left: clamp(centeredLeft, 0, maxScrollLeft),
    top: clamp(centeredTop, 0, maxScrollTop),
  };
}
