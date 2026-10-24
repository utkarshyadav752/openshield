/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Main Application
 * Exclusively presents the two non-negotiable consumer protection features:
 * 1. Paste a link (or policy text) and analyze it
 * 2. Live Chrome Extension (Manifest V3)
 * Zero public admin, owner, or internal configuration controls.
 */

import React, { useRef } from 'react';
import { ChromeExtensionSection } from './components/ChromeExtensionSection';
import { DocumentAnalyzerSection } from './components/DocumentAnalyzerSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { UrlAnalyzerSection } from './components/UrlAnalyzerSection';
import { FirebaseProvider } from './context/FirebaseContext';

export default function App() {
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const handleFocusAnalyzer = () => {
    const section = document.getElementById('analyze-link');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      urlInputRef.current?.focus({ preventScroll: true });
    }, 200);
  };

  return (
    <FirebaseProvider>
      <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
        <Header onFocusAnalyzer={handleFocusAnalyzer} />

        <main className="flex-1">
          {/* Feature 1: Paste a link and analyze it (with Private Saved Reports Vault on upper side) */}
          <UrlAnalyzerSection urlInputRef={urlInputRef} />

          {/* Feature 2: Live Browser Extension */}
          <ChromeExtensionSection />

          {/* Feature 3: Upload & Analyze Documents */}
          <DocumentAnalyzerSection />
        </main>

        <Footer />
      </div>
    </FirebaseProvider>
  );
}
