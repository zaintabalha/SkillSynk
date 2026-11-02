export type SimulatorConsoleEntry = { level: string; text: string };
export type SimulatorRunResult = {
  ok: boolean;
  logs: SimulatorConsoleEntry[];
  value?: string;
  previewHtml?: string;
  sourceOutputOmitted?: boolean;
  error?: string;
  timedOut?: boolean;
};

const EXECUTION_LIMIT_MS = 2_000;
const MAX_SOURCE_LENGTH = 4_000;

const workerSource = `
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker", "SharedWorker", "BroadcastChannel"]) {
  try { Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false }); } catch {}
}
const MAX_LOGS = 40;
const MAX_ENTRY = 1200;
function format(value) {
  if (typeof value === "string") return value.slice(0, MAX_ENTRY);
  if (typeof value === "undefined") return "undefined";
  if (value instanceof Error) return value.name + ": " + value.message;
  try { return (JSON.stringify(value) ?? String(value)).slice(0, MAX_ENTRY); }
  catch { return String(value).slice(0, MAX_ENTRY); }
}
function isSourceLike(text, source) {
  const trimmed = text.trim();
  return trimmed === source.trim() ||
    /(?:\\b(?:const|let|var|function|class|import|export|return)\\s+[\\w$({]|=>|\\bconsole\\.(?:log|info|warn|error)\\s*\\(|^[\\w$.[\\]]+\\s*(?:=|\\+\\+|--)|^\\s*<\\/?[a-z][\\w-]*(?:\\s|>|\\/))/imu.test(trimmed);
}
function isHtml(text) {
  return /^\\s*(?:<!doctype\\s+html|<html\\b|<(?:main|section|div|article|button|form|input|label|select|textarea|ul|ol|table|h[1-6]|p|span|header|footer|nav|a|img|svg|details|summary)\\b)/iu.test(text);
}
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== "run" || typeof message.code !== "string") return;
  const logs = [];
  let sourceOutputOmitted = false;
  const write = (level, values) => {
    const text = values.map(format).join(" ").slice(0, MAX_ENTRY);
    if (isSourceLike(text, message.code)) { sourceOutputOmitted = true; return; }
    if (logs.length < MAX_LOGS) logs.push({ level, text });
  };
  const safeConsole = {
    log: (...values) => write("log", values),
    info: (...values) => write("info", values),
    warn: (...values) => write("warn", values),
    error: (...values) => write("error", values),
    debug: (...values) => write("debug", values),
    table: (value) => write("log", [value]),
    clear: () => { logs.length = 0; },
  };
  try {
    const execute = new Function("console", '"use strict"; return (async () => {\\n' + message.code + '\\n})()');
    const result = await execute(safeConsole);
    const previewHtml = typeof result === "string"
      ? (isHtml(result) ? result.slice(0, 10000) : undefined)
      : result && typeof result === "object" && typeof result.html === "string" && isHtml(result.html)
        ? result.html.slice(0, 10000)
        : undefined;
    const formattedResult = typeof result === "undefined" || typeof previewHtml === "string" ? undefined : format(result);
    const value = typeof formattedResult === "string" && isSourceLike(formattedResult, message.code)
      ? undefined
      : formattedResult;
    if (formattedResult !== undefined && value === undefined) sourceOutputOmitted = true;
    self.postMessage({
      runId: message.runId,
      ok: true,
      logs,
      ...(typeof previewHtml === "string" ? { previewHtml } : {}),
      ...(typeof value === "string" ? { value } : {}),
      ...(sourceOutputOmitted ? { sourceOutputOmitted: true } : {}),
    });
  } catch (error) {
    self.postMessage({
      runId: message.runId,
      ok: false,
      logs,
      error: error instanceof Error ? error.name + ": " + error.message : String(error),
    });
  }
};
`;

