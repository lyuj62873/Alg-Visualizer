/// <reference lib="webworker" />

import type {
  PyodideRunError,
  PyodideRunOutput,
} from "./pyodide-runner";

declare const self: DedicatedWorkerGlobalScope & typeof globalThis;

type Pyodide = {
  runPythonAsync(code: string): Promise<unknown>;
};

type WorkerInitRequest = {
  type: "init";
  initId: number;
};

type WorkerRunRequest = {
  type: "run";
  runId: number;
  code: string;
};

type WorkerRequest = WorkerInitRequest | WorkerRunRequest;

type WorkerResult =
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
  result: WorkerResult;
};

type WorkerResponse = WorkerInitResponse | WorkerRunResponse;

declare global {
  interface WorkerGlobalScope {
    loadPyodide?: (opts?: unknown) => Promise<Pyodide>;
    __algolens_pyodide__?: Promise<Pyodide>;
  }
}

const PYODIDE_INDEX_URL = "/pyodide/";

function postInitResult(initId: number, ok: boolean, message?: string) {
  const response: WorkerInitResponse = {
    type: "init-result",
    initId,
    ok,
    message,
  };
  self.postMessage(response);
}

function postResult(runId: number, result: WorkerResult) {
  const response: WorkerRunResponse = {
    type: "result",
    runId,
    result,
  };
  self.postMessage(response);
}

function escapePyString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return await response.text();
}

async function loadPyodideScript(): Promise<void> {
  if (self.loadPyodide) {
    return;
  }

  try {
    self.importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);
  } catch {
    throw new Error("Failed to load pyodide script.");
  }
}

async function getPyodide(): Promise<Pyodide> {
  if (!self.__algolens_pyodide__) {
    self.__algolens_pyodide__ = (async () => {
      await loadPyodideScript();
      if (!self.loadPyodide) {
        throw new Error("Pyodide loader not available after script load.");
      }
      return await self.loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
      });
    })();
  }

  return await self.__algolens_pyodide__;
}

async function executeTrace(code: string): Promise<PyodideRunOutput | PyodideRunError> {
  const pyodide = await getPyodide();
  const dsviz = await fetchText("/py/dsviz.py");
  const userCode = escapePyString(code);

  const wrapped = `
import sys
import types
import json
import linecache
import traceback
import heapq
from collections import Counter, defaultdict, deque

_dsviz_src = r\"\"\"${escapePyString(dsviz)}\"\"\"
_mod = types.ModuleType("dsviz")
sys.modules["dsviz"] = _mod
exec(_dsviz_src, _mod.__dict__)

import dsviz
from dsviz import (
    VisArray,
    VisDeque,
    VisHeap,
    VisListNode,
    VisMap,
    VisObject,
    VisQueue,
    VisSet,
    VisStack,
    VisTreeNode,
    delVis,
    watch,
)
dsviz.reset_trace()

_user_src = r\"\"\"${userCode}\"\"\"
try:
    _trace_filename = "user_code.py"
    linecache.cache[_trace_filename] = (
        len(_user_src),
        None,
        _user_src.splitlines(True),
        _trace_filename,
    )

    def _trace(frame, event, arg):
        if event == "line" and frame.f_code.co_filename == _trace_filename:
            dsviz.set_current_location(frame.f_lineno)
        return _trace

    sys.settrace(_trace)
    try:
        exec(compile(_user_src, _trace_filename, "exec"), globals())

        if "run_case" not in globals():
            raise Exception("Missing required entry point: run_case().")

        run_case()
    finally:
        sys.settrace(None)

    __algolens_trace_json__ = json.dumps({
        "kind": "ok",
        "frames": dsviz.export_trace()["frames"],
    })
except Exception as exc:
    trace_line = getattr(exc, "lineno", None)
    if trace_line is None:
        tb = traceback.extract_tb(exc.__traceback__)
        for frame in reversed(tb):
            if frame.filename == "user_code.py":
                trace_line = frame.lineno
                break
    __algolens_trace_json__ = json.dumps({
        "kind": "error",
        "errorType": exc.__class__.__name__,
        "message": str(exc),
        "traceback": traceback.format_exc(),
        "line": trace_line,
    })
`;

  await pyodide.runPythonAsync(wrapped);
  const traceJson = (await pyodide.runPythonAsync("__algolens_trace_json__")) as string;
  return JSON.parse(traceJson) as PyodideRunOutput | PyodideRunError;
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === "init") {
    void (async () => {
      try {
        await getPyodide();
        postInitResult(message.initId, true);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        postInitResult(
          message.initId,
          false,
          messageText || "Failed to initialize Pyodide.",
        );
      }
    })();
    return;
  }

  if (message.type !== "run") {
    return;
  }

  void (async () => {
    try {
      const result = await executeTrace(message.code);
      postResult(message.runId, result);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      postResult(message.runId, {
        kind: "unavailable",
        message: messageText || "Failed to initialize Pyodide.",
      });
    }
  })();
});

export {};
