/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Firebase Context Provider
 * Manages Google Authentication state and real-time subscription to the
 * authenticated customer's private saved reports in Firestore.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  SavedReportRecord,
  deleteSavedReport,
  saveAnalysisReportToFirestore,
  signInWithGooglePopup,
  signOutCustomer,
  subscribeToAuthState,
  subscribeToSavedReports,
  updateSavedReportNotes,
} from '../lib/firebase';
import { AnalysisReport } from '../../shared/schemas/analysis';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  savedReports: SavedReportRecord[];
  authError: string | null;
  signIn: () => Promise<User | null>;
  signOut: () => Promise<void>;
  saveReport: (report: AnalysisReport, notes?: string) => Promise<string>;
  updateNotes: (reportId: string, notes: string) => Promise<void>;
  removeReport: (reportId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setSavedReports([]);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setSavedReports([]);
      return;
    }

    const unsubReports = subscribeToSavedReports(
      user.uid,
      (items) => {
        setSavedReports(items);
      },
      (err) => {
        if (err.message.includes('Quota exceeded')) {
          setAuthError(
            'Firestore daily free-tier quota exceeded. Quota resets the next day.'
          );
        }
      }
    );

    return () => unsubReports();
  }, [authReady, user]);

  const handleSignIn = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const signedInUser = await signInWithGooglePopup();
      return signedInUser;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!msg.includes('auth/popup-closed-by-user')) {
        setAuthError(
          'Google sign-in could not be completed. Please try again.'
        );
      }
      return null;
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOutCustomer();
  };

  const handleSaveReport = async (
    report: AnalysisReport,
    notes = ''
  ): Promise<string> => {
    setAuthError(null);
    return saveAnalysisReportToFirestore(report, notes);
  };

  const handleUpdateNotes = async (reportId: string, notes: string) => {
    setAuthError(null);
    await updateSavedReportNotes(reportId, notes);
  };

  const handleRemoveReport = async (reportId: string) => {
    setAuthError(null);
    await deleteSavedReport(reportId);
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        savedReports,
        authError,
        signIn: handleSignIn,
        signOut: handleSignOut,
        saveReport: handleSaveReport,
        updateNotes: handleUpdateNotes,
        removeReport: handleRemoveReport,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return ctx;
}
