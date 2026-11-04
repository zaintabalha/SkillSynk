---
name: Native iOS companion
description: Scope and delivery decisions for SkillSync's native SwiftUI iOS/iPadOS companion.
---

The native iOS/iPadOS client is intentionally kept in `ios-native/` and calls the existing SkillSync `/api` service using Clerk's native SDK. Push delivery uses direct APNs; do not introduce a third-party push provider unless the user asks.

**Why:** the user selected an isolated SwiftUI app and later allowed additive backend notification changes; the previously offered push integration was dismissed.

**How to apply:** keep native app implementation separate from web artifacts, use existing authenticated REST routes, and treat APNs credentials plus Apple signing as required before claiming device push or IPA delivery works.
