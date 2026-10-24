/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield "Listen to Results" Text-to-Speech (TTS) Audio Controller & UI
 *
 * Capabilities:
 * - Prominent "Listen to Results" toggle button near the analysis results heading
 * - Full playback controls: Play, Pause, Resume, Stop, Replay, Skip Backward, Skip Forward
 * - Playback speed selector (0.75x, 1x, 1.25x, 1.5x, 2x)
 * - Voice / Language selector when browser voices are available
 * - Two listening modes:
 *     1. "Summary" (Default): Concise structured overview of overall risk, top high-risk findings,
 *        action plan, and AI assessment disclaimer.
 *     2. "Full Report": Complete section-by-section walkthrough in priority order.
 * - Synchronizes active spoken section & finding ID with parent report view for live visual highlighting.
 * - Gracefully handles unsupported browsers or headless environments with zero voices, never showing
 *   a false "playing" state when audio cannot be produced.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnalysisReport } from '../../shared/schemas/analysis';
import {
  buildSpokenReportSections,
  ListeningMode,
  SpokenSection,
  splitIntoUtteranceChunks,
} from '../utils/ttsSpeechBuilder';

interface ListenToResultsPanelProps {
  report: AnalysisReport;
  language: 'en' | 'hi';
  onActiveSectionChange?: (section: SpokenSection | null) => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'unavailable';

export const ListenToResultsPanel: React.FC<ListenToResultsPanelProps> = ({
  report,
  language,
  onActiveSectionChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ListeningMode>('summary');
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  const sections = useMemo(
    () => buildSpokenReportSections(report, mode, language),
    [report, mode, language]
  );

  // Refs to coordinate multi-chunk speech synthesis without stale closures
  const playbackSessionRef = useRef(0);
  const statusRef = useRef<PlaybackStatus>('idle');
  const rateRef = useRef<number>(playbackRate);
  const voiceUriRef = useRef<string>(selectedVoiceURI);
  const sectionsRef = useRef<SpokenSection[]>(sections);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    rateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    voiceUriRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // Load browser voices and subscribe to voiceschanged
  useEffect(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;

    const updateVoices = () => {
      try {
        const list = synth.getVoices() || [];
        setAvailableVoices(list);
        if (list.length > 0 && !voiceUriRef.current) {
          const targetLangPrefix = language === 'hi' ? 'hi' : 'en';
          const preferred =
            list.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix) && v.default) ||
            list.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix)) ||
            list[0];
          if (preferred) {
            setSelectedVoiceURI(preferred.voiceURI);
          }
        }
      } catch {
        // Ignore voice enumeration errors
      }
    };

    updateVoices();
    synth.addEventListener?.('voiceschanged', updateVoices);
    return () => {
      synth.removeEventListener?.('voiceschanged', updateVoices);
    };
  }, [isSupported, language]);

  const cancelSpeechEngine = useCallback(() => {
    playbackSessionRef.current += 1;
    if (isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
  }, [isSupported]);

  // Cancel active speech when switching reports, changing language, or unmounting
  useEffect(() => {
    cancelSpeechEngine();
    setStatus('idle');
    setCurrentSectionIndex(0);
    setStatusNotice(null);
    onActiveSectionChange?.(null);
    return () => {
      cancelSpeechEngine();
    };
  }, [report, language, cancelSpeechEngine, onActiveSectionChange]);

  const speakSectionAt = useCallback(
    (sectionIdx: number) => {
      const currentSections = sectionsRef.current;
      if (sectionIdx < 0 || sectionIdx >= currentSections.length) {
        cancelSpeechEngine();
        setStatus('completed');
        onActiveSectionChange?.(null);
        return;
      }

      const targetSection = currentSections[sectionIdx];
      setCurrentSectionIndex(sectionIdx);
      onActiveSectionChange?.(targetSection);

      if (!isSupported) {
        setStatus('unavailable');
        setStatusNotice(
          'Browser speech synthesis is unavailable on this device. You can still step through each spoken summary section below.'
        );
        return;
      }

      const synth = window.speechSynthesis;
      cancelSpeechEngine();
      const sessionToken = playbackSessionRef.current;

      const chunks = splitIntoUtteranceChunks(targetSection.text);
      if (chunks.length === 0) {
        speakSectionAt(sectionIdx + 1);
        return;
      }

      setStatus('playing');
      setStatusNotice(null);

      let chunkIdx = 0;
      let startedAnyChunk = false;

      // Guard for headless browsers where speechSynthesis exists on window but has no audio backend
      const startWatchdog = window.setTimeout(() => {
        if (
          playbackSessionRef.current === sessionToken &&
          !startedAnyChunk &&
          !synth.speaking
        ) {
          const voicesNow = synth.getVoices() || [];
          if (voicesNow.length === 0) {
            setStatus('unavailable');
            setStatusNotice(
              'No speech synthesis voices were detected in this browser environment. Highlighting active section text for reading.'
            );
          }
        }
      }, 900);

      const speakNextChunk = () => {
        if (playbackSessionRef.current !== sessionToken) {
          window.clearTimeout(startWatchdog);
          return;
        }
        if (chunkIdx >= chunks.length) {
          window.clearTimeout(startWatchdog);
          if (sectionIdx + 1 < sectionsRef.current.length) {
            speakSectionAt(sectionIdx + 1);
          } else {
            setStatus('completed');
            onActiveSectionChange?.(null);
          }
          return;
        }

        try {
          const utterance = new SpeechSynthesisUtterance(chunks[chunkIdx]);
          utterance.rate = rateRef.current;
          utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';

          const voices = synth.getVoices() || [];
          const chosenVoice = voices.find((v) => v.voiceURI === voiceUriRef.current);
          if (chosenVoice) {
            utterance.voice = chosenVoice;
          }

          utterance.onstart = () => {
            startedAnyChunk = true;
            window.clearTimeout(startWatchdog);
            if (playbackSessionRef.current === sessionToken) {
              setStatus('playing');
            }
          };

          utterance.onend = () => {
            if (playbackSessionRef.current !== sessionToken) return;
            chunkIdx += 1;
            speakNextChunk();
          };

          utterance.onerror = (ev) => {
            window.clearTimeout(startWatchdog);
            if (playbackSessionRef.current !== sessionToken) return;
            if (ev.error === 'canceled' || ev.error === 'interrupted') {
              return;
            }
            setStatus('unavailable');
            setStatusNotice(
              'Audio playback could not be started on this device. Active section is highlighted below.'
            );
          };

          synth.speak(utterance);
        } catch {
          window.clearTimeout(startWatchdog);
          setStatus('unavailable');
          setStatusNotice('Speech playback is not supported in this browser.');
        }
      };

      speakNextChunk();
    },
    [cancelSpeechEngine, isSupported, language, onActiveSectionChange]
  );

  const handleToggleListenPanel = () => {
    if (!isOpen) {
      setIsOpen(true);
      speakSectionAt(0);
    } else if (status === 'playing' || status === 'paused') {
      cancelSpeechEngine();
      setStatus('idle');
      onActiveSectionChange?.(null);
      setIsOpen(false);
    } else {
      setIsOpen(false);
      onActiveSectionChange?.(null);
    }
  };

  const handlePlayOrResume = () => {
    if (status === 'paused' && isSupported) {
      try {
        window.speechSynthesis.resume();
        setStatus('playing');
        return;
      } catch {
        // Fallback to restarting current section
      }
    }
    const startIdx =
      status === 'completed' || currentSectionIndex >= sections.length
        ? 0
        : currentSectionIndex;
    speakSectionAt(startIdx);
  };

  const handlePause = () => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.pause();
      setStatus('paused');
    } catch {
      cancelSpeechEngine();
      setStatus('paused');
    }
  };

  const handleStop = () => {
    cancelSpeechEngine();
    setStatus('idle');
    setCurrentSectionIndex(0);
    onActiveSectionChange?.(null);
  };

  const handleReplay = () => {
    speakSectionAt(0);
  };

  const handleSkipPrev = () => {
    const prevIdx = Math.max(0, currentSectionIndex - 1);
    if (status === 'playing') {
      speakSectionAt(prevIdx);
    } else {
      setCurrentSectionIndex(prevIdx);
      onActiveSectionChange?.(sections[prevIdx] || null);
    }
  };

  const handleSkipNext = () => {
    const nextIdx = Math.min(sections.length - 1, currentSectionIndex + 1);
    if (status === 'playing') {
      speakSectionAt(nextIdx);
    } else {
      setCurrentSectionIndex(nextIdx);
      onActiveSectionChange?.(sections[nextIdx] || null);
    }
  };

  const handleChangeMode = (newMode: ListeningMode) => {
    if (newMode === mode) return;
    cancelSpeechEngine();
    setMode(newMode);
    setCurrentSectionIndex(0);
    const updatedSections = buildSpokenReportSections(report, newMode, language);
    sectionsRef.current = updatedSections;
    if (status === 'playing') {
      setTimeout(() => speakSectionAt(0), 30);
    } else {
      setStatus('idle');
      onActiveSectionChange?.(updatedSections[0] || null);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackRate(newSpeed);
    rateRef.current = newSpeed;
    if (status === 'playing') {
      speakSectionAt(currentSectionIndex);
    }
  };

  const activeSection = sections[currentSectionIndex] || sections[0];
  const progressPct =
    sections.length > 0
      ? Math.round(((currentSectionIndex + 1) / sections.length) * 100)
      : 0;

  return (
    <div className="mt-4">
      {/* Primary "Listen to Results" Trigger Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-testid="listen-to-results-btn"
          aria-expanded={isOpen}
          onClick={handleToggleListenPanel}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            isOpen
              ? 'bg-slate-900 text-cyan-300 border-cyan-500/50 shadow-xs'
              : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-800 shadow-xs'
          }`}
        >
          <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          <span>
            {language === 'hi'
              ? isOpen
                ? 'ऑडियो प्लेयर बंद करें (Close Audio)'
                : 'परिणाम सुनें (Listen to Results)'
              : isOpen
              ? 'Hide Audio Player'
              : 'Listen to Results'}
          </span>
          {status === 'playing' && (
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-cyan-500/20 text-cyan-300 rounded">
              Speaking…
            </span>
          )}
        </button>

        {!isOpen && (
          <span className="text-xs text-slate-500">
            {language === 'hi'
              ? 'स्पष्ट भाषा में मुख्य जोखिम और कार्य-योजना सुनें'
              : 'Hear a spoken plain-English summary or full clause-by-clause walkthrough'}
          </span>
        )}
      </div>

      {/* Expandable Accessible Audio Control Bar */}
      {isOpen && (
        <div
          role="region"
          aria-label="Listen to analysis results audio player"
          data-testid="listen-to-results-panel"
          className="mt-3 p-4 sm:p-5 bg-[#0B132B] text-slate-100 border border-slate-700/80 rounded-xl shadow-md space-y-4"
        >
          {/* Top Row: Listening Mode Toggle (Summary vs Full Report) & Speed / Voice Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 mr-1">
                {language === 'hi' ? 'मोड:' : 'Listening Mode:'}
              </span>
              <div
                role="group"
                aria-label="Select listening mode"
                className="inline-flex items-center p-1 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <button
                  type="button"
                  data-testid="tts-mode-summary"
                  onClick={() => handleChangeMode('summary')}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'summary'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {language === 'hi' ? 'सारांश (Summary)' : 'Listen to Summary'}
                </button>
                <button
                  type="button"
                  data-testid="tts-mode-full"
                  onClick={() => handleChangeMode('full')}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'full'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {language === 'hi'
                    ? 'पूरी रिपोर्ट (Full Report)'
                    : 'Listen to Full Report'}
                </button>
              </div>
            </div>

            {/* Playback Speed & Optional Voice Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Playback speed"
                className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <FastForward
                  className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-0.5 shrink-0"
                  aria-hidden="true"
                />
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    data-testid={`tts-speed-${spd}`}
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-2 py-1 min-h-[32px] text-xs font-mono font-semibold rounded transition-colors cursor-pointer tabular-nums ${
                      playbackRate === spd
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {availableVoices.length > 0 && (
                <select
                  aria-label="Select speech voice"
                  data-testid="tts-voice-select"
                  value={selectedVoiceURI}
                  onChange={(e) => {
                    setSelectedVoiceURI(e.target.value);
                    voiceUriRef.current = e.target.value;
                    if (status === 'playing') {
                      speakSectionAt(currentSectionIndex);
                    }
                  }}
                  className="px-2.5 py-1.5 min-h-[36px] text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded-lg max-w-[200px] truncate"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Middle Row: Transport Controls (Play/Pause/Resume, Stop, Replay, Prev/Next Section) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {status === 'playing' ? (
                <button
                  type="button"
                  data-testid="tts-pause-btn"
                  onClick={handlePause}
                  aria-label="Pause spoken results"
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>{language === 'hi' ? 'रोकें (Pause)' : 'Pause'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="tts-play-btn"
                  onClick={handlePlayOrResume}
                  aria-label={status === 'paused' ? 'Resume spoken results' : 'Play spoken results'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs sm:text-sm font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>
                    {status === 'paused'
                      ? language === 'hi'
                        ? 'जारी रखें (Resume)'
                        : 'Resume'
                      : language === 'hi'
                      ? 'चलाएं (Play)'
                      : 'Play'}
                  </span>
                </button>
              )}

              <button
                type="button"
                data-testid="tts-stop-btn"
                onClick={handleStop}
                disabled={status === 'idle'}
                aria-label="Stop playback"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Stop</span>
              </button>

              <button
                type="button"
                data-testid="tts-replay-btn"
                onClick={handleReplay}
                aria-label="Replay from start"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Replay</span>
              </button>

              <div className="inline-flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  data-testid="tts-prev-btn"
                  onClick={handleSkipPrev}
                  disabled={currentSectionIndex <= 0}
                  aria-label="Previous section"
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  data-testid="tts-next-btn"
                  onClick={handleSkipNext}
                  disabled={currentSectionIndex >= sections.length - 1}
                  aria-label="Next section"
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Section Progress Indicator */}
            <div
              data-testid="tts-progress-indicator"
              className="text-xs font-mono text-cyan-300 tabular-nums"
            >
              Section {currentSectionIndex + 1} of {sections.length} ({progressPct}%)
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Currently Spoken Section Transcript Preview */}
          {activeSection && (
            <div
              data-testid="tts-active-section-card"
              className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-cyan-400">
                  Now Reading: {activeSection.label}
                </span>
                <span className="font-mono text-[11px] text-slate-400 uppercase">
                  {status === 'playing'
                    ? 'Speaking'
                    : status === 'paused'
                    ? 'Paused'
                    : status === 'completed'
                    ? 'Finished'
                    : 'Ready'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {activeSection.text}
              </p>
            </div>
          )}

          {/* Fallback / Status Notice if Browser Speech Synthesis is Unavailable */}
          {statusNotice && (
            <div
              role="status"
              data-testid="tts-status-banner"
              className="p-3 bg-slate-900 border border-amber-500/40 rounded-lg flex items-center gap-2.5 text-xs text-amber-200"
            >
              <VolumeX className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>{statusNotice}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
