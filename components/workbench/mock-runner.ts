import { TraceFrame, traceFrames } from "./mock-trace";

export type RunOutput = {
  kind: "ok";
  frames: TraceFrame[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMockTrace(code: string): Promise<RunOutput> {
  await sleep(450);

  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("No code to run.");
  }

  if (!/def\s+run_case\s*\(/.test(code)) {
    throw new Error("Missing required entry point: run_case().");
  }

  const runStamp = new Date().toLocaleTimeString();
  const frames: TraceFrame[] = traceFrames.map((frame) => ({
    ...frame,
    stdout: `${frame.stdout} | run: ${runStamp}`,
  }));

  return { kind: "ok", frames };
}
