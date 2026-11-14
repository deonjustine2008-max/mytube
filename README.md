# MyTube Offline Library (PWA starter)

A browser-based offline video library. It imports video files selected by the user into IndexedDB, displays them in a local library, and plays them with the browser's built-in video player.

## Important limitations

- This app does not download videos from YouTube.
- It cannot access or transfer protected YouTube in-app downloads.
- Import only video files you own or are authorised to store.
- Videos are stored in this browser's IndexedDB, not literally inside the JavaScript source code.
- Browser storage can be cleared by the user, browser settings, or the operating system. Persistent-storage requests are best-effort, not a backup.
- The app shell is cached by a service worker. Open it online once before going offline.
- The browser may impose storage quotas. Large video libraries are better suited to a native Android app or user-selected folder storage.

## Run locally

Service workers require HTTPS or localhost.

### Option A: Python

1. Install Python 3 if it is not already installed.
2. Open a terminal in this project folder.
3. Run:

   `python -m http.server 8000`

4. On the same computer, open `http://localhost:8000` in Chrome.

### Option B: VS Code

1. Open this folder in Visual Studio Code.
2. Install the Live Server extension.
3. Right-click `index.html` and choose **Open with Live Server**.

## Use on Android

For Android Chrome, host the project on an HTTPS static host (for example, a static site host you control), open the HTTPS address in Chrome, and use **Add to Home screen** / **Install app** if offered. Open it once while online so the service worker can cache the app shell. Then test with airplane mode.

The browser's IndexedDB library belongs to that origin and browser profile. Do not clear site data if you want to keep the imported videos.

## Files

- `index.html`: page structure
- `styles.css`: interface styling
- `app.js`: IndexedDB, import, search, playback cards, deletion
- `sw.js`: offline app-shell cache
- `manifest.webmanifest`: installable PWA metadata
