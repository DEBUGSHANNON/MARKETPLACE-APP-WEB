import { initializeApp } from 'firebase/app';
import {
  applyActionCode,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function detectEmulatorMode(): boolean {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    return true;
  }
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalHost) return false;

  const params = new URLSearchParams(window.location.search);
  const urlFlag = params.get('emulator');
  if (urlFlag === 'true') {
    window.sessionStorage.setItem('campustrade_use_emulator', 'true');
    return true;
  }
  if (urlFlag === 'false') {
    window.sessionStorage.removeItem('campustrade_use_emulator');
    window.localStorage.removeItem('campustrade_use_emulator');
    return false;
  }
  return window.sessionStorage.getItem('campustrade_use_emulator') === 'true';
}

export const IS_EMULATOR_MODE = detectEmulatorMode();

const app = initializeApp(firebaseConfig);
export const db = IS_EMULATOR_MODE
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  hd: 'graduate.utm.my',
});

if (IS_EMULATOR_MODE) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export async function checkEmulatorReachable(): Promise<boolean> {
  if (!IS_EMULATOR_MODE) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${firebaseConfig.projectId}/oobCodes`,
      { signal: controller.signal },
    );
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

const EMULATOR_ACCOUNTS: Record<
  'seller' | 'buyer',
  { email: string; password: string; displayName: string }
> = {
  seller: {
    email: 'seller.utm@graduate.utm.my',
    password: 'utm-emulator-password',
    displayName: 'Aiman Hakim (Seller)',
  },
  buyer: {
    email: 'buyer.utm@graduate.utm.my',
    password: 'utm-emulator-password',
    displayName: 'Mei Ling (Buyer)',
  },
};

async function verifyEmulatorEmail(user: User, email: string): Promise<boolean> {
  if (user.emailVerified) return false;
  await sendEmailVerification(user);
  const res = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${firebaseConfig.projectId}/oobCodes`,
  );
  if (!res.ok) {
    throw new Error(
      'Could not reach Firebase Auth Emulator on port 9099. Run "firebase emulators:start" first.',
    );
  }
  const data = (await res.json()) as {
    oobCodes?: Array<{
      email?: string;
      requestType?: string;
      oobCode?: string;
    }>;
  };
  const match = (data.oobCodes || [])
    .reverse()
    .find(
      (entry) =>
        entry.email?.toLowerCase() === email.toLowerCase() &&
        entry.requestType === 'VERIFY_EMAIL' &&
        entry.oobCode,
    );
  if (match?.oobCode) {
    await applyActionCode(auth, match.oobCode);
    await user.reload();
    await user.getIdToken(true);
    return true;
  }
  return false;
}

export async function switchEmulatorRole(role: 'seller' | 'buyer'): Promise<User> {
  if (!IS_EMULATOR_MODE) {
    throw new Error('Emulator quick-switch is only available in Firebase Emulator mode.');
  }

  const reachable = await checkEmulatorReachable();
  if (!reachable) {
    throw new Error(
      'Firebase Emulator is not running on 127.0.0.1:9099. Start it in a terminal with: firebase emulators:start',
    );
  }

  const account = EMULATOR_ACCOUNTS[role];
  if (auth.currentUser) {
    await signOut(auth);
  }

  let signedUser: User;
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      account.email,
      account.password,
    );
    signedUser = cred.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('network-request-failed')) {
      throw new Error(
        'Cannot reach Firebase Auth Emulator (127.0.0.1:9099). Make sure "firebase emulators:start" is running.',
      );
    }
    const cred = await createUserWithEmailAndPassword(
      auth,
      account.email,
      account.password,
    );
    signedUser = cred.user;
  }

  if (signedUser.displayName !== account.displayName) {
    await updateProfile(signedUser, { displayName: account.displayName });
  }

  const newlyVerified = await verifyEmulatorEmail(signedUser, account.email);
  if (newlyVerified) {
    // Re-sign in so Auth state listeners and JWT immediately reflect email_verified: true
    await signOut(auth);
    const fresh = await signInWithEmailAndPassword(
      auth,
      account.email,
      account.password,
    );
    signedUser = fresh.user;
  }

  await signedUser.getIdToken(true);
  return signedUser;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isPermissionDeniedError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission-denied')
  );
}

export function isNetworkOrUnavailableError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    code === 'auth/network-request-failed' ||
    code === 'auth/timeout' ||
    msg.includes('client is offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('network-request-failed') ||
    msg.includes('network error') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('deadline exceeded')
  );
}

export function getFriendlyFirebaseError(
  error: unknown,
  fallback = 'Something went wrong while contacting the campus server. Please try again.',
): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Check your internet connection and try again.';
  }
  if (isNetworkOrUnavailableError(error)) {
    return 'Network connection is slow or temporarily unavailable. Please retry in a moment.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Daily database quota exceeded. Please try again later.';
  }
  if (lower.includes('popup-blocked')) {
    return 'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.';
  }
  return msg || fallback;
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
