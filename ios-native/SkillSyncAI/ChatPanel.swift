import AVFoundation
import ClerkKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct ChatPanel: View {
    @Environment(Clerk.self) private var clerk
    @Binding var room: LearningRoom
    let channel: String
    @State private var draft = ""
    @State private var replyTo: ChatMessage?
    @State private var isSending = false
    @State private var error: String?
    @State private var photoItem: PhotosPickerItem?
    @State private var isRecording = false
    @State private var recorder: AVAudioRecorder?
    @State private var recordingURL: URL?

    private var isAI: Bool { channel == "ai" }
    private var visibleMessages: [ChatMessage] {
        room.messages.filter { $0.channel == channel }.sorted { $0.createdAt < $1.createdAt }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text(isAI ? "SkillSync AI Chat" : "Partner Chat")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(SkillSyncTheme.forest)
                Text(isAI ? "Ask for a clear explanation, a hint, or a study prompt." : "Share questions, notes, images, and voice messages.")
                    .font(.footnote)
                    .foregroundStyle(SkillSyncTheme.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            Divider().overlay(SkillSyncTheme.line)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 14) {
                        if visibleMessages.isEmpty {
                            EmptyCard(
                                icon: isAI ? "sparkles" : "bubble.left.and.bubble.right",
                                title: isAI ? "Ask SkillSync AI" : "Start with a hello",
                                detail: isAI ? "Your AI conversation is shared in this room." : "Your partner and SkillSync AI can help you learn together."
                            )
                            .padding(.top, 20)
                        }
                        ForEach(visibleMessages) { message in
                            MessageBubble(message: message, roomId: room.roomId, isOwn: message.senderId == clerk.session?.user?.id)
                                .id(message.id)
                                .onTapGesture(count: 2) { replyTo = message }
                        }
                        if let error { StatusNotice(text: error, isError: true).id("error") }
                    }
                    .padding(16)
                    .frame(maxWidth: 780)
                    .frame(maxWidth: .infinity)
                }
                .onChange(of: visibleMessages.last?.id) { _, id in
                    if let id { withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(id, anchor: .bottom) } }
                }
            }

            if let replyTo {
                HStack(spacing: 8) {
                    Image(systemName: "arrowshape.turn.up.left").foregroundStyle(SkillSyncTheme.terracotta)
                    Text("Replying to \(replyTo.senderName): \(replyTo.content.isEmpty ? "attachment" : replyTo.content)")
                        .lineLimit(1)
                        .font(.caption)
                        .foregroundStyle(SkillSyncTheme.muted)
                    Spacer()
                    Button { self.replyTo = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(SkillSyncTheme.muted) }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(SkillSyncTheme.ivory)
            }

            composer
        }
        .background(SkillSyncTheme.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(SkillSyncTheme.line, lineWidth: 1))
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await sendPhoto(item) }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            HStack(alignment: .bottom, spacing: 9) {
                if isAI {
                    Text("@AI")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(SkillSyncTheme.forestLight)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 13)
                        .background(SkillSyncTheme.forestLight.opacity(0.09), in: RoundedRectangle(cornerRadius: 12))
                }
                TextField(isAI ? "Ask SkillSync AI…" : "Write to your partner…", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 11)
                    .background(SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 14))
                    .disabled(isSending)
                    .onSubmit { Task { await sendMessage() } }
                if !isAI {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Image(systemName: "photo.badge.plus")
                            .font(.system(size: 18))
                            .foregroundStyle(SkillSyncTheme.forestLight)
                            .frame(width: 36, height: 42)
                    }
                    Button { Task { await toggleRecording() } } label: {
                        Image(systemName: isRecording ? "stop.circle.fill" : "mic")
                            .font(.system(size: 18))
                            .foregroundStyle(isRecording ? SkillSyncTheme.terracotta : SkillSyncTheme.forestLight)
                            .frame(width: 30, height: 42)
                    }
                    .accessibilityLabel(isRecording ? "Stop voice recording" : "Record a voice note")
                }
                Button { Task { await sendMessage() } } label: {
                    if isSending { ProgressView().tint(.white) }
                    else { Image(systemName: "paperplane.fill").font(.system(size: 15, weight: .semibold)) }
                }
                .foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(SkillSyncTheme.forestLight, in: RoundedRectangle(cornerRadius: 13))
                .disabled(isSending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if isRecording {
                Text("Recording voice note — tap the microphone again to send.")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(SkillSyncTheme.terracotta)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .background(.white)
        .overlay(alignment: .top) { Rectangle().fill(SkillSyncTheme.line).frame(height: 1) }
    }

    @MainActor private func sendMessage() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        await send(content: content)
    }

    @MainActor private func send(content: String, mediaObjectPath: String? = nil, mediaName: String? = nil, duration: Int? = nil) async {
        guard !isSending else { return }
        isSending = true
        defer { isSending = false }
        do {
            let input = ChatMessageInput(
                content: content,
                replyToMessageId: replyTo?.id,
                mediaObjectPath: mediaObjectPath,
                mediaName: mediaName,
                mediaDurationSeconds: duration
            )
            let endpoint = "skillsync/rooms/\(room.roomId)/\(isAI ? "ai-messages" : "messages")"
            let result: ChatSendResult = try await SkillSyncAPI.shared.send(endpoint, method: "POST", body: input)
            room.messages.append(result.message)
            if let assistant = result.assistantMessage { room.messages.append(assistant) }
            room.messages.sort { $0.createdAt < $1.createdAt }
            draft = ""
            replyTo = nil
            error = nil
        } catch { error = error.localizedDescription }
    }

    @MainActor private func sendPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            error = "That photo could not be read. Choose another image."
            photoItem = nil
            return
        }
        let contentType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
        let allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]
        guard allowedTypes.contains(contentType), !data.isEmpty else {
            error = "This image format is not supported."
            photoItem = nil
            return
        }
        do {
            let filename = "learning-room-\(UUID().uuidString).\(item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg")"
            let upload: MediaUploadResponse = try await SkillSyncAPI.shared.send(
                "skillsync/rooms/\(room.roomId)/media/upload-url",
                method: "POST",
                body: MediaUploadRequest(fileName: filename, size: data.count, contentType: contentType)
            )
            try await SkillSyncAPI.shared.upload(to: upload.uploadUrl, data: data, contentType: contentType)
            await send(content: "", mediaObjectPath: upload.mediaObjectPath, mediaName: filename)
        } catch { error = error.localizedDescription }
        photoItem = nil
    }

    @MainActor private func toggleRecording() async {
        if isRecording {
            recorder?.stop()
            isRecording = false
            guard let recordingURL,
                  let data = try? Data(contentsOf: recordingURL),
                  !data.isEmpty else {
                error = "The voice recording could not be saved."
                return
            }
            do {
                let fileName = "voice-\(UUID().uuidString).m4a"
                let upload: MediaUploadResponse = try await SkillSyncAPI.shared.send(
                    "skillsync/rooms/\(room.roomId)/media/upload-url",
                    method: "POST",
                    body: MediaUploadRequest(fileName: fileName, size: data.count, contentType: "audio/mp4")
                )
                try await SkillSyncAPI.shared.upload(to: upload.uploadUrl, data: data, contentType: "audio/mp4")
                await send(content: "", mediaObjectPath: upload.mediaObjectPath, mediaName: fileName, duration: 60)
                try? FileManager.default.removeItem(at: recordingURL)
            } catch { error = error.localizedDescription }
            return
        }

        let granted = await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
        }
        guard granted else {
            error = "Allow microphone access in Settings to record a voice note."
            return
        }
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
            try audioSession.setActive(true)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("skillsync-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.record(forDuration: 60)
            recordingURL = url
            isRecording = true
            error = nil
        } catch { error = error.localizedDescription }
    }
}

