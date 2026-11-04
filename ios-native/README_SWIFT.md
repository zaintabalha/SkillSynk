# SkillSync AI — Native iOS/iPadOS app

This is an isolated SwiftUI application. Its source, Xcode project, permissions, and configuration are contained in `ios-native/`; it does not replace the web app or its existing Android wrapper.

## Included

- Clerk native sign-in and authenticated REST calls to the existing SkillSync API.
- Dashboard, profile editing, complementary-skill matching, and learning-room navigation.
- Partner chat, shared SkillSync AI chat, image/voice-note attachments, quizzes, flashcards, and simulator code generation.
- A local, 15-minute role-switch timer; Jitsi Meet video inside a WKWebView.
- APNs device registration and server-side alert delivery for partner messages, AI replies, activities, simulator solutions, and voice-note transcription.
- A small background app-refresh task. iOS decides when it runs; it is not a guaranteed real-time transport.

## Configure and run in Xcode

1. Open `ios-native/SkillSyncAI.xcodeproj` in Xcode 26 or newer. The Clerk iOS SDK currently requires iOS 17 or newer.
2. In `Configuration/SkillSync.xcconfig`, replace the Clerk publishable-key placeholder with the app's Replit-managed Clerk publishable key. The API URL is already set to the production SkillSync API; change it only when intentionally targeting another environment.
3. Select the `SkillSyncAI` target, set your Apple Developer team, and keep bundle ID `ai.skillsync.native` unless you also update the APNs topic in the API server.
4. Resolve the Clerk Swift Package dependency, select an iPhone or iPad simulator, and build/run. Add the Push Notifications and Background Modes capabilities to the target for a signed device build.
5. To make an IPA, choose **Product → Archive → Distribute App**. Ad Hoc, TestFlight, and App Store distribution each require the appropriate Apple signing profile.

## Enable APNs delivery

The app can request permission and register an APNs token without server credentials, but remote alerts will not be sent until an Apple APNs authentication key is configured in Replit Secrets:

- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY` (the `.p8` file contents; add through the Secrets UI, never commit it)

The APNs key must belong to the Apple Developer team signing this app. Xcode uses the `development` APNs environment for Debug and `production` for Release. APNs topic is `ai.skillsync.native`.

The API adds an authenticated device-registration endpoint and a small device-token table. Apply the development schema with `pnpm --filter @workspace/db run push`; deploy the API-server changes before installing a production build. Push send failures are logged and do not block chat or AI requests.

## Permission declarations

`Info.plist` includes camera, microphone, photo-library, remote-notification, background-fetch, and background-processing declarations. The app asks for notification permission on the Learning Rooms screen, requests camera/microphone through Jitsi when joining a call, and uses the iOS photo picker for images.

## Validation limitations

This workspace runs Linux and has no Xcode, Apple SDKs, or Swift compiler. The project files can be reviewed here, but an iOS build, simulator run, device permission test, code signing, and IPA export must be completed on a Mac with Xcode. APNs delivery also requires the Apple credentials above and a deployed API server.

## GitHub Actions build check

The repository workflow at `.github/workflows/ios-native.yml` resolves the Clerk package, runs Xcode static analysis, and builds the app for the iOS Simulator on a macOS runner. It validates compilation but does not replace simulator/device tests, Apple signing, or push-delivery testing.
