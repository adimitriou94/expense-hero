# CAPVO -- PWA → Native Mobile App Guide

> Ημερομηνία: 2026-06-23
> Current: PWA on GitHub Pages
> Target: Installable native app (Android + iOS)

---

## Rekomended Approach: Capacitor (Ionic)

**Γιατί Capacitor:**
- Το existing code σου (index.html + JS + CSS) δουλεύει 100% without changes
- Zero frontend refactoring — απλά wrapping σε native container
- 1-2 μέρες setup, μετά add native features one by one
- Android + iOS + Web από ίδιο codebase

**Εναλλακτικές (γιατί όχι):**
- **Pure WebView** — δεν supportάρει push notifications, biometrics, camera. Apple το rejectάρει.
- **React Native / Flutter** — full rewrite, 2-3 μήνες work, χάνεις όλο το existing code.
- **Tauri v2** — καλό για desktop (Win/Mac/Linux), αλλά mobile support σε beta.

---

## Step-by-Step

### Step 1: Install Capacitor

```bash
cd "c:\Users\LeonidasDedousis\Desktop\Exp Tracker App\Application"

# Create package.json (Capacitor needs it)
npm init -y

# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Initialize (απάντησε όταν σε ρωτήσει)
npx cap init
  App name: CAPVO
  App ID: com.capvo.expensetracker
  Web asset directory: .
```

---

### Step 2: Create `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.capvo.expensetracker',
  appName: 'CAPVO',
  webDir: '.',
  server: {
    androidScheme: 'https',
    // Για production, set το GitHub Pages URL:
    // url: 'https://adimitriou94.github.io/exp-tracker/',
    // clearDynamicUrl: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6547f6',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Statusbar: {
      style: 'Light',
      backgroundColor: '#6547f6',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
```

---

### Step 3: Modify `index.html` (2 αλλαγές)

**3a. Πρόσθεσε Capacitor splash screen meta tags** μετά το `<meta name="viewport">`:

```html
<meta name="capacitor-statusbar-style" content="light-content">
<meta name="theme-color" content="#6547f6">
```

**3b. Πρόσθεσε Capacitor bridge initialization** — μετά το `<body>` tag, ΠΡΙΝ τα script tags:

```html
<body>
  <!-- ... existing content ... -->

  <!-- Capacitive bridge (before your scripts) -->
  <script src="node_modules/@capacitor/core/dist/index.js"></script>
  <script src="node_modules/@capacitor/app/dist/index.js"></script>

  <!-- Your existing scripts -->
  <script src="./js/app-version.js?v=1.15.10"></script>
  <!-- ... rest of your script tags ... -->
</body>
```

---

### Step 4: Disable Service Worker for Native

Στο αρχείο που κάνεις register το service worker (πιθανόν σε `js/app/08-auth-bootstrap.js` ή `00-core-state.js`), πρόσθεσε check:

```javascript
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('./service-worker.js');
}
```

Ή αν το SW register-άρεται σε inline script:
```html
<script>
  if ('serviceWorker' in navigator && !window.Capacitor) {
    navigator.serviceWorker.register('./service-worker.js');
  }
</script>
```

**Γιατί:** Το Capacitor δεν χρειάζεται SW — το app είναι ήδη "cached" γιατί είναι installed native.

---

### Step 5: Add Android Platform

```bash
npx cap add android
```

Αυτό θα δημιουργήσει το `android/` directory.

---

### Step 6: Sync & Open Android Studio

```bash
# Sync web files
npx cap sync

# Open Android Studio
npx cap open android
```

Σε Android Studio:
1. Άνοιξε το project
2. Σύνδεσε το Android device σου (USB debugging on) ή φτιάξε emulator
3. Press **Run** (green triangle) ή `Ctrl+R`

---

### Step 7: Add iOS Platform (απαιτεί Mac + Xcode)

```bash
npx cap add ios
npx cap sync
npx cap open ios
```

Σε Xcode:
1. Select your team (Apple Developer Program — $99/year)
2. Set Bundle Identifier: `com.capvo.expensetracker`
3. Product → Archive → Distribute App

---

### Step 8: Lock Orientation (Native)

Το existing code σου χρησιμοποιεί Web Screen Orientation API. Για native support:

**Android** — `android/app/src/main/java/com/capvo/expensetracker/MainActivity.java`:

```java
package com.capvo.expensetracker;

import com.getcapacitor.BridgeActivity;
import android.content.pm.ActivityInfo;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }
}
```

**iOS** — `ios/App/App/Info.plist`:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
```

