/**
 * Device resolution / pixel-density detection.
 *
 * This is a pure function (no React, no DOM writes) so it's easy to
 * unit test and reuse outside a component. See useUIDensity() for the
 * reactive hook that keeps this in sync with the live viewport and
 * writes it onto :root as --ui-scale / [data-density].
 *
 * Design intent (spec section 23): the returned `scale` is meant to
 * adjust spacing, gaps, avatar/thumbnail dimensions and component
 * sizing — never font-size or line-height. Reducing text size on
 * high-DPI phones trades readability for density, which the spec
 * explicitly rules out. Keep typography at its base size; let layout
 * breathe more or less instead.
 */

export type UIDensity = 'high-dpi' | 'standard' | 'low-dpi';

export interface UIDensityInfo {
  scale: number;
  density: UIDensity;
}

export function getUIDensity(): UIDensityInfo {
  if (typeof window === 'undefined') {
    // SSR / non-browser environment fallback.
    return { scale: 1, density: 'standard' };
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;

  // High-DPI phones (flagship-tier screens): slightly tighter spacing
  // so more content fits without the UI feeling sparse.
  if (dpr > 2.5 && width < 420) {
    return { scale: 0.95, density: 'high-dpi' };
  }

  // Standard phones: baseline, no adjustment.
  if (dpr >= 1.5 && width < 500) {
    return { scale: 1, density: 'standard' };
  }

  // Low-DPI devices, budget Android hardware, or a desktop browser at
  // a wide zoom level: a little extra breathing room and slightly
  // larger touch targets.
  return { scale: 1.05, density: 'low-dpi' };
}
