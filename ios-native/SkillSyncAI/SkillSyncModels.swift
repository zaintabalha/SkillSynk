import Foundation

struct ProfileEnvelope: Decodable {
    let profile: SkillProfile?
}

struct SkillProfile: Codable, Identifiable {
    var id: String { userId }
    let userId: String
    var displayName: String
    var university: String
    var teachSkill: String
    var learnSkill: String
    var bio: String
    var createdAt: String?
    var updatedAt: String?
}

struct ProfileInput: Encodable {
    let displayName: String
    let university: String
    let teachSkill: String
    let learnSkill: String
    let bio: String
}

struct DashboardStats: Decodable {
    let activeRooms: Int
    let connectionsMade: Int
    let projectsSubmitted: Int
}

struct Dashboard: Decodable {
    let profileComplete: Bool
    let aiEnabled: Bool
    let stats: DashboardStats
    let recommendations: [MatchCandidate]
    let rooms: [RoomSummary]
    let recentActivity: [ActivitySummary]
}

struct RecommendationResponse: Decodable {
    let recommendations: [MatchCandidate]
    let aiPowered: Bool
}

struct ActivitySummary: Decodable, Identifiable {
    let id: String
    let label: String
    let detail: String
    let createdAt: String
}

struct MatchCandidate: Decodable, Identifiable {
    var id: String { userId }
    let userId: String
    let displayName: String
    let university: String
    let teachSkill: String
    let learnSkill: String
    let bio: String
    let compatibilityScore: Int
    let whyMatch: String
}

struct RoomSummary: Decodable, Identifiable {
    var id: String { roomId }
    let roomId: String
    let partnerUserId: String
    let partnerName: String
    let projectTitle: String
    let status: String
    let progress: Int
    let lastMessage: String?
    let isDemo: Bool
    let updatedAt: String
}

struct PersonalLearningPath: Decodable {
    let title: String
    let goal: String
    let stages: [String]
}

struct LearningPaths: Decodable {
    let userA: PersonalLearningPath
    let userB: PersonalLearningPath
}

struct Curriculum: Decodable {
    let title: String
    let description: String
    let goal: String
    let stages: [String]
    let learningPaths: LearningPaths?
}

struct MessageReply: Decodable {
    let id: String
    let senderName: String
    let contentSnippet: String
    let mediaType: String?
}

struct ChatMessage: Decodable, Identifiable {
    let id: String
    let roomId: String
    let senderId: String?
    let senderName: String
    let senderType: String
    let channel: String
    let replyToMessageId: String?
    let replyTo: MessageReply?
    let activityId: String?
    let content: String
    let mediaType: String?
    let mediaUrl: String?
    let mediaName: String?
    let mediaSize: Int?
    let mediaDurationSeconds: Int?
    let transcript: String?
    let createdAt: String
}

struct ActivityAttempt: Decodable, Identifiable {
    let id: String
    let activityId: String
    let userId: String
    let displayName: String
    let responses: [String]
    let score: Int?
    let createdAt: String
}

indirect enum JSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value") }
    }

    var stringValue: String? {
        if case let .string(value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case let .object(value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case let .array(value) = self { return value }
        return nil
    }
}

struct SharedActivity: Decodable, Identifiable {
    let id: String
    let roomId: String
    let kind: String
    let title: String
    let instructions: String
    let content: JSONValue
    let isDemo: Bool
    let createdAt: String
    let attempts: [ActivityAttempt]

    var simulator: [String: JSONValue]? {
        content.objectValue?["simulator"]?.objectValue
    }

    var starterCode: String {
        simulator?["starterCode"]?.stringValue ?? "// Write your solution here\n"
    }
}

struct LearningRoom: Decodable, Identifiable {
    var id: String { roomId }
    let roomId: String
    let partnerUserId: String
    let partnerName: String
    let projectTitle: String
    let status: String
    let progress: Int
    let isDemo: Bool
    let curriculum: Curriculum
    var messages: [ChatMessage]
    var activities: [SharedActivity]
    let updatedAt: String
}

struct ChatMessageInput: Encodable {
    let content: String
    var replyToMessageId: String? = nil
    var simulatedUserId: String? = nil
    var mediaObjectPath: String? = nil
    var mediaName: String? = nil
    var mediaDurationSeconds: Int? = nil
}

struct ChatSendResult: Decodable {
    let message: ChatMessage
    let assistantMessage: ChatMessage?
    let aiPowered: Bool
}

struct ActivityInput: Encodable {
    let kind: String
    let prompt: String
}

struct SimulatorSolution: Decodable {
    let code: String
}

struct PushDeviceInput: Encodable {
    let token: String
    let environment: String
}

struct ConnectInput: Encodable {
    let partnerUserId: String
}

struct ActivityAttemptInput: Encodable {
    let responses: [String]
    var simulatedUserId: String? = nil
}

struct EmptyRequest: Encodable {}

struct MediaUploadRequest: Encodable {
    let fileName: String
    let size: Int
    let contentType: String
}

struct MediaUploadResponse: Decodable {
    let uploadUrl: URL
    let mediaObjectPath: String
}

struct ApiErrorResponse: Decodable {
    let error: String
}

struct VoiceTranscript: Decodable {
    let messageId: String
    let transcript: String
}
