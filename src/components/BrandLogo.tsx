/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Brand Logo Component
 * Minimal, recognizable shield symbol with a subtle AI neural node and circuit detail.
 * Used consistently across the navbar, footer, login/vault card, and analysis views.
 */

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'dark',
  showWordmark = true,
  subtitle,
  className = '',
}) => {
  const iconDimensions =
    size === 'sm'
      ? 'w-6 h-6'
      : size === 'lg'
      ? 'w-9 h-9'
      : 'w-7 h-7 sm:w-8 sm:h-8';

  const textSize =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-xl sm:text-2xl'
      : 'text-base sm:text-lg';

  const wordmarkColor =
    variant === 'dark' ? 'text-white' : 'text-slate-900';

  const accentTextColor =
    variant === 'dark' ? 'text-cyan-400' : 'text-blue-600';

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      data-testid="openshield-brand-logo"
    >
      {/* Minimal Shield Symbol with AI Neural Node & Circuit Detail */}
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDimensions} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="os-brand-shield-grad"
            x1="4"
            y1="3"
            x2="32"
            y2="33"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="55%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient
            id="os-brand-inner-grad"
            x1="8"
            y1="6"
            x2="28"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* Outer Bevelled Shield Silhouette */}
        <path
          d="M18 2.75L5.75 7.75V16.8C5.75 24.85 10.95 31.45 18 33.5C25.05 31.45 30.25 24.85 30.25 16.8V7.75L18 2.75Z"
          fill="url(#os-brand-inner-grad)"
          stroke="url(#os-brand-shield-grad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Subtle Inner Shield Contour */}
        <path
          d="M18 6.1L8.8 9.85V16.6C8.8 22.85 12.7 28.05 18 29.85C23.3 28.05 27.2 22.85 27.2 16.6V9.85L18 6.1Z"
          stroke="#38BDF8"
          strokeOpacity="0.28"
          strokeWidth="1"
        />

        {/* AI Circuit Traces */}
        <path
          d="M18 11.2V14.8M18 20.2V24.2M12.5 14.5L15.4 16.3M23.5 14.5L20.6 16.3"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Peripheral Neural Nodes */}
        <circle cx="18" cy="10.5" r="1.35" fill="#38BDF8" />
        <circle cx="12" cy="14.1" r="1.25" fill="#A78BFA" />
        <circle cx="24" cy="14.1" r="1.25" fill="#A78BFA" />
        <circle cx="18" cy="24.8" r="1.35" fill="#38BDF8" />

        {/* Central Glowing AI Core Node */}
        <circle
          cx="18"
          cy="17.5"
          r="3.1"
          fill="#06B6D4"
          stroke="#E0F2FE"
          strokeWidth="1.2"
        />
      </svg>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display ${textSize} font-bold tracking-tight ${wordmarkColor} whitespace-nowrap`}
          >
            Open<span className={accentTextColor}>Shield</span>
          </span>
          {subtitle && (
            <span className="text-[10px] font-medium text-slate-400 tracking-wide mt-0.5">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
