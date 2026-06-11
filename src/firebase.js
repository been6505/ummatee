import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBYD1pYwC-ygjn2PFgLV7t7FYfgI0x56Mw',
  authDomain: 'ummatee-app.firebaseapp.com',
  projectId: 'ummatee-app',
  storageBucket: 'ummatee-app.firebasestorage.app',
  messagingSenderId: '703058924415',
  appId: '1:703058924415:web:31c5ac18c832ba5856804a',
  measurementId: 'G-0L9D8QTV3B',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
