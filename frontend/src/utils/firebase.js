import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const runtimeEnv =
  typeof window !== 'undefined' && window.__ENV__ ? window.__ENV__ : {};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || runtimeEnv.VITE_FIREBASE_API_KEY || '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || runtimeEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || runtimeEnv.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || runtimeEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    runtimeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || runtimeEnv.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

if (isFirebaseConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);
  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => null);
}

const firebaseGoogleProvider = new GoogleAuthProvider();

export {
  firebaseApp,
  firebaseAuth,
  firebaseDb,
  firebaseGoogleProvider,
};
