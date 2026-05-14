(() => {
  const metrics = {
    lcp: null,
    cls: 0,
    inp: null,
    fcp: null,
    ttfb: null
  };

  const queue = [];

  const store = (name, value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    metrics[name] = value;
    queue.push({ name, value, ts: Date.now() });
  };

  const flush = () => {
    if (!queue.length) return;
    if (window.FirebaseSync && window.FirebaseSync.initialized && typeof window.FirebaseSync.logEvent === 'function') {
      const payload = queue.splice(0, queue.length);
      payload.forEach(item => {
        window.FirebaseSync.logEvent('performance_metric', {
          name: item.name,
          value: item.value,
          ts: item.ts
        });
      });
    }
  };

  const nav = performance.getEntriesByType('navigation')[0];
  if (nav) {
    store('ttfb', Math.round(nav.responseStart - nav.startTime));
  }

  try {
    const paintObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          store('fcp', Math.round(entry.startTime));
        }
      });
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch (error) {
    // Ignore unsupported browsers
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        store('lcp', Math.round(lastEntry.startTime));
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) {
    // Ignore unsupported browsers
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          metrics.cls += entry.value;
          store('cls', Number(metrics.cls.toFixed(4)));
        }
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (error) {
    // Ignore unsupported browsers
  }

  try {
    let maxDuration = 0;
    const inpObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > maxDuration) {
          maxDuration = entry.duration;
          store('inp', Math.round(maxDuration));
        }
      });
    });
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch (error) {
    // Ignore unsupported browsers
  }

  window.__azkarPerf = metrics;

  window.addEventListener('azkar:firebase-ready', flush, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  setTimeout(flush, 10000);
})();
