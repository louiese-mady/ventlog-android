# Ventlog Free — Android v1.3 home-screen widget

This replaces the earlier manually assembled APK. This repository contains **native Android Java source** and the complete static Ventlog UI. It builds using the official Android Gradle plugin.

## Build a debug APK — no paid API

### Option A — GitHub Actions (no Android Studio needed)
1. Create a **private** GitHub repository and add all files from this project **at the repository root**.
2. Under **Actions**, run **Build Android APK** (or push to main/master).
3. After the workflow succeeds, download its **ventlog-free-android-apk** artifact, unzip it, and transfer `app-debug.apk` to your phone.
4. Uninstall the previous broken `Ventlog Free` before installing this one because they use different signing certificates. Any data saved by the old app would be lost; export a backup first if it can be opened.

### Option B — Android Studio
Open this folder in Android Studio. Set up SDK 35 and JDK 17, sync Gradle, then select **Build > Build APK(s)**. The APK is at `app/build/outputs/apk/debug/app-debug.apk`.

## What works
- Offline journal and trends dashboard saved in the Android WebView's local browser storage.
- Android speech recognition via `RecognizerIntent`, when a voice recognition app/service is available.
- Share to another app/Notes, file saving through Android's document picker, and receiving selected shared text from an app.
- ChatGPT handoff through your device's browser; user manually pastes the prompt and reply. No OpenAI API calls and no scraping.

## Privacy
- No app account, API key, analytics tracker, network permission, or database server.
- Entries are unencrypted in the app's WebView storage. **Uninstalling the app or clearing its data deletes the journal.** Export backups.
- Speech recognition may use an online service chosen by Android; ChatGPT receives only the text you choose to send.

## Status
- This is **source code, not a precompiled APK**. It has not been built with the Android SDK or tested on a real Android device in the current environment. Use the included official Gradle build workflow, then verify the installed APK on a phone. This project is not published to Play Store.
- The GitHub Actions APK is debug-signed, so do not publish it to the Play Store as a release build. It is intended for personal sideloading.

## Android home-screen widget (v1.3)
Long-press an empty spot on the home screen → Widgets → Ventlog Free → Ventlog · Quick Rant → Add. Tap the microphone/card to open the composer and launch speech recognition; tap TYPE for the keyboard. Android voice recognition provides an editable transcript; raw audio is not recorded or stored. This does not run in the background.

**Before replacing the previous APK:** back up your journal in Ventlog (Your data → Export complete journal). GitHub Actions debug-signs each APK with an ephemeral key, so Android may reject an in-place update. If that happens, only uninstall after exporting a backup, then install the new APK and import the journal backup.
