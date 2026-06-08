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

export class PyodideInitTimeoutError extends Error {
  name = "PyodideInitTimeoutError";
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

type WorkerInitResponse = {
  type: "init-result";
  initId: number;
  ok: boolean;
  message?: string;
};

type WorkerRunResponse = {
  type: "result";
  runId: number;
  result: WorkerRunResult;
};

type WorkerResponse = WorkerInitResponse | WorkerRunResponse;

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
let initCounter = 0;
let initPromise: Promise<void> | null = null;

const PYODIDE_INIT_TIMEOUT_MS = 120_000;
const PYODIDE_RUN_TIMEOUT_MS = 30_000;

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
  initPromise = null;
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

function waitForWorkerInit(worker: Worker): Promise<void> {
  const initId = ++initCounter;

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new PyodideInitTimeoutError(
          `Python runtime failed to load within ${Math.round(PYODIDE_INIT_TIMEOUT_MS / 1000)} seconds.`,
        ),
      );
    }, PYODIDE_INIT_TIMEOUT_MS);

    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (!message || message.type !== "init-result" || message.initId !== initId) {
        return;
      }

      window.clearTimeout(timeoutId);
      cleanup();

      if (message.ok) {
        resolve();
        return;
      }

      reject(new PyodideUnavailableError(message.message || "Failed to initialize Pyodide."));
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      type: "init",
      initId,
    });
  });
}

export function preloadPyodide(): Promise<void> {
  if (!initPromise) {
    const worker = ensureWorker();
    initPromise = waitForWorkerInit(worker).catch((error) => {
      initPromise = null;
      teardownWorker();
      throw error;
    });
  }

  return initPromise;
}

export async function runPyodideTrace(code: string): Promise<PyodideRunOutput | PyodideRunError> {
  cancelPyodideTrace("A newer run started.");

  await preloadPyodide();

  const worker = ensureWorker();
  const runId = ++runCounter;

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
          `Execution timed out after ${Math.round(PYODIDE_RUN_TIMEOUT_MS / 1000)} seconds.`,
        ),
      );
    }, PYODIDE_RUN_TIMEOUT_MS);

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
