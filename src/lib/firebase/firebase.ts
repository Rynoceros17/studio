
import { initializeApp, type FirebaseApp } from 'firebase/app';
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

// Check if all required Firebase config values are present
const requiredEnvVarKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId']; // Removed storageBucket and messagingSenderId as they might not be strictly essential for core functionality for all apps.
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
  app = {} as FirebaseApp; // Ensures 'app' is assigned
  auth = {} as Auth; // Ensures 'auth' is assigned
  db = {} as Firestore; // Ensures 'db' is assigned
} else {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);

  // Initialize Cloud Firestore and get a reference to the service
  db = getFirestore(app);

  // Initialize Auth
  auth = getAuth(app);
}

export { app, auth, db };
