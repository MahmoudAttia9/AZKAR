# Implementation and Deployment Guide

This guide covers deployment steps for the performance overhaul, validation steps, and how to tune Firebase behavior.

---

## 1) Local Validation

1. Serve the app locally (service workers require HTTP/HTTPS):
   ```powershell
   python -m http.server 8000
   ```
2. Open:
   ```
   http://localhost:8000/index.html
   ```
3. Confirm critical CSS and deferred CSS behavior:
   - The page should paint quickly without a flash of unstyled content.
   - styles.css should load in the Network panel after initial HTML.

---

## 2) Service Worker Update

1. Open DevTools > Application > Service Workers.
2. Check that the new cache version is active (CACHE_VERSION in sw.js).
3. If needed, click "Update" to apply the new worker.

---

## 3) Firebase Initialization Tuning

The app now lazy-loads Firebase modules to reduce startup cost.

- Default behavior: Firebase initializes on first interaction or idle time.
- To force immediate Firebase init (for testing):
  ```javascript
  window.FirebaseSync.init();
  ```
- To enable Firestore persistence (heavier but fully offline in Firestore):
  - In index.html, change:
    ```javascript
    initFirebase({ enablePersistence: false });
    ```
  - To:
    ```javascript
    initFirebase({ enablePersistence: true, useLite: false });
    ```

---

## 4) Hosting Configuration

Recommended settings for production:

- Enable Brotli or Gzip compression for HTML, CSS, JS.
- Use long-cache headers for static assets:
  - Cache-Control: public, immutable
- Serve over HTTPS to ensure PWA and service worker functionality.

---

## 5) Lighthouse Validation

1. Open Chrome DevTools > Lighthouse.
2. Run mobile and desktop audits.
3. Record baseline and updated metrics in PERFORMANCE_REPORT.md.

---

## 6) Monitoring and Verification

- The performance-monitor.js script collects LCP, CLS, INP, FCP, and TTFB.
- Metrics are available in the console via:
  ```javascript
  window.__azkarPerf
  ```
- If Firebase is initialized, metrics are logged as analytics events:
  - Event name: performance_metric
  - Params: name, value, ts
