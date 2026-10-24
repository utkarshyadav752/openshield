/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Feature 3 — Upload & Analyze Documents + Policy Version Comparison
 * Allows customers to upload a PDF, upload a photographed/printed contract image,
 * paste plain text, or compare two versions of a policy (Version A vs. Version B)
 * to detect newly added, removed, or modified clauses in plain English.
 */

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  FileCheck2,
  FileImage,
  FileText,
  GitCompare,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  comparePolicyDocuments,
  DocumentComparisonReport,
  SAMPLE_COMPARISON_VERSION_A,
  SAMPLE_COMPARISON_VERSION_B,
} from '../../shared/comparison/document-diff';
import { AnalysisReport, RiskLevel } from '../../shared/schemas/analysis';
import { upgradeReportWithBrowserOllamaIfNeeded } from '../utils/ollamaBrowserBridge';
import { AnalysisReportView } from './AnalysisReportView';
import { LocalAiStatusBanner } from './LocalAiStatusBanner';
import { SavedReportsVault } from './SavedReportsVault';

type UploadTab = 'pdf' | 'image' | 'text' | 'compare';

interface SelectedFileState {
  file: File;
  name: string;
  sizeBytes: number;
  mimeType: string;
  base64Data: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 150000;

const SAMPLE_PASTED_CONTRACT = `Section 1. Subscription Renewal & Non-Refundable Fees
Your subscription of $29.99 per month automatically renews each billing cycle at the then-current rate unless you cancel at least 30 days prior to the renewal date. All subscription fees, setup charges of $15.00, and annual plans are strictly non-refundable and no partial refunds or credits will be issued upon cancellation.

Section 2. Unilateral Modifications & Liability Cap
We reserve the right to modify, amend, or change these Terms at our sole discretion at any time without prior notice to you. In no event shall the Company be liable for any indirect, incidental, or consequential damages, and our total aggregate liability under this Agreement shall not exceed $25.00.

Section 3. Mandatory Arbitration, Class Waiver & Non-Disparagement
Any dispute arising out of or relating to this Agreement shall be resolved exclusively by binding individual arbitration, and you waive any right to participate in a class action. You agree not to post negative public reviews and agree to pay liquidated damages of $2,500 per violation.`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DocumentAnalyzerSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UploadTab>('pdf');
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [extractedPreviewText, setExtractedPreviewText] = useState<string | null>(null);
  const [extractedPageCount, setExtractedPageCount] = useState<number | undefined>(undefined);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [versionALabel, setVersionALabel] = useState('Version A — Previous Terms (v1.0)');
  const [versionBLabel, setVersionBLabel] = useState('Version B — Updated Terms (v2.0)');
  const [versionAText, setVersionAText] = useState('');
  const [versionBText, setVersionBText] = useState('');
  const [comparisonReport, setComparisonReport] = useState<DocumentComparisonReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSwitchTab = (tab: UploadTab) => {
    setActiveTab(tab);
    setSelectedFile(null);
    setExtractedPreviewText(null);
    setExtractedPageCount(undefined);
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateAndReadFile = (file: File) => {
    setErrorMessage(null);
    setReport(null);
    setExtractedPreviewText(null);
    setExtractedPageCount(undefined);

    if (file.size === 0) {
      setSelectedFile(null);
      setErrorMessage('The selected file is empty (0 bytes). Please choose a valid document.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setErrorMessage(
        `File size (${formatBytes(file.size)}) exceeds the 10 MB limit. Please upload a smaller file or paste the text directly.`
      );
      return;
    }

    const lowerName = file.name.toLowerCase();
    const mime = (file.type || '').toLowerCase();

    if (activeTab === 'pdf') {
      const isPdf = lowerName.endsWith('.pdf') || mime === 'application/pdf';
      if (!isPdf) {
        setSelectedFile(null);
        setErrorMessage(
          'Unsupported file format for the PDF tab. Please select a .pdf file, or switch to the Image tab for photos.'
        );
        return;
      }
    } else if (activeTab === 'image') {
      const isImage =
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp') ||
        ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime);
      if (!isImage) {
        setSelectedFile(null);
        setErrorMessage(
          'Unsupported image format. Please select a .jpg, .jpeg, .png, or .webp image.'
        );
        return;
      }
    }

    setIsReadingFile(true);
    setUploadProgress(20);

    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 100));
        setUploadProgress(pct);
      }
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      setUploadProgress(0);
      setErrorMessage('Unable to read the selected file. Please try again.');
    };
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      setUploadProgress(100);
      setIsReadingFile(false);
      setSelectedFile({
        file,
        name: file.name,
        sizeBytes: file.size,
        mimeType:
          file.type ||
          (activeTab === 'pdf' ? 'application/pdf' : 'image/png'),
        base64Data: resultStr,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndReadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndReadFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExtractedPreviewText(null);
    setExtractedPageCount(undefined);
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExtractPreviewText = async () => {
    if (!selectedFile) return;
    setErrorMessage(null);
    setIsExtractingText(true);
    try {
      const res = await fetch('/api/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeTab === 'pdf' ? 'pdf' : 'image',
          fileName: selectedFile.name,
          mimeType: selectedFile.mimeType,
          fileSize: selectedFile.sizeBytes,
          base64Data: selectedFile.base64Data,
          title: selectedFile.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.extractedText) {
        setErrorMessage(
          data.errorMessage ||
            'Could not extract text from this file. Please try another document or paste the text directly.'
        );
        return;
      }
      setExtractedPreviewText(data.extractedText);
      setExtractedPageCount(data.pageCount);
    } catch {
      setErrorMessage(
        'Network error while extracting text from the uploaded file. Please try again.'
      );
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleLoadSampleBinaryFile = async (type: 'pdf' | 'image') => {
    setErrorMessage(null);
    setReport(null);
    setIsReadingFile(true);
    setUploadProgress(35);

    try {
      const res = await fetch(`/api/sample-document/${type}`);
      if (!res.ok) {
        throw new Error('Failed to load sample document');
      }
      const blob = await res.blob();
      const fileName =
        type === 'pdf'
          ? 'ApexCloud_Enterprise_Terms_2026.pdf'
          : 'FitPulse_Membership_Contract_Scan.png';
      const mimeType = type === 'pdf' ? 'application/pdf' : 'image/png';
      const sampleFile = new File([blob], fileName, { type: mimeType });
      validateAndReadFile(sampleFile);
    } catch {
      setIsReadingFile(false);
      setUploadProgress(0);
      setErrorMessage('Unable to load the sample file. Please try pasting text instead.');
    }
  };

  const handleAnalyzeDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (activeTab === 'compare') {
      const aTrim = versionAText.trim();
      const bTrim = versionBText.trim();
      if (aTrim.length < 25 || bTrim.length < 25) {
        setErrorMessage(
          'Please provide at least one complete paragraph (minimum 25 characters) in both Version A and Version B to compare policy changes.'
        );
        return;
      }
      const diffResult = comparePolicyDocuments(aTrim, bTrim);
      setComparisonReport(diffResult);
      return;
    }

    if (activeTab === 'text') {
      const trimmed = pastedText.trim();
      if (!trimmed || trimmed.length < 30) {
        setErrorMessage(
          'Please paste at least one complete clause or paragraph of legal text (minimum 30 characters).'
        );
        return;
      }
      if (trimmed.length > MAX_TEXT_CHARS) {
        setErrorMessage(
          `Pasted text exceeds the ${MAX_TEXT_CHARS.toLocaleString()}-character limit. Please paste the relevant sections.`
        );
        return;
      }
    } else {
      if (!selectedFile) {
        setErrorMessage(
          `Please select or drag and drop a ${
            activeTab === 'pdf' ? 'PDF document' : 'contract image'
          } before clicking "Analyze document".`
        );
        return;
      }
      if (extractedPreviewText !== null && extractedPreviewText.trim().length < 30) {
        setErrorMessage(
          'The reviewed extracted text is too short (minimum 30 characters). Please keep at least one complete clause.'
        );
        return;
      }
    }

    setIsAnalyzing(true);
    try {
      const payload =
        activeTab === 'text'
          ? {
              mode: 'text' as const,
              text: pastedText.trim(),
              title: documentTitle.trim() || 'Pasted Terms & Conditions',
            }
          : extractedPreviewText !== null
          ? {
              mode: 'text' as const,
              text: extractedPreviewText.trim(),
              fileName: selectedFile!.name,
              title: selectedFile!.name,
            }
          : {
              mode: activeTab,
              fileName: selectedFile!.name,
              mimeType: selectedFile!.mimeType,
              fileSize: selectedFile!.sizeBytes,
              base64Data: selectedFile!.base64Data,
              title: selectedFile!.name,
            };

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.report) {
        setErrorMessage(
          data.errorMessage ||
            'Unable to analyze this document. Please check that the file contains readable legal text or paste the text directly.'
        );
        return;
      }

      const finalReport = await upgradeReportWithBrowserOllamaIfNeeded(
        data.report
      );
      setReport(finalReport);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('openshield:ollama-refresh'));
      }
    } catch {
      setErrorMessage(
        'Network error while communicating with the document analyzer. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeAnother = () => {
    setReport(null);
    setComparisonReport(null);
    setSelectedFile(null);
    setExtractedPreviewText(null);
    setExtractedPageCount(undefined);
    setPastedText('');
    setDocumentTitle('');
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getRiskStyle = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL:
        return 'text-red-700 font-semibold';
      case RiskLevel.HIGH:
        return 'text-red-600 font-semibold';
      case RiskLevel.MEDIUM:
        return 'text-amber-700 font-semibold';
      default:
        return 'text-blue-700 font-semibold';
    }
  };

  return (
    <section
      id="upload-document"
      className="py-16 md:py-24 bg-white border-t border-slate-200"
    >
      <div className="max-w-[1160px] mx-auto px-6">
        {/* Section Heading */}
        <div className="max-w-3xl mb-8">
          <div className="text-xs font-semibold text-blue-700 mb-2">
            03. Document &amp; Text Intelligence (PDF · OCR Image · Plain Text · Policy Diff)
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Upload a document. Understand the fine print.
          </h2>
          <p className="text-base text-slate-600 mt-2 leading-relaxed">
            Upload a PDF, snap a photo, paste your Terms &amp; Conditions, or compare two policy versions side by side. OpenShield extracts the text locally, lets you review it, and runs local Ollama (gemma3:1b) + deterministic rule analysis.
          </p>
        </div>

        {/* Upper Side of Document Analyze Section: Optional Private Cloud History + Local AI Status */}
        <div className="mb-6 space-y-4">
          <SavedReportsVault variant="light" id="document-saved-reports-vault" />
          <LocalAiStatusBanner variant="light" testId="doc-local-ai-status" />
        </div>

        {/* Upload Card */}
        <div
          data-testid="document-upload-card"
          className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 md:p-8 shadow-xs"
        >
          {/* Four Selectable Tabs: PDF | Image | Paste Text | Compare Versions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div
              role="tablist"
              aria-label="Document input mode"
              className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/75 rounded-lg self-start"
            >
              {(
                [
                  { id: 'pdf', label: 'PDF', icon: FileText },
                  { id: 'image', label: 'Image', icon: FileImage },
                  { id: 'text', label: 'Paste Text', icon: Sparkles },
                  { id: 'compare', label: 'Compare Versions', icon: GitCompare },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    data-testid={`doc-tab-${tab.id}`}
                    onClick={() => handleSwitchTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Sample Loader for Instant Verification */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Try a realistic example:</span>
              {activeTab === 'pdf' && (
                <button
                  type="button"
                  data-testid="load-sample-pdf-btn"
                  onClick={() => handleLoadSampleBinaryFile('pdf')}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Load sample 2-page PDF
                </button>
              )}
              {activeTab === 'image' && (
                <button
                  type="button"
                  data-testid="load-sample-image-btn"
                  onClick={() => handleLoadSampleBinaryFile('image')}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Load sample contract scan (.png)
                </button>
              )}
              {activeTab === 'text' && (
                <button
                  type="button"
                  data-testid="load-sample-text-btn"
                  onClick={() => {
                    setErrorMessage(null);
                    setDocumentTitle('Sample SaaS & Membership Agreement');
                    setPastedText(SAMPLE_PASTED_CONTRACT);
                  }}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Load sample contract text
                </button>
              )}
              {activeTab === 'compare' && (
                <button
                  type="button"
                  data-testid="load-sample-comparison-btn"
                  onClick={() => {
                    setErrorMessage(null);
                    setVersionALabel('Version A — 2025 Standard Plan (₹799/mo)');
                    setVersionBLabel('Version B — 2026 Updated Policy (₹999/mo + Arbitration)');
                    setVersionAText(SAMPLE_COMPARISON_VERSION_A);
                    setVersionBText(SAMPLE_COMPARISON_VERSION_B);
                    const result = comparePolicyDocuments(
                      SAMPLE_COMPARISON_VERSION_A,
                      SAMPLE_COMPARISON_VERSION_B
                    );
                    setComparisonReport(result);
                  }}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Load sample v1.0 vs v2.0 policy update
                </button>
              )}
            </div>
          </div>

          {/* Tab Content Area */}
          <form onSubmit={handleAnalyzeDocument} className="mt-6">
            {(activeTab === 'pdf' || activeTab === 'image') && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    activeTab === 'pdf'
                      ? '.pdf,application/pdf'
                      : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
                  }
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="document-file-input"
                />

                {/* Large Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  data-testid="document-dropzone"
                  className={`border-2 border-dashed rounded-xl p-8 md:p-10 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50/60'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                    <UploadCloud
                      className="w-6 h-6 text-blue-700"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="font-display text-base font-bold text-slate-900">
                    Drag and drop your file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    {activeTab === 'pdf'
                      ? 'Upload a Terms & Conditions PDF, subscription contract, or privacy policy'
                      : 'Upload a clear photo or screenshot of printed legal terms'}
                  </p>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Browse files
                  </button>

                  <p className="text-xs text-slate-500 mt-4">
                    {activeTab === 'pdf'
                      ? 'Supported format: .pdf (embedded text or scanned pages) · Max file size: 10 MB'
                      : 'Supported formats: .jpg, .jpeg, .png, .webp · Max file size: 10 MB'}
                  </p>
                </div>

                {/* Upload Progress Bar */}
                {(isReadingFile || (uploadProgress > 0 && uploadProgress < 100)) && (
                  <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 tabular-nums">
                      <span>Preparing file for analysis…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Selected File Summary Card */}
                {selectedFile && (
                  <div
                    data-testid="selected-file-card"
                    className="mt-4 p-4 bg-white border border-slate-200 rounded-lg space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileCheck2
                          className="w-5 h-5 text-emerald-600 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {selectedFile.name}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            <span>Size: {formatBytes(selectedFile.sizeBytes)}</span>
                            <span aria-hidden="true"> · </span>
                            <span>Type: {selectedFile.mimeType}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="text-emerald-700 font-medium">
                              Ready to analyze ({uploadProgress}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleExtractPreviewText}
                          disabled={isExtractingText}
                          data-testid="extract-preview-text-btn"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {isExtractingText ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              <span>Extracting text…</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {extractedPreviewText !== null
                                  ? 'Re-extract text'
                                  : 'Review extracted text first'}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          data-testid="remove-file-btn"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove file</span>
                        </button>
                      </div>
                    </div>

                    {/* Editable Extracted Text Review Panel before sending to gemma3:1b */}
                    {extractedPreviewText !== null && (
                      <div
                        data-testid="extracted-text-review-panel"
                        className="pt-3 border-t border-slate-200 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <label
                            htmlFor="extracted-preview-textarea"
                            className="font-semibold text-slate-800"
                          >
                            Extracted Document Text (Review or Edit Before Sending to Local gemma3:1b)
                            {extractedPageCount ? ` · ${extractedPageCount} page(s)` : ''}
                          </label>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {extractedPreviewText.length.toLocaleString()} characters extracted locally
                          </span>
                        </div>
                        <textarea
                          id="extracted-preview-textarea"
                          data-testid="extracted-preview-textarea"
                          rows={6}
                          value={extractedPreviewText}
                          onChange={(e) => setExtractedPreviewText(e.target.value)}
                          className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-2 focus:outline-blue-700 leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Paste Text Tab */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="doc-title-input"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Document Title (optional)
                  </label>
                  <input
                    id="doc-title-input"
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="e.g., CloudVault Annual Subscription Agreement"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-700"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="doc-paste-textarea"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Paste Terms &amp; Conditions, Privacy Policy, or Contract Text
                    </label>
                    <span
                      data-testid="paste-char-counter"
                      className="font-mono text-xs text-slate-500 tabular-nums"
                    >
                      {pastedText.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
                    </span>
                  </div>
                  <textarea
                    id="doc-paste-textarea"
                    data-testid="doc-paste-textarea"
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste the full text or relevant sections of your legal agreement here..."
                    className="w-full p-4 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-700 leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Compare Two Versions Tab */}
            {activeTab === 'compare' && (
              <div className="space-y-4" data-testid="compare-versions-panel">
                <p className="text-xs text-slate-600">
                  Paste two versions of a Terms &amp; Conditions or Privacy Policy document below to detect newly added clauses, removed consumer rights, or modified pricing, renewal, cancellation, data-sharing, and arbitration terms.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="version-a-label"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Version A (Baseline / Previous Policy)
                    </label>
                    <input
                      id="version-a-label"
                      type="text"
                      value={versionALabel}
                      onChange={(e) => setVersionALabel(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                    <textarea
                      aria-label="Version A policy text"
                      data-testid="version-a-textarea"
                      rows={8}
                      value={versionAText}
                      onChange={(e) => setVersionAText(e.target.value)}
                      placeholder="Paste the earlier version of the policy here..."
                      className="w-full p-3.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-700 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="version-b-label"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Version B (Updated / New Policy)
                    </label>
                    <input
                      id="version-b-label"
                      type="text"
                      value={versionBLabel}
                      onChange={(e) => setVersionBLabel(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                    <textarea
                      aria-label="Version B policy text"
                      data-testid="version-b-textarea"
                      rows={8}
                      value={versionBText}
                      onChange={(e) => setVersionBText(e.target.value)}
                      placeholder="Paste the updated version of the policy here..."
                      className="w-full p-3.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-700 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Friendly Validation / Processing Error Message */}
            {errorMessage && (
              <div
                role="alert"
                data-testid="document-error-banner"
                className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-xs sm:text-sm text-red-900"
              >
                <AlertCircle
                  className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Privacy Notice & Analyze Document Action Row */}
            <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 text-xs text-slate-600 max-w-2xl">
                <Lock
                  className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold text-slate-800">
                    Privacy-First Document Handling:
                  </strong>{' '}
                  Uploaded PDFs, images, and pasted agreements are processed strictly for clause analysis, never used for advertising or tracking, and discarded immediately from server memory after your report is generated.
                </span>
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || isReadingFile}
                data-testid={
                  activeTab === 'compare'
                    ? 'compare-versions-btn'
                    : 'analyze-document-btn'
                }
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Analyzing document…</span>
                  </>
                ) : activeTab === 'compare' ? (
                  <span>Compare versions</span>
                ) : (
                  <span>Analyze document</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Policy Comparison Report View (when Compare Versions tab is used) */}
        {activeTab === 'compare' && comparisonReport && (
          <div
            data-testid="document-comparison-report"
            className="mt-8 bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-xs"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  Policy Change Intelligence · {versionALabel} → {versionBLabel}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Policy Version Comparison Report
                </h3>
                <p className="text-sm text-slate-700 mt-1">
                  {comparisonReport.identicalMeaning
                    ? comparisonReport.formattingOnlyDifference
                      ? 'Only whitespace or formatting differences were detected; the contractual text is identical.'
                      : 'Both policy versions have identical clause wording.'
                    : `Detected ${comparisonReport.totalChanges} clause change(s): ${comparisonReport.counts.added} added, ${comparisonReport.counts.modified} modified, and ${comparisonReport.counts.removed} removed.`}
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-xs tabular-nums shrink-0">
                <div>
                  <span className="text-red-700 font-bold">Added:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {comparisonReport.counts.added}
                  </span>
                </div>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <div>
                  <span className="text-amber-700 font-bold">Modified:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {comparisonReport.counts.modified}
                  </span>
                </div>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <div>
                  <span className="text-emerald-700 font-bold">Removed:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {comparisonReport.counts.removed}
                  </span>
                </div>
              </div>
            </div>

            {comparisonReport.entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-600">
                No material differences in clauses were detected between these two versions.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 mt-4">
                {comparisonReport.entries.map((diff) => (
                  <article key={diff.id} className="py-5 first:pt-2 last:pb-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5">
                      <span
                        className={
                          diff.changeType === 'added'
                            ? 'font-bold text-red-700 uppercase'
                            : diff.changeType === 'modified'
                            ? 'font-bold text-amber-700 uppercase'
                            : 'font-bold text-emerald-700 uppercase'
                        }
                      >
                        [{diff.changeType}]
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">
                        {diff.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-500">
                        Section: {diff.sectionHeading}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-900 mb-3">
                      {diff.summary}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="font-semibold text-slate-600 mb-1">
                          {versionALabel}
                        </div>
                        {diff.beforeText ? (
                          <blockquote className="text-slate-800 italic leading-relaxed">
                            “{diff.beforeText}”
                          </blockquote>
                        ) : (
                          <span className="text-slate-400">
                            Not present in {versionALabel}
                          </span>
                        )}
                      </div>

                      <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-lg">
                        <div className="font-semibold text-blue-900 mb-1 inline-flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                          <span>{versionBLabel}</span>
                        </div>
                        {diff.afterText ? (
                          <blockquote className="text-slate-900 italic leading-relaxed">
                            “{diff.afterText}”
                          </blockquote>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            Clause removed in {versionBLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed Document Analysis Results View */}
        {activeTab !== 'compare' && report && (
          <AnalysisReportView
            report={report}
            isRescanning={isAnalyzing}
            onRescan={() => handleAnalyzeDocument()}
            onAnalyzeAnother={handleAnalyzeAnother}
            testId="document-analysis-report"
          />
        )}
      </div>
    </section>
  );
};
