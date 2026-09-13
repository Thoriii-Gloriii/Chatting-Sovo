import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { 
  app, db, auth, storage,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  ref, uploadBytes, getDownloadURL,
};
