// firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBx_VBx-_6iNzLg4FwBP0UtoHCPAgwEIoU",
  authDomain: "echo-crystal-realm.firebaseapp.com",
  projectId: "echo-crystal-realm",
  storageBucket: "echo-crystal-realm.firebasestorage.app",
  messagingSenderId: "601995904994",
  appId: "1:601995904994:web:3b24d9f016b3541a4e1bbb",
  measurementId: "G-8S4BEC4QV1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);