import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { Firestore, getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache } from "firebase/firestore";

  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCS3IgLCc2nGetkdZQmsfS2Gz1_MtLS_vk",
  authDomain: "ghost-bus-60703.firebaseapp.com",
  projectId: "ghost-bus-60703",
  storageBucket: "ghost-bus-60703.firebasestorage.app",
  messagingSenderId: "690055338573",
  appId: "1:690055338573:web:9356ce63715f0804ce9a04",
  measurementId: "G-NRK9BW4PDJ"
};

// next.js reloads this file every time i save, but firebase can only be started once
let app: FirebaseApp;
let db: Firestore;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // the cache keeps my fixes on the phone until google has them, so no signal on the bus is fine
  // (the server has no browser storage, so there it just keeps them in memory)
  if (typeof window === "undefined") {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  } else {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  }
} else {
  app = getApp();
  db = getFirestore(app);
}

export { db };

// for the anonymous sign in, so my rules know which phone wrote which ride
export const auth = getAuth(app);
