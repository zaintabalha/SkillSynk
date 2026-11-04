import SwiftUI

enum SkillSyncTheme {
    static let forest = Color(hex: 0x162E24)
    static let forestLight = Color(hex: 0x1F4A38)
    static let ivory = Color(hex: 0xF8F6F1)
    static let paper = Color.white
    static let terracotta = Color(hex: 0xC85A32)
    static let coral = Color(hex: 0xE07A5F)
    static let muted = Color(hex: 0x758078)
    static let line = Color(hex: 0xE6E2D9)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

struct BrandCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SkillSyncTheme.paper, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(SkillSyncTheme.line, lineWidth: 1))
            .shadow(color: SkillSyncTheme.forest.opacity(0.045), radius: 12, y: 5)
    }
}

struct Eyebrow: View {
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .tracking(1.6)
            .foregroundStyle(SkillSyncTheme.terracotta)
    }
}

struct StatusNotice: View {
    let text: String
    var isError = false

    var body: some View {
        Label(text, systemImage: isError ? "exclamationmark.circle.fill" : "info.circle")
            .font(.footnote)
            .foregroundStyle(isError ? SkillSyncTheme.terracotta : SkillSyncTheme.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(isError ? SkillSyncTheme.coral.opacity(0.10) : SkillSyncTheme.forest.opacity(0.055), in: RoundedRectangle(cornerRadius: 14))
    }
}
