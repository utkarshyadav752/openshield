/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Static SVG Hero Shield
 * Rendered immediately on homepage load without waiting for WebGL or Three.js.
 * Matches the 3D shield's silhouette, metallic/glass depth, cyan-blue glow,
 * violet accents, glowing AI core, circuit lines, and holographic scan beam.
 */

import React from 'react';

interface StaticHeroShieldProps {
  className?: string;
}

export const StaticHeroShield: React.FC<StaticHeroShieldProps> = ({
  className = '',
}) => {
  return (
    <div
      data-testid="static-hero-shield"
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
    >
      {/* Controlled Cyan-Blue & Violet Ambient Backdrop Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-6 rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/15 to-violet-600/15 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 420 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[380px] max-h-[380px] drop-shadow-[0_20px_45px_rgba(6,182,212,0.22)]"
        role="img"
        aria-label="OpenShield 3D AI Protection Shield"
      >
        <defs>
          {/* Metallic Outer Frame Gradient */}
          <linearGradient
            id="hero-shield-outer-rim"
            x1="65"
            y1="35"
            x2="355"
            y2="385"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="35%" stopColor="#1D4ED8" />
            <stop offset="70%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>

          {/* Deep Obsidian Metallic Armor Body */}
          <linearGradient
            id="hero-shield-body"
            x1="90"
            y1="50"
            x2="330"
            y2="370"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#162447" />
            <stop offset="45%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#060B18" />
          </linearGradient>

          {/* Glass Highlight Sheen */}
          <linearGradient
            id="hero-shield-glass"
            x1="100"
            y1="60"
            x2="250"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0B132B" stopOpacity="0" />
          </linearGradient>

          {/* Glowing AI Core Radial Gradient */}
          <radialGradient
            id="hero-ai-core-glow"
            cx="50%"
            cy="46%"
            r="38%"
          >
            <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#06B6D4" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#7C3AED" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#060B18" stopOpacity="0" />
          </radialGradient>

          {/* Holographic Scan Line Gradient */}
          <linearGradient
            id="hero-scan-line"
            x1="95"
            y1="205"
            x2="325"
            y2="205"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
            <stop offset="25%" stopColor="#22D3EE" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#A78BFA" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft Ground Contact Shadow */}
        <ellipse
          cx="210"
          cy="392"
          rx="105"
          ry="12"
          fill="#0284C7"
          fillOpacity="0.2"
        />

        {/* Outer Holographic Orbital Ring */}
        <ellipse
          cx="210"
          cy="205"
          rx="168"
          ry="58"
          transform="rotate(-16 210 205)"
          stroke="#38BDF8"
          strokeOpacity="0.24"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <ellipse
          cx="210"
          cy="205"
          rx="156"
          ry="50"
          transform="rotate(18 210 205)"
          stroke="#8B5CF6"
          strokeOpacity="0.22"
          strokeWidth="1.2"
          strokeDasharray="4 8"
        />

        {/* 3D Depth Back Bevel Plate */}
        <path
          d="M210 34L82 88V198C82 288 136 355 210 380C284 355 338 288 338 198V88L210 34Z"
          fill="#070D1F"
          stroke="#1E3A8A"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Primary Bevelled Metallic Shield Hull */}
        <path
          d="M210 42L90 93V196C90 281 141 345 210 369C279 345 330 281 330 196V93L210 42Z"
          fill="url(#hero-shield-body)"
          stroke="url(#hero-shield-outer-rim)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />

        {/* Inner Recessed Glass-Armor Plate */}
        <path
          d="M210 62L108 105V194C108 267 151 323 210 345C269 323 312 267 312 194V105L210 62Z"
          fill="#0A1229"
          stroke="#38BDF8"
          strokeOpacity="0.45"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />

        {/* Left Facet Glass Specular Reflection */}
        <path
          d="M210 62L108 105V194C108 267 151 323 210 345V62Z"
          fill="url(#hero-shield-glass)"
        />

        {/* Subtle Internal Hexagonal Grid / Security Mesh */}
        <g stroke="#38BDF8" strokeOpacity="0.16" strokeWidth="1">
          <path d="M210 62V345" />
          <path d="M108 150H312" />
          <path d="M114 235H306" />
          <path d="M145 90L275 290" />
          <path d="M275 90L145 290" />
        </g>

        {/* Digital Circuit Lines Radiating from AI Core */}
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Top Circuit */}
          <path
            d="M210 148V96L186 78"
            stroke="#22D3EE"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
          <path
            d="M210 112L234 92"
            stroke="#A78BFA"
            strokeWidth="1.8"
            strokeOpacity="0.75"
          />
          {/* Left Circuit */}
          <path
            d="M168 182L132 162V132"
            stroke="#22D3EE"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
          <path
            d="M168 206L134 228V258"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          {/* Right Circuit */}
          <path
            d="M252 182L288 162V132"
            stroke="#22D3EE"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
          <path
            d="M252 206L286 228V258"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          {/* Bottom Circuit */}
          <path
            d="M210 238V304"
            stroke="#22D3EE"
            strokeWidth="2.4"
            strokeOpacity="0.9"
          />
          <path
            d="M192 272L170 296"
            stroke="#38BDF8"
            strokeWidth="1.8"
            strokeOpacity="0.7"
          />
          <path
            d="M228 272L250 296"
            stroke="#A78BFA"
            strokeWidth="1.8"
            strokeOpacity="0.7"
          />
        </g>

        {/* Circuit Terminal Nodes */}
        <g>
          <circle cx="186" cy="78" r="4" fill="#22D3EE" />
          <circle cx="234" cy="92" r="3.5" fill="#A78BFA" />
          <circle cx="132" cy="132" r="4" fill="#22D3EE" />
          <circle cx="288" cy="132" r="4" fill="#22D3EE" />
          <circle cx="134" cy="258" r="4" fill="#A78BFA" />
          <circle cx="286" cy="258" r="4" fill="#A78BFA" />
          <circle cx="210" cy="304" r="4.5" fill="#22D3EE" />
          <circle cx="170" cy="296" r="3.2" fill="#38BDF8" />
          <circle cx="250" cy="296" r="3.2" fill="#A78BFA" />
        </g>

        {/* Central AI Core Aura */}
        <circle cx="210" cy="193" r="68" fill="url(#hero-ai-core-glow)" />

        {/* Outer AI Containment Ring */}
        <circle
          cx="210"
          cy="193"
          r="46"
          stroke="#38BDF8"
          strokeOpacity="0.65"
          strokeWidth="2"
          strokeDasharray="14 6"
        />

        {/* Inner Violet AI Ring */}
        <circle
          cx="210"
          cy="193"
          r="35"
          fill="#0B132B"
          stroke="#8B5CF6"
          strokeOpacity="0.85"
          strokeWidth="2"
        />

        {/* Faceted Octahedral AI Core */}
        <polygon
          points="210,165 234,193 210,221 186,193"
          fill="#0284C7"
          fillOpacity="0.45"
          stroke="#67E8F9"
          strokeWidth="2"
        />
        <polygon
          points="210,174 225,193 210,212 195,193"
          fill="#22D3EE"
          stroke="#E0F2FE"
          strokeWidth="1.5"
        />
        <circle cx="210" cy="193" r="6" fill="#FFFFFF" />

        {/* Holographic Scanning Beam */}
        <rect
          x="102"
          y="202"
          width="216"
          height="3.5"
          rx="1.75"
          fill="url(#hero-scan-line)"
        />

        {/* Subtle Floating Particles */}
        <g fill="#67E8F9" fillOpacity="0.75">
          <circle cx="62" cy="118" r="2.5" />
          <circle cx="358" cy="134" r="2" />
          <circle cx="74" cy="276" r="2" />
          <circle cx="348" cy="264" r="2.8" />
          <circle cx="145" cy="48" r="1.8" />
          <circle cx="282" cy="52" r="2.2" />
        </g>
        <g fill="#A78BFA" fillOpacity="0.75">
          <circle cx="54" cy="195" r="2.2" />
          <circle cx="366" cy="198" r="2.2" />
          <circle cx="118" cy="346" r="2" />
          <circle cx="304" cy="342" r="2" />
        </g>
      </svg>
    </div>
  );
};
