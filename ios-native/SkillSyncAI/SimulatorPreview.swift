import SwiftUI
import WebKit

private struct SandboxLog: Identifiable {
    let id = UUID()
    let kind: String
    let text: String
}

struct SimulatorWorkspace: View {
    let roomId: String
    let activity: SharedActivity
    @State private var code: String
    @State private var logs: [SandboxLog] = []
    @State private var error: String?
    @State private var generating = false
    @State private var runRevision = 0

    init(roomId: String, activity: SharedActivity) {
        self.roomId = roomId
        self.activity = activity
        _code = State(initialValue: activity.starterCode)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 13) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(activity.title).font(.title3.weight(.bold)).foregroundStyle(SkillSyncTheme.forest)
                    Text(activity.instructions).font(.footnote).foregroundStyle(SkillSyncTheme.muted)
                }
                HStack {
                    Button {
                        Task { await generateSolution() }
                    } label: {
                        HStack {
                            if generating { ProgressView().tint(.white) }
                            else { Label("Generate solution with AI", systemImage: "sparkles") }
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 11)
                        .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(generating)
                    Spacer()
                    Button {
                        logs = []
                        error = nil
                        runRevision += 1
                    } label: {
                        Label("Run", systemImage: "play.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(SkillSyncTheme.forestLight)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 11)
                            .background(SkillSyncTheme.forestLight.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                if let error { StatusNotice(text: error, isError: true) }

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Circle().fill(SkillSyncTheme.coral).frame(width: 8, height: 8)
                        Circle().fill(Color(hex: 0xE5BC72)).frame(width: 8, height: 8)
                        Circle().fill(Color(hex: 0x6DA77C)).frame(width: 8, height: 8)
                        Text("solution.js").font(.caption.monospaced()).foregroundStyle(Color.white.opacity(0.68))
                        Spacer()
                        Text("\(code.count) chars").font(.system(size: 9, design: .monospaced)).foregroundStyle(Color.white.opacity(0.45))
                    }
                    .padding(.horizontal, 13)
                    .padding(.vertical, 11)
                    .background(Color(hex: 0x162E24))
                    TextEditor(text: $code)
                        .font(.system(size: 13, weight: .regular, design: .monospaced))
                        .foregroundStyle(Color(hex: 0xE8EEE8))
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .frame(minHeight: 250, idealHeight: 300)
                        .background(Color(hex: 0x1D352A))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .background(Color(hex: 0x1D352A), in: RoundedRectangle(cornerRadius: 16))
                .clipShape(RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Label("Live preview", systemImage: "rectangle.on.rectangle")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("Sandboxed · network disabled")
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(Color.white.opacity(0.55))
                    }
                    .padding(12)
                    SimulatorWebPreview(code: code, runRevision: runRevision, logs: $logs)
                        .frame(minHeight: 310, idealHeight: 360)
                        .background(.white)
                    if !logs.isEmpty {
                        Divider().overlay(Color.white.opacity(0.12))
                        VStack(alignment: .leading, spacing: 7) {
                            ForEach(logs) { entry in
                                HStack(alignment: .top, spacing: 8) {
                                    Text(entry.kind.uppercased())
                                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                                        .foregroundStyle(entry.kind == "error" ? SkillSyncTheme.coral : Color(hex: 0x99C7A5))
                                        .frame(width: 42, alignment: .leading)
                                    Text(entry.text)
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundStyle(Color.white.opacity(0.86))
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(12)
                    }
                }
                .background(Color(hex: 0x162E24), in: RoundedRectangle(cornerRadius: 16))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(14)
            .frame(maxWidth: 920)
            .frame(maxWidth: .infinity)
        }
        .background(SkillSyncTheme.ivory)
    }

    @MainActor private func generateSolution() async {
        generating = true
        defer { generating = false }
        do {
            let solution: SimulatorSolution = try await SkillSyncAPI.shared.send(
                "skillsync/rooms/\(roomId)/activities/\(activity.id)/solution",
                method: "POST",
                body: EmptyRequest()
            )
            code = solution.code
            logs = []
            error = nil
        } catch { error = error.localizedDescription }
    }
}

private struct SimulatorWebPreview: UIViewRepresentable {
    let code: String
    let runRevision: Int
    @Binding var logs: [SandboxLog]

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "skillsync")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .white
        view.scrollView.isScrollEnabled = true
        context.coordinator.load(code, into: view, revision: runRevision)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.load(code, into: uiView, revision: runRevision)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: SimulatorWebPreview
        private var lastRevision = -1

        init(parent: SimulatorWebPreview) { self.parent = parent }

        func load(_ code: String, into webView: WKWebView, revision: Int) {
            guard revision > 0, revision != lastRevision else { return }
            lastRevision = revision
            webView.loadHTMLString(makeDocument(code), baseURL: URL(string: "https://skillsync.local"))
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let value = message.body as? [String: String],
                  let kind = value["kind"],
                  let text = value["text"] else { return }
            DispatchQueue.main.async { self.parent.logs.append(SandboxLog(kind: kind, text: text)) }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.host == "skillsync.local" || url.scheme == "about" {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
        }

        private func makeDocument(_ source: String) -> String {
            let csp = """
            default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; media-src data: blob:;
            """
            let bridge = """
            <script>
            (() => {
              const post = (kind, args) => {
                let text;
                try { text = args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '); }
                catch (_) { text = args.map(String).join(' '); }
                window.webkit.messageHandlers.skillsync.postMessage({kind, text});
              };
              const safeConsole = {
                log: (...args) => post('log', args),
                info: (...args) => post('log', args),
                warn: (...args) => post('warn', args),
                error: (...args) => post('error', args)
              };
              window.console = safeConsole;
              window.fetch = () => Promise.reject(new Error('Network access is disabled in this preview.'));
              window.XMLHttpRequest = undefined;
              window.WebSocket = undefined;
              window.EventSource = undefined;
              window.open = () => null;
              window.addEventListener('error', event => post('error', [event.message || 'Script error']));
            })();
            </script>
            """
            let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.lowercased().hasPrefix("<!doctype") || trimmed.lowercased().hasPrefix("<html") {
                var html = source
                let secureHead = "<meta http-equiv=\"Content-Security-Policy\" content=\"\(csp)\">\(bridge)"
                if let headStart = html.range(of: "<head", options: .caseInsensitive),
                   let headEnd = html[headStart.lowerBound...].firstIndex(of: ">") {
                    html.insert(contentsOf: secureHead, at: html.index(after: headEnd))
                    return html
                }
                if let htmlStart = html.range(of: "<html", options: .caseInsensitive),
                   let htmlEnd = html[htmlStart.lowerBound...].firstIndex(of: ">") {
                    html.insert(contentsOf: "<head>\(secureHead)</head>", at: html.index(after: htmlEnd))
                    return html
                }
                return "<!doctype html><html><head>\(secureHead)</head><body>\(html)</body></html>"
            }
            let encoded = Data(source.utf8).base64EncodedString()
            return """
            <!doctype html><html><head>
            <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
            <meta http-equiv="Content-Security-Policy" content="\(csp)">
            <style>
            *{box-sizing:border-box}body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#162e24;background:#f8f6f1}
            #app{min-height:260px}.skillsync-hint{font-size:12px;color:#758078}
            </style>\(bridge)
            </head><body><main id="app"><p class="skillsync-hint">Run your code to see the app or game preview.</p></main>
            <script>
            (() => {
              try {
                const code = atob("\(encoded)");
                const result = new Function("console", code)(window.console);
                if (result && typeof result.then === "function") {
                  result.then(value => { if (value !== undefined) window.webkit.messageHandlers.skillsync.postMessage({kind:"return",text:JSON.stringify(value)}); })
                        .catch(error => window.webkit.messageHandlers.skillsync.postMessage({kind:"error",text:String(error)}));
                } else if (result !== undefined) {
                  window.webkit.messageHandlers.skillsync.postMessage({kind:"return",text:JSON.stringify(result)});
                }
              } catch (error) {
                window.webkit.messageHandlers.skillsync.postMessage({kind:"error",text:error && error.stack ? error.stack : String(error)});
              }
            })();
            </script></body></html>
            """
        }
    }
}
