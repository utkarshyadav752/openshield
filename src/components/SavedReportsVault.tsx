/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Private Saved Reports Vault (Firebase Auth + Firestore)
 * Allows customers who choose to sign in with Google to view, annotate,
 * and delete their explicitly saved URL and Document analysis reports.
 */

import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  ExternalLink,
  LogIn,
  LogOut,
  PencilLine,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { MAX_NOTES_LENGTH, SavedReportRecord } from '../lib/firebase';
import { BrandLogo } from './BrandLogo';

interface SavedReportsVaultProps {
  variant?: 'dark' | 'light';
  id?: string;
}

export const SavedReportsVault: React.FC<SavedReportsVaultProps> = ({
  variant = 'dark',
  id = 'saved-reports-vault',
}) => {
  const {
    user,
    authReady,
    savedReports,
    authError,
    signIn,
    signOut,
    updateNotes,
    removeReport,
  } = useFirebase();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const isLight = variant === 'light';
  const isPrimaryVault = id === 'saved-reports-vault';

  const handleStartEdit = (rec: SavedReportRecord) => {
    setEditingId(rec.id);
    setNotesDraft(rec.customerNotes || '');
  };

  const handleSaveNotes = async (reportId: string) => {
    setSavingNoteId(reportId);
    try {
      await updateNotes(reportId, notesDraft.slice(0, MAX_NOTES_LENGTH));
      setEditingId(null);
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <div
      id={id}
      role="region"
      aria-label="Private Saved Reports History"
      className={
        isLight
          ? 'scroll-mt-20 bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs text-slate-900'
          : 'scroll-mt-20 bg-[#0F172A]/95 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-lg text-white'
      }
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div
            className={`flex flex-wrap items-center gap-2 text-xs font-semibold mb-1.5 ${
              isLight ? 'text-emerald-700' : 'text-emerald-300'
            }`}
          >
            <BrandLogo
              size="sm"
              variant={isLight ? 'light' : 'dark'}
              showWordmark={false}
            />
            <ShieldCheck
              className={`w-4 h-4 shrink-0 ${
                isLight ? 'text-emerald-600' : 'text-emerald-400'
              }`}
              aria-hidden="true"
            />
            <span>Optional Private Cloud History · Zero Automatic Storage</span>
          </div>
          <h2
            className={`font-display text-base sm:text-lg font-bold ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Your Saved Analysis Reports
          </h2>
          <p
            className={`text-xs sm:text-sm mt-0.5 leading-relaxed ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            OpenShield never stores your analyzed links or documents unless you explicitly click “Save report” on a result.
          </p>
        </div>

        {authReady && (
          <div className="shrink-0">
            {user ? (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`text-xs truncate max-w-[220px] ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Signed in as{' '}
                  <strong className={isLight ? 'text-slate-900' : 'text-white'}>
                    {user.email || user.displayName || 'Customer'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  data-testid={
                    isPrimaryVault
                      ? 'firebase-signout-btn'
                      : `${id}-signout-btn`
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isLight
                      ? 'text-slate-700 bg-white hover:bg-slate-100 border border-slate-300'
                      : 'text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600'
                  }`}
                >
                  <LogOut
                    className={`w-3.5 h-3.5 ${
                      isLight ? 'text-blue-700' : 'text-cyan-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn()}
                data-testid={
                  isPrimaryVault ? 'firebase-signin-btn' : `${id}-signin-btn`
                }
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs ${
                  isLight
                    ? 'text-slate-900 bg-white hover:bg-slate-100 border border-slate-300'
                    : 'text-white bg-slate-800/90 hover:bg-slate-700 border border-cyan-500/40'
                }`}
              >
                <LogIn
                  className={`w-3.5 h-3.5 ${
                    isLight ? 'text-blue-700' : 'text-cyan-400'
                  }`}
                  aria-hidden="true"
                />
                <span>Sign in with Google to view saved reports</span>
              </button>
            )}
          </div>
        )}
      </div>

      {authError && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs ${
            isLight
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-amber-950/80 border border-amber-500/50 text-amber-200'
          }`}
        >
          {authError}
        </div>
      )}

      {user && (
        <div
          className={`mt-5 pt-4 border-t ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          {savedReports.length === 0 ? (
            <div
              className={`p-5 text-center rounded-lg text-xs ${
                isLight
                  ? 'bg-white border border-slate-200 text-slate-600'
                  : 'bg-[#060B18]/80 border border-slate-800 text-slate-300'
              }`}
            >
              <Bookmark
                className={`w-5 h-5 mx-auto mb-1.5 ${
                  isLight ? 'text-blue-700' : 'text-cyan-400'
                }`}
                aria-hidden="true"
              />
              <p
                className={`font-semibold ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                No saved reports yet
              </p>
              <p className={isLight ? 'mt-0.5 text-slate-500' : 'mt-0.5 text-slate-400'}>
                Click “Save report” on any URL or document analysis result below to keep a private copy in your account.
              </p>
            </div>
          ) : (
            <div
              className={`divide-y ${
                isLight ? 'divide-slate-200' : 'divide-slate-800'
              }`}
            >
              {savedReports.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div
                        className={`flex flex-wrap items-center gap-2 text-xs tabular-nums ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={`uppercase font-semibold ${
                            isLight ? 'text-blue-700' : 'text-cyan-300'
                          }`}
                        >
                          {item.sourceType}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          Overall Risk: {item.overallRiskLevel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.findingsCount} findings</span>
                      </div>
                      <h3
                        className={`font-display text-sm font-bold mt-0.5 ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.targetUrl && (
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs hover:underline mt-0.5 ${
                            isLight ? 'text-blue-700' : 'text-cyan-300'
                          }`}
                        >
                          <span>{item.targetUrl}</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          isLight ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        {item.overallSummary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                          isLight
                            ? 'text-slate-700 bg-white hover:bg-slate-100 border border-slate-300'
                            : 'text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        <PencilLine
                          className={`w-3 h-3 ${
                            isLight ? 'text-blue-700' : 'text-cyan-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{item.customerNotes ? 'Edit note' : 'Add note'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeReport(item.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                          isLight
                            ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                            : 'text-red-300 bg-red-950/60 hover:bg-red-900/70 border border-red-800/60'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {editingId === item.id ? (
                    <div
                      className={`mt-3 p-3 rounded-lg space-y-2 ${
                        isLight
                          ? 'bg-white border border-slate-200'
                          : 'bg-[#060B18] border border-slate-700'
                      }`}
                    >
                      <textarea
                        rows={2}
                        maxLength={MAX_NOTES_LENGTH}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Add a personal reminder (e.g., 'Cancel before Nov 15 renewal date')..."
                        className={`w-full p-2 text-xs rounded-md focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600'
                            : 'bg-[#0F172A] border border-slate-700 text-white placeholder:text-slate-400 focus:border-cyan-400'
                        }`}
                      />
                      <div
                        className={`flex items-center justify-between text-xs ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {notesDraft.length}/{MAX_NOTES_LENGTH} characters
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className={`px-2.5 py-1 text-xs font-medium cursor-pointer ${
                              isLight
                                ? 'text-slate-600 hover:text-slate-900'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingNoteId === item.id}
                            onClick={() => handleSaveNotes(item.id)}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                              isLight
                                ? 'text-white bg-blue-700 hover:bg-blue-800'
                                : 'text-slate-950 bg-cyan-400 hover:bg-cyan-300'
                            }`}
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Save note</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    item.customerNotes && (
                      <div
                        className={`mt-2 p-2.5 rounded-md text-xs ${
                          isLight
                            ? 'bg-white border border-slate-200 text-slate-700'
                            : 'bg-[#060B18]/90 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <strong
                          className={`font-semibold ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          Your note:
                        </strong>{' '}
                        {item.customerNotes}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

