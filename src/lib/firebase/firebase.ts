
// src/lib/firebase/firebase.ts

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Your web app's Firebase configuration.
 * It's crucial that these environment variables are set.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBmC5qeX86cRkvH8IwFXcN4UFuBProegZU",
  authDomain: "weekwise-hxko9.firebaseapp.com",
  projectId: "weekwise-hxko9",
  storageBucket: "weekwise-hxko9.firebasestorage.app",
  messagingSenderId: "456158244888",
  appId: "1:456158244888:web:62decc24812a5a7b70d36d"
};

// These variables will hold the initialized Firebase services.
let app: FirebaseApp;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  // Initialize Firebase.
  // This checks if an app is already initialized to prevent re-initialization.
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Get handles to the Auth and Firestore services.
  auth = getAuth(app);
  db = getFirestore(app);

  console.log("Firebase initialized successfully.");

} catch (error) {
  console.error('Firebase initialization error:', error);
  // If initialization fails, auth and db will remain null.
  // The application can then gracefully handle this (e.g., by falling back to local storage).
}

// Export the initialized services for use throughout the application.
export { app, auth, db };
