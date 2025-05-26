
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Log environment variables during server-side build or initial server run
if (typeof window === 'undefined') {
  console.log("Firebase Config Check (Server-side):");
  console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'MISSING or UNDEFINED');
}


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

const requiredEnvVarKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId'];
const missingEnvVars: string[] = [];

for (const key of requiredEnvVarKeys) {
  if (!firebaseConfig[key]) {
    missingEnvVars.push(`NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  }
}

if (missingEnvVars.length > 0) {
  const errorMessage = `Firebase Critical Configuration Error: The following environment variable(s) are missing or undefined: ${missingEnvVars.join(', ')}. ` +
  "Please ensure these are correctly set in your .env file (e.g., .env.local) and that you have RESTARTED your development server. Firebase will not initialize correctly.";
  console.error(errorMessage);
  // Assign dummy objects to prevent further crashes if imported elsewhere, though functionality will be broken.
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
} else {
  if (typeof window !== 'undefined' && !getApps().length) {
    try {
      console.log("Initializing Firebase on client with config:", firebaseConfig);
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Error initializing Firebase on client:", e);
      app = {} as FirebaseApp; // Assign dummy on error
    }
  } else if (typeof window === 'undefined') { // Server-side
    if (!getApps().length) {
      try {
        console.log("Initializing Firebase on server with config:", firebaseConfig);
        app = initializeApp(firebaseConfig);
      } catch (e) {
        console.error("Error initializing Firebase on server:", e);
        app = {} as FirebaseApp; // Assign dummy on error
      }
    } else {
      app = getApp();
    }
  } else { // Client-side, app already initialized
    app = getApp();
  }

  // Initialize services only if app was successfully initialized
  if (app && Object.keys(app).length > 0 && app.name) { // Check if app is a valid FirebaseApp
    try {
      auth = getAuth(app);
      db = getFirestore(app);
    } catch (e) {
      console.error("Error getting Firebase Auth or Firestore instance:", e);
      auth = {} as Auth;
      db = {} as Firestore;
    }
  } else {
    if (missingEnvVars.length === 0) { // Only log this specific error if env vars were present
        console.error("Firebase app object is not valid after initialization attempt. Auth and DB will not be initialized.");
    }
    auth = {} as Auth;
    db = {} as Firestore;
  }
}

export { app, auth, db };
