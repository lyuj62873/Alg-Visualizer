import { describe, expect, it } from "vitest";
import { getCanvasScrollTarget } from "./canvas-tracking";

describe("getCanvasScrollTarget", () => {
  it("centers a panel inside the canvas viewport when space allows", () => {
    const target = getCanvasScrollTarget(
      {
        clientWidth: 600,
        clientHeight: 400,
        scrollWidth: 1800,
        scrollHeight: 1400,
        scrollLeft: 120,
        scrollTop: 80,
      },
      {
        left: 40,
        top: 100,
        width: 600,
        height: 400,
      },
      {
        left: 340,
        top: 260,
        width: 180,
        height: 120,
      },
    );

    expect(target).toEqual({
      left: 210,
      top: 100,
    });
  });

  it("clamps scroll targets to the canvas bounds", () => {
    const target = getCanvasScrollTarget(
      {
        clientWidth: 600,
        clientHeight: 400,
        scrollWidth: 1300,
        scrollHeight: 900,
        scrollLeft: 640,
        scrollTop: 460,
      },
      {
        left: 0,
        top: 0,
        width: 600,
        height: 400,
      },
      {
        left: 720,
        top: 520,
        width: 260,
        height: 220,
      },
    );

    expect(target).toEqual({
      left: 700,
      top: 500,
    });
  });
});
