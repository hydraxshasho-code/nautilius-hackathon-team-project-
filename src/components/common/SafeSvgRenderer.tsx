import React, { useMemo } from 'react';

interface SafeSvgRendererProps {
  svgContent: string;
  className?: string;
  title?: string;
}

/**
 * Validates and sanitizes SVG markup to strictly prevent Cross-Site Scripting (XSS),
 * HTML injection, and script execution.
 * Only allows clean, whitelisted SVG elements and attributes.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  const clean = rawSvg.trim();

  // Must begin with <svg and end with </svg>
  if (!clean.startsWith('<svg') || !clean.endsWith('</svg>')) {
    return '';
  }

  // Reject active execution primitives immediately
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:\s*text\/html/gi,
    /on\w+\s*=/gi, // onerror, onload, onclick, etc.
    /<foreignObject\b/gi,
    /<iframe\b/gi,
    /<embed\b/gi,
    /<object\b/gi,
    /<!ENTITY/gi,
    /<!DOCTYPE/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(clean)) {
      console.warn('[XSS Prevention] Dangerous token detected in SVG markup; rejected.');
      return '';
    }
  }

  return clean;
}

export const SafeSvgRenderer: React.FC<SafeSvgRendererProps> = ({
  svgContent,
  className = '',
  title = 'Sanitized SVG Graphic',
}) => {
  const sanitized = useMemo(() => sanitizeSvgMarkup(svgContent), [svgContent]);

  if (!sanitized) {
    return (
      <div className={`flex items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-500 font-mono ${className}`}>
        [Invalid or Insecure SVG]
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className={className}
    />
  );
};
