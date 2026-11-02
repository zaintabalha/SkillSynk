export type SimulatorConsoleEntry = { level: string; text: string };

export type SimulatorSandboxEvent = {
  channel: string;
  runId: number;
  type: string;
  level?: string;
  text?: string;
  value?: string;
  error?: string;
};

export const SIMULATOR_SANDBOX_CHANNEL = 'skillsync-live-sandbox';
export const SIMULATOR_MAX_LOG_ENTRIES = 100;
export const SIMULATOR_MAX_LOG_CHARS = 2000;
export const SIMULATOR_MAX_CODE_CHARS = 12000;
export const SIMULATOR_BOOT_TIMEOUT_MS = 5000;
export const SIMULATOR_SETUP_TIMEOUT_MS = 5000;
export const SIMULATOR_SESSION_TIMEOUT_MS = 120_000;

export function createSimulatorSandboxDocument(): string {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "navigate-to 'none'",
    "manifest-src 'none'",
  ].join('; ');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    html, body { width: 100%; min-height: 100%; margin: 0; }
    body { overflow: auto; background: #fff; color: #18271f; font: 14px system-ui, sans-serif; }
    #sim-root { min-height: 100%; }
  </style>
  <script>
  (() => {
    const CHANNEL = "${SIMULATOR_SANDBOX_CHANNEL}";
    const MAX_LOGS = ${SIMULATOR_MAX_LOG_ENTRIES};
    const MAX_ENTRY = ${SIMULATOR_MAX_LOG_CHARS};
    const MAX_VALUE = ${SIMULATOR_MAX_CODE_CHARS};
    const HTML_PATTERN = /^\\s*(?:<!doctype\\s+html|<html\\b|<(?:head|body|main|section|div|article|button|form|input|label|select|textarea|ul|ol|table|h[1-6]|p|span|header|footer|nav|a|img|svg|details|summary|canvas|style|script)\\b)/i;
    let runId = null;
    let sourceCode = "";
    let logCount = 0;
    let logsTruncated = false;
    let sourceOutputOmitted = false;
    let blockedNoticeSent = false;
    let uiNoticeSent = false;
    let truncationNoticeSent = false;
    const reportedErrors = new Set();

    const send = (type, extra = {}) => {
      if (runId === null) return;
      parent.postMessage({ channel: CHANNEL, runId, type, ...extra }, "*");
    };
    const markLogsTruncated = () => {
      logsTruncated = true;
      if (!truncationNoticeSent) {
        truncationNoticeSent = true;
        send("logs-truncated");
      }
    };
    const format = (value, limit = MAX_ENTRY, countTowardLogLimit = true) => {
      let text;
      if (typeof value === "string") text = value;
      else if (typeof value === "undefined") text = "undefined";
      else if (value instanceof Error) text = value.name + ": " + value.message;
      else {
        try { text = JSON.stringify(value) ?? String(value); }
        catch { text = String(value); }
      }
      if (text.length > limit) {
        if (countTowardLogLimit) markLogsTruncated();
        return text.slice(0, Math.max(0, limit - 1)) + "…";
      }
      return text;
    };
    const isSourceLike = (text) => {
      const trimmed = text.trim();
      return trimmed === sourceCode.trim() ||
        (/\\b(?:const|let|var|function|class|import|export|return)\\b/.test(trimmed) && /[{};=]/.test(trimmed)) ||
        /<\\/?[a-z][\\w-]*(?:\\s|>|\\/)/i.test(trimmed);
    };
    const writeLog = (level, values) => {
      const text = values.map((value) => format(value)).join(" ");
      if (isSourceLike(text)) {
        if (!sourceOutputOmitted) {
          sourceOutputOmitted = true;
          send("source-hidden");
        }
        return;
      }
      if (logCount >= MAX_LOGS) {
        markLogsTruncated();
        return;
      }
      logCount += 1;
      send("log", { level, text: text.slice(0, MAX_ENTRY) });
    };
    const safeConsole = {
      log: (...values) => writeLog("log", values),
      info: (...values) => writeLog("info", values),
      warn: (...values) => writeLog("warn", values),
      error: (...values) => writeLog("error", values),
      debug: (...values) => writeLog("debug", values),
      table: (value) => writeLog("log", [value]),
      assert: (condition, ...values) => { if (!condition) writeLog("error", values.length ? values : ["Assertion failed"]); },
      clear: () => {
        logCount = 0;
        logsTruncated = false;
        truncationNoticeSent = false;
        sourceOutputOmitted = false;
        send("clear-logs");
      },
    };
    try { Object.defineProperty(window, "console", { value: safeConsole, configurable: false }); }
    catch { window.console = safeConsole; }

    const warnBlocked = () => {
      if (blockedNoticeSent) return;
      blockedNoticeSent = true;
      send("warning", { text: "External network access and remote resources are disabled in this preview." });
    };
    const blockedFetch = () => {
      warnBlocked();
      return Promise.reject(new Error("Network access is disabled in this preview."));
    };
    try { Object.defineProperty(window, "fetch", { value: blockedFetch, configurable: false }); } catch {}
    const blockedConstructor = (name) => class {
      constructor() {
        warnBlocked();
        throw new Error(name + " is disabled in this preview.");
      }
    };
    for (const name of [
      "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
      "BroadcastChannel", "RTCPeerConnection", "webkitRTCPeerConnection", "WebTransport",
    ]) {
      try { Object.defineProperty(window, name, { value: blockedConstructor(name), configurable: false }); } catch {}
    }
    try {
      if (navigator.sendBeacon) Object.defineProperty(navigator, "sendBeacon", { value: () => { warnBlocked(); return false; } });
    } catch {}
    try {
      if (navigator.mediaDevices) {
        for (const name of ["getUserMedia", "enumerateDevices"]) {
          Object.defineProperty(navigator.mediaDevices, name, {
            value: () => { warnBlocked(); return Promise.reject(new Error("Device access is disabled in this preview.")); },
          });
        }
      }
    } catch {}
    try { Object.defineProperty(window, "open", { value: () => { warnBlocked(); return null; }, configurable: false }); } catch {}
    document.addEventListener("submit", (event) => { event.preventDefault(); warnBlocked(); }, true);
    document.addEventListener("click", (event) => {
      const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (anchor && !String(anchor.getAttribute("href") || "").startsWith("#")) {
        event.preventDefault();
        warnBlocked();
      }
    }, true);
    window.addEventListener("securitypolicyviolation", warnBlocked);

    const reportUi = () => {
      if (uiNoticeSent) return;
      const root = document.getElementById("sim-root");
      const hasRootContent = Boolean(root && root.childNodes.length > 0);
      const hasBodyContent = Boolean(document.body && Array.from(document.body.childNodes).some((node) =>
        node !== root && (node.nodeType === 1 || Boolean(node.textContent && node.textContent.trim()))
      ));
      const hasContent = hasRootContent || hasBodyContent;
      if (hasContent) {
        uiNoticeSent = true;
        send("ui");
      }
    };
    const observer = new MutationObserver((records) => {
      const styleChanged = records.some((record) =>
        record.type === "attributes" && ["style", "class"].includes(record.attributeName || "")
      ) || document.head.querySelectorAll("style").length > 1;
      if (styleChanged && !uiNoticeSent) {
        uiNoticeSent = true;
        send("ui");
      }
      reportUi();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    const reportError = (error) => {
      const text = format(error instanceof Error ? error.name + ": " + error.message : error, 1000);
      if (reportedErrors.has(text)) return;
      reportedErrors.add(text);
      window.setTimeout(() => reportedErrors.delete(text), 1500);
      send("error", { error: text });
    };
    window.addEventListener("error", (event) => {
      if (event.message) reportError(event.message);
    });
    window.addEventListener("unhandledrejection", (event) => reportError(event.reason));

    const isHtml = (text) => HTML_PATTERN.test(text);
    const getRoot = () => document.getElementById("sim-root") || document.body;
    let startupEventsDispatched = false;
    const dispatchStartupEvents = () => {
      if (startupEventsDispatched) return;
      startupEventsDispatched = true;
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
      window.dispatchEvent(new Event("load"));
    };
    const executeScript = async (text) => {
      const code = new Function(
        "console", "document", "window", "root",
        '"use strict"; return (async () => {\\n' + text + "\\n})()"
      );
      return await code.call(window, safeConsole, document, window, getRoot());
    };
    const renderMarkup = async (markup) => {
      const parsed = new DOMParser().parseFromString(markup.slice(0, MAX_VALUE), "text/html");
      const scripts = Array.from(parsed.querySelectorAll("script"));
      const inlineScripts = [];
      for (const script of scripts) {
        const src = script.getAttribute("src");
        const type = (script.getAttribute("type") || "").split(";")[0].trim().toLowerCase();
        if (src) {
          warnBlocked();
        } else if (!type || ["text/javascript", "application/javascript"].includes(type)) {
          if (script.textContent) inlineScripts.push(script.textContent);
        } else {
          send("warning", { text: "External and module scripts are disabled; inline classic scripts are supported." });
        }
        script.remove();
      }
      for (const node of Array.from(parsed.head.querySelectorAll("style"))) {
        const style = document.createElement("style");
        style.textContent = node.textContent || "";
        document.head.appendChild(style);
      }
      parsed.querySelectorAll("link, base, iframe, frame, object, embed, meta[http-equiv='refresh']").forEach((node) => node.remove());
      document.title = parsed.querySelector("title")?.textContent || document.title;
      if (parsed.documentElement.lang) document.documentElement.lang = parsed.documentElement.lang;
      if (parsed.body.className) document.body.className = parsed.body.className;
      if (parsed.body.getAttribute("style")) document.body.setAttribute("style", parsed.body.getAttribute("style"));
      let root = document.getElementById("sim-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "sim-root";
        document.body.replaceChildren(root);
      } else {
        Array.from(document.body.childNodes).filter((node) => node !== root).forEach((node) => node.remove());
      }
      root.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
      reportUi();
      for (const script of inlineScripts) await executeScript(script);
      dispatchStartupEvents();
    };
    const showResult = async (result) => {
      if (result && typeof result === "object" && typeof result.html === "string" && isHtml(result.html)) {
        await renderMarkup(result.html);
        return;
      }
      if (typeof result === "string" && isHtml(result)) {
        await renderMarkup(result);
        return;
      }
      if (result && typeof result === "object" && typeof result.nodeType === "number") {
        getRoot().appendChild(result);
        reportUi();
        return;
      }
      if (typeof result === "undefined") return;
      const value = format(result, MAX_VALUE, false);
      if (isSourceLike(value)) {
        sourceOutputOmitted = true;
        send("source-hidden");
      } else {
        send("value", { value });
      }
    };

    window.addEventListener("message", async (event) => {
      if (event.source !== parent) return;
      const message = event.data;
      if (!message || message.channel !== CHANNEL || message.type !== "run" || typeof message.runId !== "number" || runId !== null) return;
      runId = message.runId;
      sourceCode = typeof message.code === "string" ? message.code.slice(0, MAX_VALUE) : "";
      send("started");
      try {
        if (isHtml(sourceCode)) {
          await renderMarkup(sourceCode);
        } else {
          const result = await executeScript(sourceCode);
          dispatchStartupEvents();
          await showResult(result);
        }
        send("complete");
      } catch (error) {
        reportError(error);
      }
    });
  })();
  </script>
</head>
<body><div id="sim-root"></div></body>
</html>`;
}

export function isSimulatorSandboxEvent(value: unknown): value is SimulatorSandboxEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<SimulatorSandboxEvent>;
  return event.channel === SIMULATOR_SANDBOX_CHANNEL &&
    typeof event.runId === 'number' &&
    typeof event.type === 'string';
}
