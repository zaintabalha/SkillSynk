# SkillSync AI Android WebView wrapper

This native Android shell opens the public SkillSync AI website:

`https://skill-sync-ai--zeintabakha443t.replit.app/`

It is an online wrapper, not an offline copy of the website. It includes:

- Android WebView with JavaScript, DOM storage, cookies, and HTTPS-only navigation.
- A system file picker for website image/audio attachments.
- Runtime camera and microphone permissions limited to the `meet.jit.si` origin.
- Android back navigation and resize behavior for the soft keyboard.

## Build a sideloadable APK

Install JDK 17 or newer and Android SDK platform/build tools 35, then run:

```sh
./gradlew assembleDebug
```

The debug-signed APK is written to:

`app/build/outputs/apk/debug/app-debug.apk`

This debug APK can be sideloaded for testing. It is not a Play Store release. Android WebView does not reliably support Jitsi screen sharing, and Google/social OAuth may be restricted inside embedded WebViews; verify the configured sign-in methods on a device before distributing it broadly.
