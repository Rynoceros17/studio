
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Log environment variables during server-side build or initial server run
if (typeof window === 'undefined') {
  console.log("Firebase Config Check (Server-side):");
  console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Loaded' : 'MISSING or UNDEFINED');
  console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'MISSING or UNDEFINED');
}


let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Check for missing essential environment variables
const requiredEnvVars: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId'];
const missingEnvVars = requiredEnvVars.filter(key => !firebaseConfig[key]);

if (missingEnvVars.length > 0) {
  const errorMessage = `Firebase Critical Configuration Error: The following environment variable(s) are missing or undefined: ${missingEnvVars
    .map(key => {
        // Map config key to expected .env variable name
        let envVarName = `NEXT_PUBLIC_FIREBASE_`;
        if (key === 'apiKey') envVarName += 'API_KEY';
        else if (key === 'authDomain') envVarName += 'AUTH_DOMAIN';
        else if (key === 'projectId') envVarName += 'PROJECT_ID';
        else if (key === 'storageBucket') envVarName += 'STORAGE_BUCKET';
        else if (key === 'messagingSenderId') envVarName += 'MESSAGING_SENDER_ID';
        else if (key === 'appId') envVarName += 'APP_ID';
        return envVarName;
    })
    .join(', ')}. ` +
  "Please ensure these are correctly set in your .env file (e.g., .env.local) and that you have RESTARTED your development server. Firebase will not initialize correctly.";
  console.error(errorMessage);
  // To prevent the app from completely crashing on the server during build if keys are missing,
  // we assign placeholder/dummy objects. The app will not function correctly with Firebase services.
  // On the client-side, components relying on Firebase should handle this error state (e.g., from AuthContext).
  app = {} as FirebaseApp; // Dummy app
  auth = {} as Auth;       // Dummy auth
  db = {} as Firestore;    // Dummy db
} else {
  if (typeof window !== 'undefined' && !getApps().length) {
    // Initialize Firebase on the client side
    console.log("Initializing Firebase on client with config:", firebaseConfig);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else if (typeof window === 'undefined') {
    // Initialize Firebase on the server side
    // Check if app is already initialized to prevent re-initialization error
    if (!getApps().length) {
      console.log("Initializing Firebase on server with config:", firebaseConfig);
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    // App already initialized on client (e.g., due to hot reload)
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export { app, auth, db };
