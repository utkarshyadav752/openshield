/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Pure state machine and capability logic for the OpenShield Hero Shield
 * Static-SVG-First -> Asynchronous 3D WebGL Transition.
 *
 * Guarantees:
 * 1. Immediate static SVG render on initial mount ('static_svg' phase).
 * 2. Smooth crossfade to 3D ('webgl_ready') ONLY after both WebGL init AND first frame rendered.
 * 3. Permanent, non-retrying fallback to static SVG ('fallback_svg') on timeout, WebGL unavailability,
 *    context loss, initialization error, or prefers-reduced-motion.
 */

export type ShieldVisualPhase =
  | 'static_svg'      // Initial state: static SVG visible, 3D initializing in background
  | 'webgl_ready'     // 3D scene initialized AND first frame rendered: 3D visible, SVG crossfaded out
  | 'fallback_svg';   // Permanent fallback: static SVG remains visible, no retry loops

export interface ShieldRendererState {
  phase: ShieldVisualPhase;
  webglAttempted: boolean;
  firstFrameRendered: boolean;
  fallbackReason:
    | 'none'
    | 'reduced_motion'
    | 'webgl_unavailable'
    | 'init_error'
    | 'init_timeout'
    | 'context_lost';
}

export type ShieldRendererEvent =
  | { type: 'START_INIT'; reducedMotion: boolean; webglSupported: boolean }
  | { type: 'FIRST_FRAME_RENDERED' }
  | { type: 'INIT_FAILED'; reason?: 'init_error' | 'webgl_unavailable' }
  | { type: 'INIT_TIMED_OUT' }
  | { type: 'CONTEXT_LOST' }
  | { type: 'REDUCED_MOTION_ENABLED' };

export function createInitialShieldState(): ShieldRendererState {
  return {
    phase: 'static_svg',
    webglAttempted: false,
    firstFrameRendered: false,
    fallbackReason: 'none',
  };
}

export function transitionShieldState(
  state: ShieldRendererState,
  event: ShieldRendererEvent
): ShieldRendererState {
  // Never retry once in permanent fallback_svg state
  if (state.phase === 'fallback_svg') {
    return state;
  }

  switch (event.type) {
    case 'START_INIT': {
      if (event.reducedMotion) {
        return {
          phase: 'fallback_svg',
          webglAttempted: true,
          firstFrameRendered: false,
          fallbackReason: 'reduced_motion',
        };
      }
      if (!event.webglSupported) {
        return {
          phase: 'fallback_svg',
          webglAttempted: true,
          firstFrameRendered: false,
          fallbackReason: 'webgl_unavailable',
        };
      }
      return {
        ...state,
        phase: 'static_svg',
        webglAttempted: true,
      };
    }

    case 'FIRST_FRAME_RENDERED': {
      return {
        phase: 'webgl_ready',
        webglAttempted: true,
        firstFrameRendered: true,
        fallbackReason: 'none',
      };
    }

    case 'INIT_FAILED': {
      return {
        phase: 'fallback_svg',
        webglAttempted: true,
        firstFrameRendered: false,
        fallbackReason: event.reason || 'init_error',
      };
    }

    case 'INIT_TIMED_OUT': {
      // Only time out if the first frame has not yet rendered
      if (state.firstFrameRendered || state.phase === 'webgl_ready') {
        return state;
      }
      return {
        phase: 'fallback_svg',
        webglAttempted: true,
        firstFrameRendered: false,
        fallbackReason: 'init_timeout',
      };
    }

    case 'CONTEXT_LOST': {
      return {
        phase: 'fallback_svg',
        webglAttempted: true,
        firstFrameRendered: false,
        fallbackReason: 'context_lost',
      };
    }

    case 'REDUCED_MOTION_ENABLED': {
      return {
        phase: 'fallback_svg',
        webglAttempted: true,
        firstFrameRendered: false,
        fallbackReason: 'reduced_motion',
      };
    }

    default:
      return state;
  }
}

/**
 * Returns whether the static SVG layer should remain visible.
 * Static SVG is visible during 'static_svg' and 'fallback_svg', and fades out only in 'webgl_ready'.
 */
export function isStaticSvgVisible(state: ShieldRendererState): boolean {
  return state.phase !== 'webgl_ready';
}

/**
 * Returns whether the 3D WebGL canvas should be visible.
 */
export function isWebglCanvasVisible(state: ShieldRendererState): boolean {
  return state.phase === 'webgl_ready' && state.firstFrameRendered;
}
