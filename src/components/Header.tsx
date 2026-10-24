/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Customer Header
 * Features the clean minimal BrandLogo shield symbol directly before "OpenShield",
 * desktop navigation, primary "Analyze Terms" CTA, and a touch-friendly mobile
 * hamburger menu (>= 44x44px tap targets, keyboard & screen-reader accessible).
 */

import React, { useEffect, useState } from 'react';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  onFocusAnalyzer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onFocusAnalyzer }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleMobileNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#060B18]/95 border-b border-slate-800/80 text-white">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Minimal Shield Symbol + OpenShield Brand Name */}
        <a
          href="#top"
          aria-label="OpenShield Home"
          className="inline-flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded-md py-1"
        >
          <BrandLogo size="md" variant="dark" />
        </a>

        {/* Zone 2: Desktop Primary Feature Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
        >
          <a
            href="#analyze-link"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap py-2"
          >
            Analyze a link
          </a>
          <a
            href="#browser-extension"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap py-2"
          >
            Browser extension
          </a>
          <a
            href="#upload-document"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap py-2"
          >
            Upload document
          </a>
          <a
            href="#saved-reports-vault"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap py-2"
          >
            Saved vault
          </a>
        </nav>

        {/* Zone 3: Primary Action + Mobile Hamburger Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="navbar-analyze-cta"
            onClick={() => {
              setMobileMenuOpen(false);
              onFocusAnalyzer();
            }}
            className="px-3.5 sm:px-4 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 active:from-cyan-500 active:to-sky-500 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Analyze Terms
          </button>

          {/* Accessible Mobile Hamburger Toggle (44x44px minimum touch target) */}
          <button
            type="button"
            data-testid="mobile-menu-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg text-slate-200 hover:text-white hover:bg-slate-800/80 border border-slate-700/80 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-nav-drawer"
          data-testid="mobile-nav-drawer"
          aria-label="Mobile navigation"
          className="md:hidden bg-[#0B132B] border-b border-slate-800 px-4 pt-2 pb-4 space-y-1"
        >
          <a
            href="#analyze-link"
            onClick={handleMobileNavClick}
            className="flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors"
          >
            <span>01. Analyze a Website Link</span>
            <span className="text-xs font-mono text-cyan-400">URL Scan</span>
          </a>
          <a
            href="#browser-extension"
            onClick={handleMobileNavClick}
            className="flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors"
          >
            <span>02. Live Browser Extension</span>
            <span className="text-xs font-mono text-cyan-400">Manifest V3</span>
          </a>
          <a
            href="#upload-document"
            onClick={handleMobileNavClick}
            className="flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors"
          >
            <span>03. Upload &amp; Compare Documents</span>
            <span className="text-xs font-mono text-cyan-400">PDF · OCR · Diff</span>
          </a>
          <a
            href="#saved-reports-vault"
            onClick={handleMobileNavClick}
            className="flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors"
          >
            <span>04. Private Saved Reports Vault</span>
            <span className="text-xs font-mono text-emerald-400">Opt-In Cloud</span>
          </a>

          <div className="pt-2 mt-2 border-t border-slate-800 flex items-center gap-2 px-3 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>Privacy-First Consumer Intelligence · Zero Unsolicited Tracking</span>
          </div>
        </nav>
      )}
    </header>
  );
};
