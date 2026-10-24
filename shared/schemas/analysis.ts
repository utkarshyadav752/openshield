/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Shared Schemas & Type Definitions
 * Used across the backend analyzer, document uploader, public website, and browser extension.
 */

import type { ActionPlanItem } from '../calculators/action-plan';
import type { HiddenCostEstimate } from '../calculators/cost-calculator';
import type { IndiaLegalReference } from '../datasets/india-consumer-law';

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum ConfidenceLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum DetectionSource {
  RULE_ENGINE = 'Deterministic Rule Engine',
  HYBRID_AI = 'AI-Verified Clause Extraction',
  COMPUTED_STYLE = 'DOM & Computed-Style Inspection',
}

export enum FindingNature {
  DETECTED_CLAUSE = 'Detected Clause',
  INFERRED_RISK = 'Inferred Pattern Risk',
}

export enum ClauseCategory {
  HIDDEN_FEES = 'Hidden fees and unexpected charges',
  AUTO_RENEWAL = 'Automatic subscription renewal',
  CANCELLATION_RESTRICTIONS = 'Difficult cancellation and refund restrictions',
  NON_REFUNDABLE = 'Non-refundable payments and restrictive refund policies',
  FORCED_ARBITRATION = 'Forced arbitration clauses',
  CLASS_ACTION_WAIVER = 'Class-action waivers',
  DATA_SHARING = 'Broad third-party data-sharing or selling provisions',
  CONTENT_LICENSE = 'Broad or perpetual content licenses',
  UNILATERAL_CHANGES = 'Unilateral changes to terms',
  LIABILITY_LIMITATIONS = 'Excessive liability limitations',
  PRESELECTED_ADDONS = 'Preselected paid add-ons',
  COUNTDOWN_SCARCITY = 'Misleading countdown timers and scarcity claims',
  CONFIRM_SHAMING = 'Confirm-shaming and manipulative consent interfaces',
  TRIAL_CONVERSION = 'Unexpected trial-to-paid conversions',
  ACCOUNT_DELETION = 'Account suspension, termination, or deletion restrictions',
  DISPUTE_RESTRICTIONS = 'Excessively restrictive dispute-resolution provisions',
  UNUSUAL_PENALTIES = 'Unusual penalties or contractual obligations',
}

export enum DarkPatternTaxonomy {
  URGENCY = 'Urgency',
  SCARCITY = 'Scarcity',
  SOCIAL_PROOF = 'Social proof',
  SNEAKING = 'Sneaking and hidden costs',
  CONFIRM_SHAMING = 'Confirm-shaming',
  VISUAL_INTERFERENCE = 'Visual interference',
  MISDIRECTION = 'Misdirection',
  SUBSCRIPTION_FRICTION = 'Subscription and cancellation friction',
  LEGAL_TERMS = 'Contractual & Privacy Terms',
}

export interface AnalysisFinding {
  id: string;
  ruleId: string;
  title: string;
  titleHi?: string;
  category: ClauseCategory;
  taxonomy: DarkPatternTaxonomy;
  riskLevel: RiskLevel;
  nature: FindingNature;
  explanation: string;
  explanationHi?: string;
  evidenceQuote: string;
  sectionLocation: string;
  pageNumber?: number;
  whyItMatters: string;
  whyItMattersHi?: string;
  whatRemainsUnclear?: string;
  whatRemainsUnclearHi?: string;
  whatToCheck: string;
  whatToCheckHi?: string;
  confidence: ConfidenceLevel;
  limitations: string;
  source: DetectionSource;
  originalSourceReference?: string;
  indiaLegalContext?: IndiaLegalReference;
}

export enum CancellationDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  IMPOSSIBLE = 'impossible',
}

export interface KnownServiceRecord {
  domain: string;
  name: string;
  tosdrGrade?: 'A' | 'B' | 'C' | 'D' | 'E';
  tosdrSummary: string;
  tosdrSourceUrl: string;
  cancellationDifficulty: CancellationDifficulty;
  cancellationSummary: string;
  verifiedCancellationUrl?: string;
  verifiedPolicyUrl?: string;
  lastVerified: string;
  attribution: string;
  limitations: string;
}

export interface DiscoveredPolicyLink {
  label: string;
  url: string;
  type: 'terms' | 'privacy' | 'refunds' | 'subscription' | 'cancellation';
  verifiedSameDomain: boolean;
}

export interface RiskCounts {
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
  total: number;
}

export interface LocalAiRuntimeReportStatus {
  provider: 'ollama';
  model: string;
  baseUrl: string;
  status:
    | 'succeeded'
    | 'ollama_offline'
    | 'model_missing'
    | 'invalid_response'
    | 'timeout'
    | 'skipped';
  aiFindingsCount: number;
  latencyMs?: number;
  errorMessage?: string;
  troubleshootingCommand?: string;
}

export interface AnalysisReport {
  reportId: string;
  targetUrl?: string;
  domain?: string;
  title: string;
  documentType?: 'url' | 'pdf' | 'image' | 'text';
  fileName?: string;
  pageCount?: number;
  clausesAnalyzedCount: number;
  extractedText?: string;
  promptInjectionDetected?: boolean;
  scanStatus: 'completed' | 'partial' | 'fallback_text';
  timestamp: string;
  analysisMode: 'hybrid_ai_and_rules' | 'rule_based_only';
  aiDisclosure: string;
  localAiStatus?: LocalAiRuntimeReportStatus;
  overallRiskLevel: RiskLevel | 'Minimal';
  overallSummary: string;
  overallSummaryHi?: string;
  legalDisclaimer: string;
  counts: RiskCounts;
  findings: AnalysisFinding[];
  hiddenCostEstimate?: HiddenCostEstimate;
  actionPlan?: ActionPlanItem[];
  knownService?: KnownServiceRecord;
  discoveredLinks: DiscoveredPolicyLink[];
  analyzedCharCount: number;
}

export interface DetectionRule {
  id: string;
  version?: string;
  title: string;
  category: ClauseCategory;
  taxonomy: DarkPatternTaxonomy;
  riskLevel: RiskLevel;
  nature: FindingNature;
  confidence: ConfidenceLevel;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  explanation: string;
  whyItMatters: string;
  whatRemainsUnclear?: string;
  whatToCheck: string;
  limitations: string;
  matchingLogicSummary?: string;
  evidenceRequirements?: string;
  falsePositiveConsiderations?: string;
  sourceReferences?: string[];
  license?: string;
  positiveExample?: string;
  negativeExample?: string;
}
