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

type Pyodide = {
  runPythonAsync(code: string): Promise<any>;
  loadPackage?(names: string[] | string): Promise<void>;
};

declare global {
  interface Window {
    loadPyodide?: (opts?: any) => Promise<Pyodide>;
    __algolens_pyodide?: Promise<Pyodide>;
  }
}

async function loadPyodideScript(): Promise<void> {
  if (window.loadPyodide) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-pyodide="true"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load pyodide script.")));
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.pyodide = "true";
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new PyodideUnavailableError("Failed to load pyodide script."));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<Pyodide> {
  if (!window.__algolens_pyodide) {
    window.__algolens_pyodide = (async () => {
      try {
        await loadPyodideScript();
      } catch (err) {
        if (err instanceof PyodideUnavailableError) throw err;
        throw new PyodideUnavailableError("Failed to initialize Pyodide.");
      }
      if (!window.loadPyodide) {
        throw new PyodideUnavailableError("Pyodide loader not available after script load.");
      }
      return await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
      });
    })();
  }
  return await window.__algolens_pyodide;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

function escapePyString(s: string): string {
  return s.replace(/\\\\/g, "\\\\\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

export async function runPyodideTrace(code: string): Promise<PyodideRunOutput | PyodideRunError> {
  const pyodide = await getPyodide();

  const dsviz = await fetchText("/py/dsviz.py");
  const userCode = escapePyString(code);

  const wrapped = `
import sys
import types
import json
import traceback

_dsviz_src = r\"\"\"${escapePyString(dsviz)}\"\"\"
_mod = types.ModuleType("dsviz")
sys.modules["dsviz"] = _mod
exec(_dsviz_src, _mod.__dict__)

import dsviz
dsviz.reset_trace()

_user_src = r\"\"\"${userCode}\"\"\"
try:
    _trace_filename = "user_code.py"

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
