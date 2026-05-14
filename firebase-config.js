/**
 * Firebase Configuration and Services
 *
 * Lazy-loads Firebase SDK modules to reduce startup cost.
 */
const FIREBASE_VERSION = '10.8.0';
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const DEFAULT_OPTIONS = {
  enablePersistence: true,
  enableAnalytics: true,
  useLite: true
};

const DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBtHvklnxlP7ZgTvwJrpgMz4cbWiuhq9TM",
  authDomain: "create-project-36d4c.firebaseapp.com",
  projectId: "create-project-36d4c",
  storageBucket: "create-project-36d4c.firebasestorage.app",
  messagingSenderId: "384696044918",
  appId: "1:384696044918:web:71c92683bb3f596db1fe57",
  measurementId: "G-3YLNSLG0W6"
};

let app;
let db;
let dbMode = null;
let auth;
let analytics;
let currentUser = null;

let corePromise;
let authPromise;
let firestoreLitePromise;
let firestoreFullPromise;
let analyticsPromise;

let firestoreApi = null;
let firestoreMode = null;
let analyticsApi = null;

const loadCore = async () => {
  if (!corePromise) {
    corePromise = import(`${FIREBASE_BASE}/firebase-app.js`);
  }
  return corePromise;
};

const loadAuth = async () => {
  if (!authPromise) {
    authPromise = import(`${FIREBASE_BASE}/firebase-auth.js`);
  }
  return authPromise;
};

const loadFirestoreLite = async () => {
  if (!firestoreLitePromise) {
    firestoreLitePromise = import(`${FIREBASE_BASE}/firebase-firestore-lite.js`);
  }
  return firestoreLitePromise;
};

const loadFirestoreFull = async () => {
  if (!firestoreFullPromise) {
    firestoreFullPromise = import(`${FIREBASE_BASE}/firebase-firestore.js`);
  }
  return firestoreFullPromise;
};

const loadAnalytics = async () => {
  if (!analyticsPromise) {
    analyticsPromise = import(`${FIREBASE_BASE}/firebase-analytics.js`);
  }
  return analyticsPromise;
};

const ensureFirestore = async (options = {}) => {
  const opts = {
    useLite: true,
    enablePersistence: false,
    forceFull: false,
    ...options
  };
  const useFull = opts.forceFull || opts.enablePersistence || !opts.useLite;

  if (!firestoreApi || (useFull && firestoreMode !== 'full')) {
    firestoreApi = useFull ? await loadFirestoreFull() : await loadFirestoreLite();
    firestoreMode = useFull ? 'full' : 'lite';
  }

  if (app && (!db || dbMode !== firestoreMode)) {
    db = firestoreApi.getFirestore(app);
    dbMode = firestoreMode;
  }

  return firestoreApi;
};

const ensureAnalytics = async () => {
  if (analytics) return;
  analyticsApi = await loadAnalytics();
  analytics = analyticsApi.getAnalytics(app);
};

/**
 * Initialize Firebase services
 * @param {Object} options
 * @param {boolean} options.enablePersistence
 * @param {boolean} options.enableAnalytics
 * @param {boolean} options.useLite
 * @returns {Promise<Object>} Initialized Firebase services
 */
export async function initFirebase(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    const core = await loadCore();
    const authApi = await loadAuth();

    if (!app) {
      app = core.initializeApp(firebaseConfig);
      debugLog('Firebase App initialized');
    }

    if (!auth) {
      auth = authApi.getAuth(app);
      debugLog('Firebase Auth initialized');
    }

    await ensureFirestore({
      useLite: opts.useLite,
      enablePersistence: opts.enablePersistence
    });

    if (opts.enablePersistence && firestoreMode === 'full') {
      try {
        await firestoreApi.enableIndexedDbPersistence(db);
        debugLog('Firestore offline persistence enabled');
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence enabled only in first tab');
        } else if (err.code === 'unimplemented') {
          console.warn('Browser does not support persistence');
        }
      }
    }

    if (opts.enableAnalytics) {
      try {
        await ensureAnalytics();
        debugLog('Firebase Analytics initialized');
      } catch (err) {
        console.warn('Analytics not available:', err.message);
      }
    }

    return { app, db, auth, analytics };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

/**
 * Authenticate user anonymously
 * @returns {Promise<Object>} User object
 */
