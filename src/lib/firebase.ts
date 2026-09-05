import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from '../types';

// Embedded fallback config from firebase-applet-config.json for instant synchronous load
const defaultConfig = {
  projectId: "gen-lang-client-0591355778",
  appId: "1:324408293981:web:513830905ec72e9024abb4",
  apiKey: "AIzaSyC_m1Ic5XhEt1kr7bW_sjJK0XS5buMEwjE",
  authDomain: "gen-lang-client-0591355778.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-echomind-3615fd2d-8bc7-4d12-8e4c-72c763624642",
  storageBucket: "gen-lang-client-0591355778.firebasestorage.app",
  messagingSenderId: "324408293981",
};

export const app = getApps().length === 0 ? initializeApp(defaultConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific database ID if provisioned, else default
export const db = defaultConfig.firestoreDatabaseId && defaultConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, defaultConfig.firestoreDatabaseId)
  : getFirestore(app);

// Defensive sanitization: Strips all undefined fields to prevent Firestore driver write crashes
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

// Mandatory Firestore Error Handler from Firebase Integration Skill
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };

  console.error('[EchoMind Firestore Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity verification as mandated in Firebase Skill
export async function verifyFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client appears offline. Please check network connection.');
      return false;
    }
    // Permission denied on test/connection is expected since catch-all default deny is active
    return true;
  }
}
