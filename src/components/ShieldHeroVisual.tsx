/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Hero Shield Visual Orchestrator
 *
 * Mandatory Behavior:
 * 1. Displays the polished StaticHeroShield SVG immediately on initial page load.
 * 2. Reserves fixed responsive dimensions (aspect-square) so layout shift is zero (CLS = 0).
 * 3. Initializes the Three.js 3D shield asynchronously in the background.
 * 4. Crossfades from the static SVG to the 3D shield ONLY after successful initialization
 *    and the first rendered frame (`FIRST_FRAME_RENDERED`).
 * 5. Keeps the static SVG visible permanently (without retry loops) if WebGL is unavailable,
 *    initialization times out, context is lost, or prefers-reduced-motion is enabled.
 */

import React, { useCallback, useEffect, useReducer } from 'react';
import {
  createInitialShieldState,
  isStaticSvgVisible,
  isWebglCanvasVisible,
  transitionShieldState,
} from '../utils/shieldRendererState';
import { HeroShield3D } from './HeroShield3D';
import { StaticHeroShield } from './StaticHeroShield';

const INIT_TIMEOUT_MS = 6500;

function checkWebglSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export const ShieldHeroVisual: React.FC = () => {
  const [state, dispatch] = useReducer(
    transitionShieldState,
    undefined,
    createInitialShieldState
  );

  useEffect(() => {
    const reducedMotionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const prefersReducedMotion = Boolean(reducedMotionQuery?.matches);
    const webglSupported = checkWebglSupport();

    // Defer 3D initialization until after initial paint so static SVG renders first
    const initTimer = window.setTimeout(() => {
      dispatch({
        type: 'START_INIT',
        reducedMotion: prefersReducedMotion,
        webglSupported,
      });
    }, 40);

    // Timeout guard: if 3D first frame does not complete within INIT_TIMEOUT_MS, keep static SVG
    const timeoutGuard = window.setTimeout(() => {
      dispatch({ type: 'INIT_TIMED_OUT' });
    }, INIT_TIMEOUT_MS);

    const handleMotionChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) {
        dispatch({ type: 'REDUCED_MOTION_ENABLED' });
      }
    };
    reducedMotionQuery?.addEventListener?.('change', handleMotionChange);

    return () => {
      window.clearTimeout(initTimer);
      window.clearTimeout(timeoutGuard);
      reducedMotionQuery?.removeEventListener?.('change', handleMotionChange);
    };
  }, []);

  const handleFirstFrameRendered = useCallback(() => {
    dispatch({ type: 'FIRST_FRAME_RENDERED' });
  }, []);

  const handleInitError = useCallback(
    (reason: 'init_error' | 'webgl_unavailable') => {
      dispatch({ type: 'INIT_FAILED', reason });
    },
    []
  );

  const handleContextLost = useCallback(() => {
    dispatch({ type: 'CONTEXT_LOST' });
  }, []);

  const showStaticSvg = isStaticSvgVisible(state);
  const showWebglCanvas = isWebglCanvasVisible(state);
  const shouldMount3D =
    state.webglAttempted && state.phase !== 'fallback_svg';

  return (
    <div
      data-testid="shield-hero-visual"
      data-visual-phase={state.phase}
      className="relative w-full max-w-[230px] sm:max-w-[270px] md:max-w-[310px] lg:max-w-[350px] aspect-square mx-auto select-none"
    >
      {/* Layer 1: Immediate Static SVG Shield (Always mounted for instant paint & fallback safety) */}
      <div
        data-testid="static-shield-layer"
        aria-hidden={showWebglCanvas}
        className={`absolute inset-0 transition-opacity duration-700 ease-out ${
          showStaticSvg
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <StaticHeroShield />
      </div>

      {/* Layer 2: Asynchronous 3D WebGL Shield (Crossfades in ONLY after first rendered frame) */}
      {shouldMount3D && (
        <div
          data-testid="webgl-shield-layer"
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            showWebglCanvas
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <HeroShield3D
            onFirstFrameRendered={handleFirstFrameRendered}
            onInitError={handleInitError}
            onContextLost={handleContextLost}
          />
        </div>
      )}

      {/* Subtle Bottom Telemetry Caption */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1 rounded-md bg-[#0B132B]/90 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 whitespace-nowrap shadow-sm">
        {showWebglCanvas
          ? 'AI Clause & Dark-Pattern Shield · Active 3D Core'
          : 'AI Clause & Dark-Pattern Shield · Evidence Verified'}
      </div>
    </div>
  );
};