export async function authenticateUser() {
  try {
    if (!auth) {
      await initFirebase();
    }

    const authApi = await loadAuth();

    return new Promise((resolve, reject) => {
      authApi.onAuthStateChanged(auth, async (user) => {
        if (user) {
          currentUser = user;
          debugLog('User authenticated:', user.uid);
          resolve(user);
        } else {
          try {
            const userCredential = await authApi.signInAnonymously(auth);
            currentUser = userCredential.user;
            debugLog('Anonymous user created:', currentUser.uid);
            resolve(currentUser);
          } catch (error) {
            console.error('Authentication error:', error);
            reject(error);
          }
        }
      });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Save user data to Firestore
 * @param {string} dataType - Type of data (e.g., 'favorites', 'completed', 'progress')
 * @param {Object} data - Data to save
 * @returns {Promise<void>}
 */
export async function saveToFirestore(dataType, data) {
  try {
    if (!db) await initFirebase({ enablePersistence: false });
    if (!currentUser) await authenticateUser();

    await ensureFirestore({ useLite: true });

    const userDocRef = firestoreApi.doc(db, 'users', currentUser.uid);
    await firestoreApi.setDoc(userDocRef, {
      [dataType]: data,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    debugLog(`${dataType} saved to Firestore`);
  } catch (error) {
    console.error(`Error saving ${dataType} to Firestore:`, error);
    localStorage.setItem(dataType, JSON.stringify(data));
  }
}

/**
 * Load user data from Firestore
 * @param {string} dataType - Type of data to load
 * @returns {Promise<Object|null>} Data or null if not found
 */
export async function loadFromFirestore(dataType) {
  try {
    if (!db) await initFirebase({ enablePersistence: false });
    if (!currentUser) await authenticateUser();

    await ensureFirestore({ useLite: true });

    const userDocRef = firestoreApi.doc(db, 'users', currentUser.uid);
    const docSnap = await firestoreApi.getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data()[dataType];
      debugLog(`${dataType} loaded from Firestore`);
      return data || null;
    }

    debugLog(`No ${dataType} found in Firestore`);
    return null;
  } catch (error) {
    console.error(`Error loading ${dataType} from Firestore:`, error);
    const localData = localStorage.getItem(dataType);
    return localData ? JSON.parse(localData) : null;
  }
}

/**
 * Update user data in Firestore
 * @param {string} dataType - Type of data to update
 * @param {Object} updates - Updates to apply
 * @returns {Promise<void>}
 */
export async function updateFirestore(dataType, updates) {
  try {
    if (!db) await initFirebase({ enablePersistence: false });
    if (!currentUser) await authenticateUser();

    await ensureFirestore({ useLite: true });

    const userDocRef = firestoreApi.doc(db, 'users', currentUser.uid);
    await firestoreApi.updateDoc(userDocRef, {
      [`${dataType}`]: updates,
      lastUpdated: new Date().toISOString()
    });

    debugLog(`${dataType} updated in Firestore`);
  } catch (error) {
    console.error(`Error updating ${dataType} in Firestore:`, error);
    throw error;
  }
}

/**
 * Delete user data from Firestore
 * @param {string} dataType - Type of data to delete
 * @returns {Promise<void>}
 */
export async function deleteFromFirestore(dataType) {
  try {
    if (!db) await initFirebase({ enablePersistence: false });
    if (!currentUser) await authenticateUser();

    await ensureFirestore({ useLite: true });

    const userDocRef = firestoreApi.doc(db, 'users', currentUser.uid);
    await firestoreApi.updateDoc(userDocRef, {
      [dataType]: null,
      lastUpdated: new Date().toISOString()
    });

    debugLog(`${dataType} deleted from Firestore`);
  } catch (error) {
    console.error(`Error deleting ${dataType} from Firestore:`, error);
    throw error;
  }
}

/**
 * Listen to real-time updates from Firestore
 * @param {string} dataType - Type of data to listen to
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} Unsubscribe function
 */
export async function listenToFirestore(dataType, callback) {
  try {
    if (!db || !currentUser) {
      await initFirebase({ enablePersistence: true, useLite: false });
      await authenticateUser();
    }

    await ensureFirestore({ forceFull: true, enablePersistence: true });

    const userDocRef = firestoreApi.doc(db, 'users', currentUser.uid);
    const unsubscribe = firestoreApi.onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()[dataType];
        callback(data);
      }
    }, (error) => {
      console.error(`Error listening to ${dataType}:`, error);
    });

    debugLog(`Listening to ${dataType} updates`);
    return unsubscribe;
  } catch (error) {
    console.error(`Error setting up listener for ${dataType}:`, error);
    return () => {};
  }
}

/**
 * Log analytics event
 * @param {string} eventName - Event name
 * @param {Object} eventParams - Event parameters
 */
export function logAnalyticsEvent(eventName, eventParams = {}) {
  try {
    if (analytics && analyticsApi && typeof analyticsApi.logEvent === 'function') {
      analyticsApi.logEvent(analytics, eventName, eventParams);
      debugLog(`Analytics event logged: ${eventName}`);
    }
  } catch (error) {
    console.warn('Analytics event not logged:', error.message);
  }
}

/**
 * Sync local storage to Firestore (migration helper)
 * @returns {Promise<void>}
 */
export async function syncLocalStorageToFirestore() {
  try {
    debugLog('Starting localStorage to Firestore migration...');

    const favorites = localStorage.getItem('favorites');
    if (favorites) {
      await saveToFirestore('favorites', JSON.parse(favorites));
    }

    const completed = localStorage.getItem('completed');
    if (completed) {
      await saveToFirestore('completed', JSON.parse(completed));
    }

    const progress = localStorage.getItem('dailyProgress');
    if (progress) {
      await saveToFirestore('dailyProgress', JSON.parse(progress));
    }

    const tasbeehCount = localStorage.getItem('tasbeehCount');
    if (tasbeehCount) {
      await saveToFirestore('tasbeeh', { count: parseInt(tasbeehCount, 10) || 0 });
    }

    debugLog('LocalStorage migration completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

export { app, db, auth, analytics };
