/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Unit tests for OpenShield Hero Shield Static-SVG-First -> 3D Transition State Machine
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialShieldState,
  isStaticSvgVisible,
  isWebglCanvasVisible,
  transitionShieldState,
} from '../../src/utils/shieldRendererState';

test('initial state starts with static_svg visible and WebGL canvas hidden', () => {
  const initial = createInitialShieldState();
  assert.equal(initial.phase, 'static_svg');
  assert.equal(isStaticSvgVisible(initial), true);
  assert.equal(isWebglCanvasVisible(initial), false);
});

test('transitions from static_svg to webgl_ready only after FIRST_FRAME_RENDERED', () => {
  let state = createInitialShieldState();
  state = transitionShieldState(state, {
    type: 'START_INIT',
    reducedMotion: false,
    webglSupported: true,
  });

  // Still showing static SVG while 3D initializes in background
  assert.equal(state.phase, 'static_svg');
  assert.equal(isStaticSvgVisible(state), true);
  assert.equal(isWebglCanvasVisible(state), false);

  // First frame rendered -> smooth handoff to 3D
  state = transitionShieldState(state, { type: 'FIRST_FRAME_RENDERED' });
  assert.equal(state.phase, 'webgl_ready');
  assert.equal(state.firstFrameRendered, true);
  assert.equal(isStaticSvgVisible(state), false);
  assert.equal(isWebglCanvasVisible(state), true);
});

test('falls back permanently to static SVG when WebGL is unavailable or reduced motion is active', () => {
  const noWebgl = transitionShieldState(createInitialShieldState(), {
    type: 'START_INIT',
    reducedMotion: false,
    webglSupported: false,
  });
  assert.equal(noWebgl.phase, 'fallback_svg');
  assert.equal(noWebgl.fallbackReason, 'webgl_unavailable');
  assert.equal(isStaticSvgVisible(noWebgl), true);
  assert.equal(isWebglCanvasVisible(noWebgl), false);

  // Does not retry after entering fallback_svg
  const afterRetry = transitionShieldState(noWebgl, { type: 'FIRST_FRAME_RENDERED' });
  assert.equal(afterRetry.phase, 'fallback_svg');

  const reduced = transitionShieldState(createInitialShieldState(), {
    type: 'START_INIT',
    reducedMotion: true,
    webglSupported: true,
  });
  assert.equal(reduced.phase, 'fallback_svg');
  assert.equal(reduced.fallbackReason, 'reduced_motion');
});

test('falls back to static SVG on initialization timeout or WebGL context loss', () => {
  let state = transitionShieldState(createInitialShieldState(), {
    type: 'START_INIT',
    reducedMotion: false,
    webglSupported: true,
  });
  state = transitionShieldState(state, { type: 'INIT_TIMED_OUT' });
  assert.equal(state.phase, 'fallback_svg');
  assert.equal(state.fallbackReason, 'init_timeout');
  assert.equal(isStaticSvgVisible(state), true);

  // Context loss after webgl_ready reverts cleanly to static SVG
  let readyState = transitionShieldState(createInitialShieldState(), {
    type: 'FIRST_FRAME_RENDERED',
  });
  assert.equal(readyState.phase, 'webgl_ready');
  readyState = transitionShieldState(readyState, { type: 'CONTEXT_LOST' });
  assert.equal(readyState.phase, 'fallback_svg');
  assert.equal(readyState.fallbackReason, 'context_lost');
  assert.equal(isStaticSvgVisible(readyState), true);
  assert.equal(isWebglCanvasVisible(readyState), false);
});
