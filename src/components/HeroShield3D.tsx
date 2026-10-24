/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield 3D Hero Shield (Three.js / WebGL)
 *
 * Implements a multi-part composite procedural 3D cybersecurity shield:
 * 1. Primary Silhouette: Extruded bevelled titanium-navy shield chassis
 * 2. Secondary Read: Recessed obsidian glass armor plate, cyan energy rim,
 *    concentric AI containment rings, and a gentle vertical holographic scan beam
 * 3. Accent Detail: Faceted octahedral glowing AI core, radial circuit conduits
 *    with neural nodes, and subtle floating particles.
 *
 * Includes hardware/software-GL adaptive frame pacing (`afterDraw`),
 * `IntersectionObserver` off-screen pause, `webglcontextlost` recovery,
 * and signals `onFirstFrameRendered` only after the first frame is drawn.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface HeroShield3DProps {
  onFirstFrameRendered: () => void;
  onInitError: (reason: 'init_error' | 'webgl_unavailable') => void;
  onContextLost: () => void;
}

/**
 * Builds the classic curved heater/hexagonal shield 2D shape centered at (0, 0).
 */
function createShieldShape(scale = 1): THREE.Shape {
  const s = scale;
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.48 * s);
  shape.lineTo(1.12 * s, 1.02 * s);
  shape.lineTo(1.12 * s, 0.08 * s);
  shape.bezierCurveTo(1.12 * s, -0.78 * s, 0.62 * s, -1.32 * s, 0, -1.56 * s);
  shape.bezierCurveTo(-0.62 * s, -1.32 * s, -1.12 * s, -0.78 * s, -1.12 * s, 0.08 * s);
  shape.lineTo(-1.12 * s, 1.02 * s);
  shape.closePath();
  return shape;
}

