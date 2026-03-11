/**
 * Firebase Configuration and Services
 * 
 * This module initializes Firebase and exports all necessary services
 * for the Adhkar application including Firestore, Authentication, and Analytics.
 */

// Import Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js';

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

// Initialize Firebase
let app;
let db;
let auth;
let analytics;
let currentUser = null;

/**
 * Initialize Firebase services
 * @returns {Promise<Object>} Initialized Firebase services
 */
export async function initFirebase() {
  try {
    // Initialize Firebase app (only once)
    if (!app) {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase App initialized');
    }

    // Initialize Authentication
    if (!auth) {
      auth = getAuth(app);
      console.log('✅ Firebase Auth initialized');
    }

    // Initialize Firestore
    if (!db) {
      db = getFirestore(app);
      
      // Enable offline persistence for better UX
      try {
        await enableIndexedDbPersistence(db);
        console.log('✅ Firestore offline persistence enabled');
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Multiple tabs open, persistence enabled only in first tab');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Browser doesn\'t support persistence');
        }
      }
    }

    // Initialize Analytics
    if (!analytics && typeof getAnalytics === 'function') {
      try {
        analytics = getAnalytics(app);
        console.log('✅ Firebase Analytics initialized');
      } catch (err) {
        console.warn('⚠️ Analytics not available:', err.message);
      }
    }

    return { app, db, auth, analytics };
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
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

    return new Promise((resolve, reject) => {
      // Check if already authenticated
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          currentUser = user;
          console.log('✅ User authenticated:', user.uid);
          resolve(user);
        } else {
          // Sign in anonymously
          try {
            const userCredential = await signInAnonymously(auth);
            currentUser = userCredential.user;
            console.log('✅ Anonymous user created:', currentUser.uid);
            resolve(currentUser);
          } catch (error) {
            console.error('❌ Authentication error:', error);
            reject(error);
          }
        }
      });
    });
  } catch (error) {
    console.error('❌ Authentication error:', error);
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
    if (!db) await initFirebase();
    if (!currentUser) await authenticateUser();

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    await setDoc(userDocRef, {
      [dataType]: data,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ ${dataType} saved to Firestore`);
  } catch (error) {
    console.error(`❌ Error saving ${dataType} to Firestore:`, error);
    // Fallback to localStorage on error
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
    if (!db) await initFirebase();
    if (!currentUser) await authenticateUser();

    const userDocRef = doc(db, 'users', currentUser.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data()[dataType];
      console.log(`✅ ${dataType} loaded from Firestore`);
      return data || null;
    } else {
      console.log(`ℹ️ No ${dataType} found in Firestore`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading ${dataType} from Firestore:`, error);
    // Fallback to localStorage on error
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
    if (!db) await initFirebase();
    if (!currentUser) await authenticateUser();

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    await updateDoc(userDocRef, {
      [`${dataType}`]: updates,
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ ${dataType} updated in Firestore`);
  } catch (error) {
    console.error(`❌ Error updating ${dataType} in Firestore:`, error);
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
    if (!db) await initFirebase();
    if (!currentUser) await authenticateUser();

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    await updateDoc(userDocRef, {
      [dataType]: null,
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ ${dataType} deleted from Firestore`);
  } catch (error) {
    console.error(`❌ Error deleting ${dataType} from Firestore:`, error);
    throw error;
  }
}

/**
 * Listen to real-time updates from Firestore
 * @param {string} dataType - Type of data to listen to
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} Unsubscribe function
 */
export function listenToFirestore(dataType, callback) {
  try {
    if (!db || !currentUser) {
      console.warn('⚠️ Cannot listen: Firebase or user not initialized');
      return () => {};
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()[dataType];
        callback(data);
      }
    }, (error) => {
      console.error(`❌ Error listening to ${dataType}:`, error);
    });

    console.log(`✅ Listening to ${dataType} updates`);
    return unsubscribe;
  } catch (error) {
    console.error(`❌ Error setting up listener for ${dataType}:`, error);
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
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
      console.log(`📊 Analytics event logged: ${eventName}`);
    }
  } catch (error) {
    console.warn('⚠️ Analytics event not logged:', error.message);
  }
}

/**
 * Sync local storage to Firestore (migration helper)
 * @returns {Promise<void>}
 */
export async function syncLocalStorageToFirestore() {
  try {
    console.log('🔄 Starting localStorage to Firestore migration...');

    // Migrate favorites
    const favorites = localStorage.getItem('favorites');
    if (favorites) {
      await saveToFirestore('favorites', JSON.parse(favorites));
    }

    // Migrate completed adhkar
    const completed = localStorage.getItem('completed');
    if (completed) {
      await saveToFirestore('completed', JSON.parse(completed));
    }

    // Migrate progress data
    const progress = localStorage.getItem('dailyProgress');
    if (progress) {
      await saveToFirestore('dailyProgress', JSON.parse(progress));
    }

    // Migrate tasbeeh count
    const tasbeehCount = localStorage.getItem('tasbeehCount');
    if (tasbeehCount) {
      await saveToFirestore('tasbeeh', { count: parseInt(tasbeehCount) || 0 });
    }

    console.log('✅ LocalStorage migration completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Export Firebase instances for direct access if needed
export { app, db, auth, analytics };
