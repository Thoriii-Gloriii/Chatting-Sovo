/**
 * Resolution-aware UI density.
 *
 * Detects device pixel ratio + viewport width and derives a spacing/sizing
 * scale coefficient. This is intentionally NOT a font-size scaler — text
 * stays at accessible minimums regardless of density (see design spec
 * section 23). The scale only nudges padding, gaps, avatar sizes and
 * touch-target spacing so the UI feels native across the fragmented
 * Android device landscape (budget 150ppi tablets through flagship
 * 460+ppi phones) without hard pixel breakpoints.
 */

export type UIDensity = 'high-dpi' | 'standard' | 'low-dpi';

export interface UIDensityResult {
  scale: number;
  density: UIDensity;
}

export function getUIDensity(): UIDensityResult {
  if (typeof window === 'undefined') {
    return { scale: 1, density: 'standard' };
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;

  // High-DPI phones (>2.5x, narrow viewport): slightly tighter spacing —
  // more content fits comfortably without feeling cramped at that density.
  if (dpr > 2.5 && width < 420) {
    return { scale: 0.95, density: 'high-dpi' };
  }

  // Typical phones (1.5x–2.5x): baseline spacing.
  if (dpr >= 1.5 && width < 500) {
    return { scale: 1, density: 'standard' };
  }

  // Low-DPI tablets, desktop browsers, or zoomed-out views: a touch more
  // breathing room so targets stay comfortably tappable.
  return { scale: 1.05, density: 'low-dpi' };
}
