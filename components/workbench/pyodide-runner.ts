import type { TracePanel } from "./mock-trace";

export type PyodideTraceFrame = {
  index: number;
  label: string;
  line: number | null;
  panels: TracePanel[];
  variables: Array<{ name: string; value: string }>;
  status: string;
  stdout: string;
};

export type PyodideRunOutput = {
  kind: "ok";
  frames: PyodideTraceFrame[];
};

export type PyodideRunError = {
  kind: "error";
  errorType: string;
  message: string;
  traceback: string;
  line: number | null;
};

export class PyodideUnavailableError extends Error {
  name = "PyodideUnavailableError";
}

export class PyodideRunTimeoutError extends Error {
  name = "PyodideRunTimeoutError";
}

export class PyodideRunCancelledError extends Error {
  name = "PyodideRunCancelledError";
}

type WorkerRunResult =
  | PyodideRunOutput
  | PyodideRunError
  | {
      kind: "unavailable";
      message: string;
    };

type WorkerResponse = {
  type: "result";
  runId: number;
  result: WorkerRunResult;
};

type ActiveRun = {
  runId: number;
  worker: Worker;
  reject: (reason?: unknown) => void;
  timeoutId: number;
  cleanup: () => void;
};

let workerInstance: Worker | null = null;
let activeRun: ActiveRun | null = null;
let runCounter = 0;

const DEFAULT_RUN_TIMEOUT_MS = 15000;

function ensureWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(new URL("./pyodide-trace.worker.ts", import.meta.url), {
      type: "classic",
    });
  }
  return workerInstance;
}

function teardownWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

function clearActiveRun() {
  if (!activeRun) {
    return;
  }
  window.clearTimeout(activeRun.timeoutId);
  activeRun.cleanup();
  activeRun = null;
}

export function cancelPyodideTrace(reason = "Run cancelled.") {
  if (!activeRun) {
    return;
  }

  const pendingRun = activeRun;
  clearActiveRun();
  teardownWorker();
  pendingRun.reject(new PyodideRunCancelledError(reason));
}

export async function runPyodideTrace(
  code: string,
  options?: { timeoutMs?: number },
): Promise<PyodideRunOutput | PyodideRunError> {
  cancelPyodideTrace("A newer run started.");

  const worker = ensureWorker();
  const runId = ++runCounter;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;

  return await new Promise<PyodideRunOutput | PyodideRunError>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (!message || message.type !== "result" || message.runId !== runId) {
        return;
      }

      clearActiveRun();

      if (message.result.kind === "unavailable") {
        reject(new PyodideUnavailableError(message.result.message));
        return;
      }

      resolve(message.result);
    };

    const handleError = () => {
      clearActiveRun();
      teardownWorker();
      reject(new PyodideUnavailableError("Pyodide worker crashed during execution."));
    };

    const timeoutId = window.setTimeout(() => {
      clearActiveRun();
      teardownWorker();
      reject(
        new PyodideRunTimeoutError(
          `Execution timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    activeRun = {
      runId,
      worker,
      reject,
      timeoutId,
      cleanup,
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({
      type: "run",
      runId,
      code,
    });
  });
}
