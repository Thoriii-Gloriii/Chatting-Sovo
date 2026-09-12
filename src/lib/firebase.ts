import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { 
  app, db, auth, 
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, updateDoc,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile 
};