---

### Step 9: Google OAuth in Native (Προαιρετικό)

Στο Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://adimitriou94.github.io/exp-tracker/` (ή το domain σου)
- **Redirect URLs:** `https://adimitriou94.github.io/exp-tracker/**`

Το PKCE flow συνήθως δουλεύει χωρίς αλλαγές σε Capacitor WebView. Αν το Google block-άρει, θα χρειαστεί να configure-άρεις custom redirect URI.

---

## Optional: Add Native Plugins

### Push Notifications

```bash
npm install @capacitor/push-notifications
```

Για Android — πρόσθεσε στο `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Για iOS — πρόσθεσε στο `Info.plist`:
```xml
<key>NSUserNotificationsUsageDescription</key>
<string>CAPVO sends budget reminders and salary alerts.</string>
```

### Biometric App Lock

```bash
npm install @capacitor/security-storage
```

Χρησιμοποιεί fingerprint/Face ID για να κλειδώνει το app.

### Camera (Receipt Scanning)

```bash
npm install @capacitor/camera
```

Για μελλοντικό receipt photo upload.

### Native Share

```bash
npm install @capacitor/share
```

Για sharing expense reports.

### Haptic Feedback

```bash
npm install @capacitor/haptics
```

Για vibration feedback σε button taps.

---

## Versioning

Σύγχρονο το version με το existing `js/app-version.js` και `manifest.webmanifest`:

**Android** — `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 11510   // 1.15.10 → 11510
    versionName "1.15.10"
}
```

**iOS** — `ios/App/App/Info.plist`:
```xml
<key>CFBundleShortVersionString</key>
<string>1.15.10</string>
<key>CFBundleVersion</key>
<string>11510</string>
```

---

## Store Submission

### Google Play Store

| Item | Detail |
|------|--------|
| **Cost** | $25 one-time |
| **Review** | 1-3 days |
| **Format** | AAB (Android App Bundle) |
| **Requirements** | Icon, screenshots, description, privacy policy |
| **Build** | `npx cap sync` → Android Studio → Build → Generate Signed Bundle/AAB |

### Apple App Store

| Item | Detail |
|------|--------|
| **Cost** | $99/year |
| **Review** | 24-48 hours (first time: longer) |
| **Format** | IPA |
| **Requirements** | Icon, screenshots, description, privacy policy |
| **Guideline 4.2** | WebView-only apps can be rejected. Mitigate: add native features (push, biometrics, haptics). |
| **Build** | Xcode → Product → Archive → Distribute |

---

## Deployment Workflow

```bash
# 1. Update version
echo "window.CAPVO_VERSION = '1.15.10';" > js/app-version.js

# 2. Commit and push to GitHub (GitHub Pages auto-updates)
git add -A && git commit -m "Bump to v1.15.9" && git push

# 3. Sync Capacitor
npx cap sync

# 4. Build Android
npx cap open android  # → Build → Generate Signed Bundle/AAB

# OR build iOS
npx cap open ios  # → Product → Archive
```

---

## What Changes vs PWA

| Feature | PWA | Native (Capacitor) |
|---------|-----|-------------------|
| **Installation** | "Add to Home Screen" | App Store / Play Store |
| **Service Worker** | Active (caching) | Disabled (app is installed) |
| **Orientation** | Web Screen Orientation API | Native Activity setting |
| **Push Notifications** | ❌ (not reliable) | ✅ (FCM + APNs) |
| **Biometrics** | ❌ | ✅ (fingerprint/Face ID) |
| **Camera** | Web API | ✅ (native camera) |
| **Offline** | Partial (cached pages) | Full (app is installed) |
| **Updates** | Automatic (new SW cache) | Manual (new store release) |
| **Splash Screen** | Minimal | Custom (Capacitor plugin) |
| **Status Bar** | CSS-only | Native control |
| **Safe Area** | CSS env() | Native handling |
| **Google OAuth** | Works in WebView | Usually works (PKCE) |

---

## Timeline Estimate

| Week | Task |
|------|------|
| **Day 1** | Install Capacitor, build Android APK, test |
| **Day 2** | Fix issues, build iOS, test OAuth flow |
| **Week 2** | Add push notifications |
| **Week 3** | Add biometric app lock |
| **Week 4** | Prepare store listings (screenshots, descriptions) |
| **Week 5** | Submit to Google Play |
| **Week 6-7** | Submit to Apple App Store |

**Total: ~1 week of active work** (plus 1-2 hours per native feature).
