/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Firebase Client & Firestore Security Layer
 * Initializes Firebase Auth & Firestore from firebase-applet-config.json,
 * validates server connectivity, enforces blueprint-synced payload constraints,
 * and implements structured FirestoreErrorInfo error handling.
 */

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AnalysisReport } from '../../shared/schemas/analysis';

// Silence noisy internal WebChannel retry warnings when running in restricted/offline preview networks
setLogLevel('silent');

const app = initializeApp(firebaseConfig);

function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);

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
  path: string | null
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

// Blueprint-synced validation constants (verbatim from firebase-blueprint.json)
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 200;
export const MAX_TARGET_URL_LENGTH = 500;
export const MAX_SUMMARY_LENGTH = 1000;
export const MAX_NOTES_LENGTH = 1000;

export interface SavedReportRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceType: 'url' | 'pdf' | 'image' | 'text';
  targetUrl: string;
  overallRiskLevel: 'Minimal' | 'Low' | 'Medium' | 'High' | 'Critical';
  overallSummary: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  customerNotes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function signOutCustomer(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function saveAnalysisReportToFirestore(
  report: AnalysisReport,
  customerNotes = ''
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser || ! VALID_ID_REGEX.test(currentUser.uid)) {
    throw new Error('Please sign in with Google to save reports.');
  }

  const reportId = `rep_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`.slice(0, MAX_ID_LENGTH);

  const sourceType: SavedReportRecord['sourceType'] =
    report.documentType || 'url';

  const safeTitle = (report.fileName || report.title || 'OpenShield Report')
    .trim()
    .slice(0, MAX_TITLE_LENGTH) || 'OpenShield Report';

  const safeUrl = (report.targetUrl || '').trim().slice(0, MAX_TARGET_URL_LENGTH);
  const safeSummary =
    (report.overallSummary || 'Analysis completed.')
      .trim()
      .slice(0, MAX_SUMMARY_LENGTH) || 'Analysis completed.';
  const safeNotes = customerNotes.trim().slice(0, MAX_NOTES_LENGTH);

  const clampCount = (n: number) =>
    Math.max(0, Math.min(500, Math.floor(Number(n) || 0)));

  const path = `savedReports/${reportId}`;
  try {
    await setDoc(doc(db, 'savedReports', reportId), {
      ownerId: currentUser.uid.slice(0, MAX_ID_LENGTH),
      title: safeTitle,
      sourceType,
      targetUrl: safeUrl,
      overallRiskLevel: report.overallRiskLevel,
      overallSummary: safeSummary,
      findingsCount: clampCount(report.counts.total),
      criticalCount: clampCount(report.counts.Critical),
      highCount: clampCount(report.counts.High),
      mediumCount: clampCount(report.counts.Medium),
      lowCount: clampCount(report.counts.Low),
      customerNotes: safeNotes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSavedReportNotes(
  reportId: string,
  customerNotes: string
): Promise<void> {
  if (!VALID_ID_REGEX.test(reportId) || reportId.length > MAX_ID_LENGTH) {
    throw new Error('Invalid report ID.');
  }
  const safeNotes = customerNotes.trim().slice(0, MAX_NOTES_LENGTH);
  const path = `savedReports/${reportId}`;
  try {
    await updateDoc(doc(db, 'savedReports', reportId), {
      customerNotes: safeNotes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavedReport(reportId: string): Promise<void> {
  if (!VALID_ID_REGEX.test(reportId) || reportId.length > MAX_ID_LENGTH) {
    throw new Error('Invalid report ID.');
  }
  const path = `savedReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'savedReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToSavedReports(
  userId: string,
  onUpdate: (reports: SavedReportRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'savedReports';
  const q = query(
    collection(db, path),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedReportRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(data.ownerId || ''),
          title: String(data.title || ''),
          sourceType: (data.sourceType as SavedReportRecord['sourceType']) || 'url',
          targetUrl: String(data.targetUrl || ''),
          overallRiskLevel:
            (data.overallRiskLevel as SavedReportRecord['overallRiskLevel']) ||
            'Minimal',
          overallSummary: String(data.overallSummary || ''),
          findingsCount: Number(data.findingsCount || 0),
          criticalCount: Number(data.criticalCount || 0),
          highCount: Number(data.highCount || 0),
          mediumCount: Number(data.mediumCount || 0),
          lowCount: Number(data.lowCount || 0),
          customerNotes: String(data.customerNotes || ''),
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedErr) {
        if (onError && formattedErr instanceof Error) {
          onError(formattedErr);
        }
      }
    }
  );
}
