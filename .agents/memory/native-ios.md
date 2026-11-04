---
name: Native iOS companion
description: Scope and delivery decisions for SkillSync's native SwiftUI iOS/iPadOS companion.
---

The native iOS/iPadOS client is intentionally kept in `ios-native/` and calls the existing SkillSync `/api` service using Clerk's native SDK. Push delivery uses direct APNs; do not introduce a third-party push provider unless the user asks.

**Why:** the user selected an isolated SwiftUI app and later allowed additive backend notification changes; the previously offered push integration was dismissed.

**How to apply:** keep native app implementation separate from web artifacts, use existing authenticated REST routes, and treat APNs credentials plus Apple signing/provisioning as required before claiming device push or installable IPA delivery works. An unsigned IPA is only a packaged app bundle and cannot be installed on a physical iOS device.

## Native CI and Swift 6

Treat the macOS runner’s Xcode version and installed iOS Simulator runtime as a matched pair. Select a concrete available simulator destination and build only its active architecture; generic simulator destinations and a separate architecture flag can conflict with Xcode’s destination selection. Under Swift 6, Objective-C notification delegate callbacks that are nonisolated should hop to `MainActor` before accessing UI state, and WebKit delegate callback signatures must match actor and sendability annotations exactly. Give `catch` bindings names distinct from view state such as `error`.

**Why:** simulator runtime availability and Swift 6 concurrency checks exposed non-obvious CI-only failures during native compilation.

**How to apply:** when native CI fails, inspect the complete Xcode diagnostics first; adjust the selected runtime/destination before treating compile errors as workflow configuration issues.