function createSandboxDocument(): string {
  const csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const safeWorkerSource = JSON.stringify(workerSource).replace(/</gu, "\\u003c");
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><script>
    const workerSource = ${safeWorkerSource};
    let activeWorker = null;
    let activeUrl = null;
    window.addEventListener("message", (event) => {
      if (event.source !== parent) return;
      const message = event.data;
      if (!message || message.type !== "run" || typeof message.runId !== "string") return;
      activeWorker?.terminate();
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      try {
        activeUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
        activeWorker = new Worker(activeUrl);
        activeWorker.onmessage = (workerEvent) => {
          if (workerEvent.data?.runId !== message.runId) return;
          parent.postMessage({ type: "simulator-result", runId: message.runId, result: workerEvent.data }, "*");
          activeWorker?.terminate();
        };
        activeWorker.onerror = (error) => {
          parent.postMessage({ type: "simulator-result", runId: message.runId, result: { ok: false, logs: [], error: error.message || "Sandbox worker failed." } }, "*");
          activeWorker?.terminate();
        };
        activeWorker.postMessage({ type: "run", runId: message.runId, code: message.code });
      } catch (error) {
        parent.postMessage({ type: "simulator-result", runId: message.runId, result: { ok: false, logs: [], error: error instanceof Error ? error.message : String(error) } }, "*");
      }
    });
  </script>`;
}

export function runJavaScriptInSandbox(code: string): Promise<SimulatorRunResult> {
  const source = code.trim();
  if (!source) return Promise.resolve({ ok: false, logs: [], error: "Add JavaScript code before running it." });
  if (source.length > MAX_SOURCE_LENGTH) return Promise.resolve({ ok: false, logs: [], error: "Code exceeds the 4,000 character limit." });

  return new Promise((resolve) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "Isolated JavaScript runner";
    frame.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    frame.srcdoc = createSandboxDocument();

    let finished = false;
    let timeoutId = 0;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      frame.remove();
    };
    const finish = (result: SimulatorRunResult) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== "simulator-result" || message.runId !== runId) return;
      const result = message.result;
      if (!result || typeof result.ok !== "boolean" || !Array.isArray(result.logs)) {
        finish({ ok: false, logs: [], error: "The sandbox returned an invalid result." });
        return;
      }
      finish({
        ok: result.ok,
        logs: result.logs.filter((entry: unknown): entry is SimulatorConsoleEntry =>
          Boolean(entry && typeof entry === "object" && "level" in entry && "text" in entry &&
            typeof entry.level === "string" && typeof entry.text === "string"),
        ).slice(0, 40),
        ...(typeof result.value === "string" ? { value: result.value.slice(0, 4000) } : {}),
        ...(typeof result.previewHtml === "string" ? { previewHtml: result.previewHtml.slice(0, 10000) } : {}),
        ...(result.sourceOutputOmitted === true ? { sourceOutputOmitted: true } : {}),
        ...(typeof result.error === "string" ? { error: result.error.slice(0, 1000) } : {}),
      });
    };

    window.addEventListener("message", onMessage);
    timeoutId = window.setTimeout(() => {
      finish({ ok: false, logs: [], error: "Execution exceeded the time limit.", timedOut: true });
    }, EXECUTION_LIMIT_MS);
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage({ type: "run", runId, code: source }, "*");
    }, { once: true });
    document.body.appendChild(frame);
  });
}

export function createSimulatorPreviewDocument(markup: string): string {
  const doc = new DOMParser().parseFromString(markup.slice(0, 10_000), "text/html");
  doc.querySelectorAll("script, iframe, frame, object, embed, link, base, meta[http-equiv='refresh']").forEach((node) => node.remove());
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      } else if (["src", "srcset", "href", "action", "formaction", "poster", "xlink:href"].includes(name) &&
        !(value.startsWith("#") || value.startsWith("data:image/"))) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const csp = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>body{margin:0;padding:16px;font:14px system-ui,sans-serif;color:#24372d;background:#fff}*{box-sizing:border-box}</style></head><body>${doc.body.innerHTML}</body></html>`;
}
