import SwiftUI
import WebKit

struct VideoRoomView: View {
    let roomId: String
    let roomTitle: String
    @State private var joinRoom = false

    private var meetingURL: URL {
        let safeId = roomId.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "", options: .regularExpression)
        return URL(string: "https://meet.jit.si/SkillSyncAI_\(safeId)")!
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Eyebrow(title: "Peer-to-peer video")
                Text("Study face to face").font(.title3.weight(.bold)).foregroundStyle(SkillSyncTheme.forest)
                Text(roomTitle).font(.caption).foregroundStyle(SkillSyncTheme.muted).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
            if joinRoom {
                JitsiWebView(url: meetingURL)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 10)
            } else {
                VStack(spacing: 14) {
                    Image(systemName: "video.badge.waveform")
                        .font(.system(size: 34))
                        .foregroundStyle(SkillSyncTheme.forestLight)
                        .padding(18)
                        .background(SkillSyncTheme.forestLight.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
                    Text("Start a live study room")
                        .font(.headline)
                        .foregroundStyle(SkillSyncTheme.forest)
                    Text("Jitsi Meet opens camera and microphone access only after you join. Avoid sharing private information in a public meeting.")
                        .font(.footnote)
                        .foregroundStyle(SkillSyncTheme.muted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 440)
                    Button { joinRoom = true } label: {
                        Label("Join video room", systemImage: "video.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 13)
                            .background(SkillSyncTheme.forestLight, in: Capsule())
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(24)
                .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 16))
                .padding(10)
            }
        }
        .background(SkillSyncTheme.paper)
    }
}

private struct JitsiWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            guard origin.host == "meet.jit.si" else {
                decisionHandler(.deny)
                return
            }
            decisionHandler(.grant)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  url.scheme == "https",
                  let host = url.host,
                  host == "meet.jit.si" || host.hasSuffix(".jit.si") else {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