export const HeroShield3D: React.FC<HeroShield3DProps> = ({
  onFirstFrameRendered,
  onInitError,
  onContextLost,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({
    onFirstFrameRendered,
    onInitError,
    onContextLost,
  });

  useEffect(() => {
    callbacksRef.current = {
      onFirstFrameRendered,
      onInitError,
      onContextLost,
    };
  }, [onFirstFrameRendered, onInitError, onContextLost]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    let envTarget: THREE.WebGLRenderTarget | null = null;
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let isVisibleInViewport = true;
    let firstFrameSignaled = false;

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      callbacksRef.current.onInitError('webgl_unavailable');
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      callbacksRef.current.onInitError('webgl_unavailable');
      return;
    }

    // Detect software WebGL (SwiftShader / llvmpipe) per threejs skill guidelines
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : '';
    const isSoftwareGl =
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(glRenderer);

    const width = Math.max(container.clientWidth || 360, 260);
    const height = Math.max(container.clientHeight || 360, 260);

    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (!disposed) {
        callbacksRef.current.onContextLost();
      }
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.05, 5.2);
    camera.lookAt(0, 0, 0);

    // Studio PBR Environment for metallic and glass reflections
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envTarget.texture;
    } catch {
      // Proceed with direct lights if PMREM fails
    }

    // Three-Point Studio Lighting with Warm/Cool Contrast & Cyan/Violet Accents
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d1a, 1.1);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    keyLight.position.set(3.5, 4.5, 4.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 1.8);
    rimLight.position.set(-4.0, -2.0, -2.5);
    scene.add(rimLight);

    const corePointLight = new THREE.PointLight(0x06b6d4, 2.6, 6.0);
    corePointLight.position.set(0, 0.1, 0.75);
    scene.add(corePointLight);

    // Root Shield Composite Group (8 distinct parts across 3 silhouette scales)
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    const curveSegments = isSoftwareGl ? 14 : 24;

    // PART 1 (Primary Silhouette): Outer Bevelled Titanium Shield Hull
    const outerShape = createShieldShape(1.0);
    const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: isSoftwareGl ? 2 : 4,
      steps: 1,
      bevelSize: 0.07,
      bevelThickness: 0.07,
      curveSegments,
    });
    outerGeo.center();
    geometriesToDispose.push(outerGeo);

    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x0f1b38,
      metalness: 0.85,
      roughness: 0.32,
    });
    materialsToDispose.push(outerMat);
    const outerHullMesh = new THREE.Mesh(outerGeo, outerMat);
    shieldGroup.add(outerHullMesh);

    // PART 2 (Secondary Read): Recessed Inner Glass-Armor Plate (roughness delta >= 0.25)
    const innerShape = createShieldShape(0.84);
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.04,
      curveSegments,
    });
    innerGeo.center();
    geometriesToDispose.push(innerGeo);

    const innerMat = new THREE.MeshPhysicalMaterial({
      color: 0x070e22,
      metalness: 0.25,
      roughness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    materialsToDispose.push(innerMat);
    const innerPlateMesh = new THREE.Mesh(innerGeo, innerMat);
    innerPlateMesh.position.z = 0.06;
    shieldGroup.add(innerPlateMesh);

    // PART 3 (Secondary Read): Glowing Cyan-Blue Perimeter Energy Frame
    const rimPoints = createShieldShape(0.91).getPoints(curveSegments);
    const rimPts3D = rimPoints.map((p) => new THREE.Vector3(p.x, p.y, 0.155));
    rimPts3D.push(rimPts3D[0].clone());
    const rimCurve = new THREE.CatmullRomCurve3(rimPts3D, true);
    const rimTubeGeo = new THREE.TubeGeometry(
      rimCurve,
      isSoftwareGl ? 40 : 64,
      0.018,
      8,
      true
    );
    geometriesToDispose.push(rimTubeGeo);

    const cyanEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
      metalness: 0.5,
      roughness: 0.2,
    });
    materialsToDispose.push(cyanEmissiveMat);
    const rimTubeMesh = new THREE.Mesh(rimTubeGeo, cyanEmissiveMat);
    shieldGroup.add(rimTubeMesh);

    // PART 4 (Secondary Read): Concentric AI Containment Rings (Cyan & Violet)
    const outerRingGeo = new THREE.TorusGeometry(0.46, 0.016, 12, 48);
    const innerRingGeo = new THREE.TorusGeometry(0.34, 0.014, 12, 40);
    geometriesToDispose.push(outerRingGeo, innerRingGeo);

    const violetEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x7c3aed,
      emissiveIntensity: 1.25,
      metalness: 0.6,
      roughness: 0.25,
    });
    materialsToDispose.push(violetEmissiveMat);

    const outerContainmentRing = new THREE.Mesh(outerRingGeo, cyanEmissiveMat);
    outerContainmentRing.position.set(0, 0.08, 0.18);
    shieldGroup.add(outerContainmentRing);

    const innerContainmentRing = new THREE.Mesh(innerRingGeo, violetEmissiveMat);
    innerContainmentRing.position.set(0, 0.08, 0.19);
    shieldGroup.add(innerContainmentRing);

    // PART 5 (Accent Detail): Glowing Faceted Octahedral AI Core + Inner Pulse Sphere
    const coreOctaGeo = new THREE.OctahedronGeometry(0.21, 0);
    const coreSphereGeo = new THREE.IcosahedronGeometry(0.11, 1);
    geometriesToDispose.push(coreOctaGeo, coreSphereGeo);

    const aiCoreShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 1.1,
      metalness: 0.2,
      roughness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const aiCoreInnerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x67e8f9,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.1,
    });
    materialsToDispose.push(aiCoreShellMat, aiCoreInnerMat);

    const aiCoreOcta = new THREE.Mesh(coreOctaGeo, aiCoreShellMat);
    aiCoreOcta.position.set(0, 0.08, 0.24);
    shieldGroup.add(aiCoreOcta);

    const aiCoreInner = new THREE.Mesh(coreSphereGeo, aiCoreInnerMat);
    aiCoreInner.position.set(0, 0.08, 0.24);
    shieldGroup.add(aiCoreInner);

    // PART 6 (Accent Detail): Radial Neural Circuit Traces & Nodes on Shield Face
    const circuitGroup = new THREE.Group();
    circuitGroup.position.set(0, 0.08, 0.165);
    shieldGroup.add(circuitGroup);

    const traceGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6);
    const nodeGeo = new THREE.SphereGeometry(0.032, 10, 10);
    geometriesToDispose.push(traceGeo, nodeGeo);

    const circuitAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
    circuitAngles.forEach((angle, idx) => {
      const arm = new THREE.Group();
      arm.rotation.z = angle;

      const mat = idx % 2 === 0 ? cyanEmissiveMat : violetEmissiveMat;
      const traceMesh = new THREE.Mesh(traceGeo, mat);
      traceMesh.position.y = 0.56;
      arm.add(traceMesh);

      const nodeMesh = new THREE.Mesh(nodeGeo, mat);
      nodeMesh.position.y = 0.78;
      arm.add(nodeMesh);

      circuitGroup.add(arm);
    });

    // PART 7 (Secondary Read): Holographic Scanning Beam + Orbital Ring
    const orbitalRingGeo = new THREE.TorusGeometry(1.52, 0.009, 8, 64);
    const scanBarGeo = new THREE.BoxGeometry(1.75, 0.024, 0.34);
    geometriesToDispose.push(orbitalRingGeo, scanBarGeo);

    const scanMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
    });
    materialsToDispose.push(scanMat);

    const orbitalRing = new THREE.Mesh(orbitalRingGeo, scanMat);
    orbitalRing.rotation.x = Math.PI * 0.42;
    orbitalRing.rotation.y = -Math.PI * 0.12;
    shieldGroup.add(orbitalRing);

    const scanBarMesh = new THREE.Mesh(scanBarGeo, scanMat);
    scanBarMesh.position.set(0, 0, 0.12);
    shieldGroup.add(scanBarMesh);

    // PART 8 (Accent Detail): Floating Protection Particles
    const particleCount = isSoftwareGl ? 28 : 54;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const cCyan = new THREE.Color(0x38bdf8);
    const cViolet = new THREE.Color(0xa78bfa);

    for (let i = 0; i < particleCount; i++) {
      const theta = (i / particleCount) * Math.PI * 2;
      const radius = 1.35 + (i % 5) * 0.14;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.sin(theta) * radius * 0.95;
      positions[i * 3 + 2] = ((i % 7) - 3) * 0.12;

      const c = i % 3 === 0 ? cViolet : cCyan;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometriesToDispose.push(particlesGeo);

    const particlesMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    materialsToDispose.push(particlesMat);

    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    // Pre-warm shaders on hardware GPU (skip on software GL per guidelines)
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Subtle pointer parallax (stored in ref variables, zero allocation in loop)
    let targetRotX = 0;
    let targetRotY = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRotY = THREE.MathUtils.clamp(nx * 0.22, -0.25, 0.25);
      targetRotX = THREE.MathUtils.clamp(ny * 0.14, -0.18, 0.18);
    };
    const handlePointerLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };
    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed || !renderer) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(Math.floor(entry.contentRect.width), 200);
      const h = Math.max(Math.floor(entry.contentRect.height), 200);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    // Pause rendering when scrolled off-screen
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          isVisibleInViewport = entry.isIntersecting;
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    // Software-GL safe frame scheduler (`afterDraw` pattern from threejs skill)
    const afterDraw = (cb: FrameRequestCallback) => {
      if (disposed || !renderer) return;
      if (!isSoftwareGl || !('fenceSync' in gl)) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const gl2 = gl as WebGL2RenderingContext;
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync
          ? gl2.clientWaitSync(sync, 0, 0)
          : gl2.ALREADY_SIGNALED;
        if (status === gl2.TIMEOUT_EXPIRED) {
          timeoutId = setTimeout(poll, 16);
          return;
        }
        if (sync) gl2.deleteSync(sync);
        timeoutId = setTimeout(() => {
          if (!disposed) {
            rafId = requestAnimationFrame(cb);
          }
        }, 80);
      };
      timeoutId = setTimeout(poll, 0);
    };

    let lastTime = performance.now();
    let elapsed = 0;

    const tick: FrameRequestCallback = (now) => {
      if (disposed || !renderer) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (document.hidden || !isVisibleInViewport) {
        afterDraw(tick);
        return;
      }

      elapsed += dt;

      // Gentle floating motion and smooth pointer damping
      shieldGroup.position.y = Math.sin(elapsed * 1.4) * 0.07;
      const desiredY = Math.sin(elapsed * 0.75) * 0.18 + targetRotY;
      const desiredX = Math.cos(elapsed * 0.6) * 0.05 + targetRotX;
      const damp = 1 - Math.exp(-5 * dt);
      shieldGroup.rotation.y += (desiredY - shieldGroup.rotation.y) * damp;
      shieldGroup.rotation.x += (desiredX - shieldGroup.rotation.x) * damp;

      // Subtle AI core & ring counter-rotation
      aiCoreOcta.rotation.z = elapsed * 0.65;
      aiCoreOcta.rotation.y = elapsed * 0.45;
      outerContainmentRing.rotation.z = -elapsed * 0.3;
      innerContainmentRing.rotation.z = elapsed * 0.45;
      particleSystem.rotation.z = elapsed * 0.08;

      // Gentle holographic vertical scan sweep
      scanBarMesh.position.y = Math.sin(elapsed * 1.35) * 0.95;

      renderer.render(scene, camera);

      if (!firstFrameSignaled) {
        firstFrameSignaled = true;
        callbacksRef.current.onFirstFrameRendered();
      }

      afterDraw(tick);
    };

    // Kick off first frame asynchronously so initial static SVG paint is never blocked
    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('webglcontextlost', handleContextLost);

      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      if (envTarget) envTarget.dispose();
      if (pmrem) pmrem.dispose();
      if (renderer) renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="hero-3d-canvas-container"
      className="w-full h-full"
      aria-hidden="true"
    />
  );
};