private struct MessageBubble: View {
    let message: ChatMessage
    let roomId: String
    let isOwn: Bool

    var body: some View {
        HStack {
            if isOwn { Spacer(minLength: 35) }
            VStack(alignment: isOwn ? .trailing : .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(message.senderName).font(.caption.weight(.semibold)).foregroundStyle(SkillSyncTheme.forest)
                    if message.senderType == "assistant" {
                        Image(systemName: "sparkles").font(.caption2).foregroundStyle(SkillSyncTheme.terracotta)
                    }
                }
                if let reply = message.replyTo {
                    Text("\(reply.senderName): \(reply.contentSnippet)")
                        .font(.caption)
                        .foregroundStyle(SkillSyncTheme.muted)
                        .padding(8)
                        .background(SkillSyncTheme.terracotta.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                }
                if !message.content.isEmpty {
                    Text(message.content)
                        .font(.body)
                        .foregroundStyle(SkillSyncTheme.forest)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 10)
                        .background(isOwn ? Color(hex: 0xE6EEE4) : SkillSyncTheme.ivory, in: RoundedRectangle(cornerRadius: 16))
                }
                if let type = message.mediaType, let mediaUrl = message.mediaUrl {
                    MessageAttachment(
                        type: type,
                        roomId: roomId,
                        message: message,
                        path: mediaUrl,
                        name: message.mediaName
                    )
                }
                Text(message.createdAt.prefix(16))
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundStyle(SkillSyncTheme.muted)
            }
            if !isOwn { Spacer(minLength: 35) }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MessageAttachment: View {
    let type: String
    let roomId: String
    let message: ChatMessage
    let path: String
    let name: String?
    @State private var image: UIImage?
    @State private var audioPlayer: AVAudioPlayer?
    @State private var loading = false
    @State private var error: String?
    @State private var transcript: String?
    @State private var transcribing = false

    var body: some View {
        Group {
            if type == "image" {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 260, maxHeight: 260)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                } else if loading {
                    ProgressView().frame(width: 180, height: 90)
                } else {
                    StatusNotice(text: error ?? "Image unavailable", isError: true)
                        .frame(maxWidth: 240)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        Task { await playAudio() }
                    } label: {
                        Label(audioPlayer?.isPlaying == true ? "Playing voice note" : (name ?? "Play voice note"),
                              systemImage: audioPlayer?.isPlaying == true ? "pause.fill" : "play.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(SkillSyncTheme.forestLight)
                            .padding(12)
                            .background(SkillSyncTheme.forestLight.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }
                    if let transcript = transcript ?? message.transcript, !transcript.isEmpty {
                        Text(transcript).font(.footnote).foregroundStyle(SkillSyncTheme.forest)
                    } else {
                        Button {
                            Task { await transcribe() }
                        } label: {
                            if transcribing { ProgressView() }
                            else { Label("Transcribe voice note", systemImage: "waveform") }
                        }
                        .font(.caption.weight(.medium))
                        .buttonStyle(.borderless)
                    }
                    if let error { Text(error).font(.caption).foregroundStyle(SkillSyncTheme.terracotta) }
                }
            }
        }
        .task {
            if type == "image" { await loadImage() }
        }
    }

    @MainActor private func loadImage() async {
        guard image == nil, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let data = try await SkillSyncAPI.shared.authenticatedData(path: path)
            guard let decoded = UIImage(data: data) else { throw SkillSyncAPIError.invalidResponse }
            image = decoded
        } catch { error = error.localizedDescription }
    }

    @MainActor private func playAudio() async {
        if let audioPlayer, audioPlayer.isPlaying {
            audioPlayer.pause()
            return
        }
        do {
            let data = try await SkillSyncAPI.shared.authenticatedData(path: path)
            let player = try AVAudioPlayer(data: data)
            audioPlayer = player
            player.play()
        } catch { error = error.localizedDescription }
    }

    @MainActor private func transcribe() async {
        transcribing = true
        defer { transcribing = false }
        do {
            let response: VoiceTranscript = try await SkillSyncAPI.shared.send(
                "skillsync/rooms/\(roomId)/messages/\(message.id)/transcription",
                method: "POST",
                body: EmptyRequest()
            )
            transcript = response.transcript
            error = nil
        } catch { error = error.localizedDescription }
    }
}
