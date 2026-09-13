import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Android WebViews (this app runs inside one via Capacitor) frequently can't
// sustain the streaming HTTP connection Firestore uses by default, which
// surfaces as "Failed to get document because the client is offline" even
// when the device has a perfectly good connection. Auto-detected long-polling
// falls back to plain request/response calls when streaming isn't supported.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  // Firestore was already initialized elsewhere (e.g. hot reload) — reuse it.
  db = getFirestore(app);
}

const auth = getAuth(app);
const storage = getStorage(app);

export { 
  app, db, auth, storage,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  ref, uploadBytes, getDownloadURL,
};
