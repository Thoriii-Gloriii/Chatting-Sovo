import { useEffect, useState } from 'react';
import { getUIDensity, UIDensityResult } from '../lib/deviceResolution';

/**
 * React hook wrapper around getUIDensity(). Re-evaluates on resize,
 * orientation change, and browser zoom (which also fires a resize event),
 * so foldables and users manually zooming the page are respected live
 * rather than only on first mount.
 */
export function useUIDensity(): UIDensityResult {
  const [result, setResult] = useState<UIDensityResult>(() => getUIDensity());

  useEffect(() => {
    const recalc = () => setResult(getUIDensity());

    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', recalc);

    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('orientationchange', recalc);
    };
  }, []);

  return result;
}
