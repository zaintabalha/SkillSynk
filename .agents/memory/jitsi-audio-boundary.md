---
name: Jitsi audio boundary
description: Browser-side audio capture limitations for an embedded cross-origin Jitsi meeting.
---

The browser cannot read a remote participant's media stream from the cross-origin Jitsi iframe. A `getUserMedia`/`MediaRecorder` fallback captures the local device microphone only; it cannot reliably transcribe both sides when participants use headphones.

**Why:** Same-origin security isolates the embedded meeting's media from the parent application.

**How to apply:** For reliable two-speaker transcripts, use a supported Jitsi integration or a consented server-side media bot/bridge. Be explicit that browser microphone transcription does not guarantee remote-speaker capture.
