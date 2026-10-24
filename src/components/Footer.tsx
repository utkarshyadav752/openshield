/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Customer Footer & Open-Source Rulebook Transparency Engine
 * Includes interactive Rulebook Inspector for all 17 detection rules with
 * version, license, matching logic, evidence requirements, and false-positive notes.
 */

import React, { useState } from 'react';
import { BookOpenCheck, X } from 'lucide-react';
import { DETECTION_RULES } from '../../shared/rules/clause-rules';
import { BrandLogo } from './BrandLogo';

type FooterModalType = 'docs' | 'privacy' | 'source' | 'issues' | 'rulebook' | null;

export const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<FooterModalType>(null);
  const [ruleSearch, setRuleSearch] = useState('');

  const filteredRules = DETECTION_RULES.filter((rule) => {
    const q = ruleSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      rule.id.toLowerCase().includes(q) ||
      rule.title.toLowerCase().includes(q) ||
      rule.category.toLowerCase().includes(q) ||
      rule.taxonomy.toLowerCase().includes(q)
    );
  });

  return (
    <footer className="bg-[#060B18] border-t border-slate-800 py-12 text-slate-300">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <BrandLogo size="md" variant="dark" />
          <p className="text-xs text-slate-400 mt-2 max-w-md">
            Open-source AI consumer protection for website terms, subscription policies, and dark patterns. Released under the MIT License.
          </p>
        </div>

        <nav
          aria-label="Footer customer links"
          className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            data-testid="open-rulebook-btn"
            onClick={() => setActiveModal('rulebook')}
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            <BookOpenCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Open-Source Rulebook ({DETECTION_RULES.length} rules)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('docs')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Documentation
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('privacy')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Privacy policy
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('source')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Source repository
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('issues')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Issue reporting
          </button>
        </nav>
      </div>

      {/* Customer Reference & Open-Source Rulebook Modal */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="footer-modal-title"
          data-testid={activeModal === 'rulebook' ? 'rulebook-modal' : 'footer-modal'}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            className={`bg-white border border-slate-200 rounded-xl w-full max-h-[88vh] overflow-y-auto p-6 md:p-8 shadow-lg ${
              activeModal === 'rulebook' ? 'max-w-4xl' : 'max-w-2xl'
            }`}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3
                  id="footer-modal-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  {activeModal === 'rulebook' &&
                    `OpenShield Open-Source Detection Rulebook (${DETECTION_RULES.length} Auditable Rules)`}
                  {activeModal === 'docs' && 'OpenShield Architecture & Documentation'}
                  {activeModal === 'privacy' && 'Privacy Policy & Data Handling Architecture'}
                  {activeModal === 'source' && 'Open-Source Repository & Attribution'}
                  {activeModal === 'issues' && 'Reporting False Positives & Security Issues'}
                </h3>
                {activeModal === 'rulebook' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Every rule in OpenShield is publicly documented with its version, matching logic summary, evidence requirements, false-positive exclusions, and academic/statutory references.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeModal === 'rulebook' && (
              <div className="space-y-4">
                <div>
                  <input
                    type="search"
                    value={ruleSearch}
                    onChange={(e) => setRuleSearch(e.target.value)}
                    placeholder="Filter rules by ID, category, title, or dark pattern taxonomy..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div className="divide-y divide-slate-200 border-t border-b border-slate-200 max-h-[56vh] overflow-y-auto pr-1">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="py-4 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">
                            {rule.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">
                            v{rule.version}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">
                            License: {rule.license}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-700">
                          Risk: {rule.riskLevel} · Taxonomy: {rule.taxonomy}
                        </span>
                      </div>

                      <h4 className="font-display text-sm font-bold text-slate-900">
                        {rule.title}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                          <strong className="text-slate-800 block mb-0.5">
                            Matching Logic Summary:
                          </strong>
                          <span className="text-slate-600">
                            {rule.matchingLogicSummary}
                          </span>
                        </div>
                        <div>
                          <strong className="text-slate-800 block mb-0.5">
                            Evidence Requirements &amp; False-Positive Guards:
                          </strong>
                          <span className="text-slate-600">
                            {rule.evidenceRequirements}{' '}
                            {rule.falsePositiveConsiderations}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-2.5 bg-red-50/50 border border-red-100 rounded">
                          <strong className="text-red-800">Positive Trigger Example:</strong>{' '}
                          <span className="italic text-slate-700">
                            “{rule.positiveExample}”
                          </span>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded">
                          <strong className="text-emerald-800">
                            Benign Exclusion Example (Not Flagged):
                          </strong>{' '}
                          <span className="italic text-slate-700">
                            “{rule.negativeExample}”
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        <strong>References:</strong> {(rule.sourceReferences || []).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModal === 'docs' && (
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <p>
                  <strong>Three Core Capabilities:</strong> OpenShield provides a public URL &amp; Policy Analyzer, a Document &amp; Policy Version Comparator (PDF, OCR Image, Plain Text, and Version Diff), and a Manifest V3 browser extension for Chrome, Brave, and Edge.
                </p>
                <p>
                  <strong>Evidence-First Hybrid Pipeline:</strong> Every document is scanned by OpenShield’s deterministic rule engine (<code className="font-mono text-xs bg-slate-100 px-1 rounded">shared/rules/clause-rules.ts</code>) across 17 consumer risk categories, paired with the Hidden Cost Calculator (<code className="font-mono text-xs bg-slate-100 px-1 rounded">shared/calculators/cost-calculator.ts</code>) and Action Plan generator. When server-side Gemini AI is configured, up to 15,000 characters of visible text are cross-checked for nuanced clauses, and every AI-extracted finding is verified to ensure its supporting quote exists verbatim in the source text.
                </p>
                <p>
                  <strong>SSRF &amp; Prompt-Injection Hardening:</strong> User-supplied URLs are validated against private IPv4/IPv6 ranges, loopback addresses, link-local cloud metadata endpoints, and unsafe redirects. Untrusted document text is sanitized against adversarial prompt-injection instructions prior to analysis.
                </p>
              </div>
            )}

            {activeModal === 'privacy' && (
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <p>
                  <strong>Browser Extension Privacy:</strong> The OpenShield browser extension performs all DOM text scanning, <code className="font-mono text-xs bg-slate-100 px-1 rounded">MutationObserver</code> inspection, and <code className="font-mono text-xs bg-slate-100 px-1 rounded">getComputedStyle</code> button comparisons 100% locally inside your browser. It requests only <code className="font-mono text-xs bg-slate-100 px-1 rounded">activeTab</code>, <code className="font-mono text-xs bg-slate-100 px-1 rounded">storage</code>, and <code className="font-mono text-xs bg-slate-100 px-1 rounded">scripting</code> permissions and never transmits your browsing history.
                </p>
                <p>
                  <strong>Website URL &amp; Document Analyzer Privacy:</strong> Uploaded PDFs, images, and pasted text are processed in memory solely to generate your report and are discarded immediately after processing. Reports are never stored in the cloud unless you explicitly sign in and click "Save report".
                </p>
              </div>
            )}

            {activeModal === 'source' && (
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <p>
                  <strong>Monorepo Structure:</strong> OpenShield is organized into <code className="font-mono text-xs bg-slate-100 px-1 rounded">/shared</code> (schemas, rules, calculators, diff engine, datasets), <code className="font-mono text-xs bg-slate-100 px-1 rounded">/extension</code> (Manifest V3 browser extension), <code className="font-mono text-xs bg-slate-100 px-1 rounded">/server</code> (SSRF-hardened URL fetcher, PDF/OCR extractor, and hybrid analyzer), <code className="font-mono text-xs bg-slate-100 px-1 rounded">/src</code>, and <code className="font-mono text-xs bg-slate-100 px-1 rounded">/tests</code>.
                </p>
                <p>
                  <strong>Open-Source Acknowledgements:</strong> Known service summaries and cancellation difficulty schemas draw inspiration from community projects including ToS;DR (CC BY-SA 3.0), JustDeleteMe (MIT), CCPA Dark Patterns Guidelines (India, 2023), and academic dark-pattern taxonomy research (Mathur et al., Princeton University). OpenShield is an independent project and claims no formal affiliation with these initiatives.
                </p>
              </div>
            )}

            {activeModal === 'issues' && (
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <p>
                  <strong>Reporting False Positives or Missed Clauses:</strong> Because contractual language evolves rapidly, you can flag any finding locally using the "Flag false positive" control on any report card, or contribute rule refinements in <code className="font-mono text-xs bg-slate-100 px-1 rounded">shared/rules/clause-rules.ts</code>. When reporting a false positive or missed clause, please include:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>The exact sentence or paragraph that triggered (or should have triggered) a rule.</li>
                  <li>The rule identifier (e.g., <code className="font-mono text-xs bg-slate-100 px-1 rounded">RULE_AUTO_RENEWAL</code>).</li>
                  <li>A unit test case verifying both positive matching and false-positive exclusion.</li>
                </ul>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
