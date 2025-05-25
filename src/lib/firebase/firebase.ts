
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
// Removed: import { getAuth, type Auth } from 'firebase/auth';
// Removed: import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log environment variables during server-side build or initial server run
if (typeof window === 'undefined') {
  console.log("Firebase Config Check (Server-side):");
  console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'MISSING or UNDEFINED');
  // Log other variables if needed for Genkit or other Firebase services
}


let app: FirebaseApp;
// let auth: Auth; // Removed
// let db: Firestore; // Removed

// Check for missing essential environment variables for basic app initialization (Genkit might need these)
const requiredEnvVarKeys = ['apiKey', 'authDomain', 'projectId', 'appId']; // Reduced set for basic app/Genkit
const missingEnvVars: string[] = [];

for (const key of requiredEnvVarKeys) {
  const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  if (!firebaseConfig[key as keyof typeof firebaseConfig]) {
    missingEnvVars.push(envVarName);
  }
}

if (missingEnvVars.length > 0) {
  const errorMessage = `Firebase Critical Configuration Error: The following environment variable(s) are missing or undefined: ${missingEnvVars.join(', ')}. ` +
  "Please ensure these are correctly set in your .env file (e.g., .env.local) and that you have RESTARTED your development server. Firebase will not initialize correctly.";
  console.error(errorMessage);
  app = {} as FirebaseApp; // Dummy app to prevent further crashes if imported elsewhere
  // auth = {} as Auth; // Removed
  // db = {} as Firestore; // Removed
} else {
  // This logic tries to initialize on client/server and reuse existing app
  if (typeof window !== 'undefined' && !getApps().length) {
    console.log("Initializing Firebase on client with config:", firebaseConfig);
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Error initializing Firebase on client:", e);
      app = {} as FirebaseApp; // Assign dummy on error
    }
  } else if (typeof window === 'undefined') {
    if (!getApps().length) {
      console.log("Initializing Firebase on server with config:", firebaseConfig);
      try {
        app = initializeApp(firebaseConfig);
      } catch (e) {
        console.error("Error initializing Firebase on server:", e);
        app = {} as FirebaseApp; // Assign dummy on error
      }
    } else {
      app = getApp();
    }
  } else {
    app = getApp();
  }

  // Initialize services only if app was successfully initialized
  if (app && Object.keys(app).length > 0 && app.name) { // Check if app is a valid FirebaseApp
    // auth = getAuth(app); // Removed
    // db = getFirestore(app); // Removed
  } else {
    console.error("Firebase app object is not valid. Auth and DB will not be initialized.");
    // auth = {} as Auth; // Removed
    // db = {} as Firestore; // Removed
  }
}

export { app }; // Only export app, auth and db are removed
// export { app, auth, db }; // Old export
