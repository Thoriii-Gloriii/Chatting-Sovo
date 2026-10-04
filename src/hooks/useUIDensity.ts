import { useEffect, useState } from 'react';
import { getUIDensity, type UIDensityInfo } from '../lib/deviceResolution';

/**
 * Keeps the app's density-aware spacing in sync with the device it's
 * actually running on. Writes the current scale/density onto
 * document.documentElement so any stylesheet can consume it via
 * var(--ui-scale) or a [data-density="..."] selector, without every
 * component needing to call this hook individually.
 *
 * Call once, near the top of App.tsx (before any conditional early
 * return, so the hook order stays stable across renders).
 *
 * Re-evaluates on resize and orientation change — e.g. a foldable
 * unfolding, or a browser window being resized — not just on mount.
 */
export function useUIDensity(): UIDensityInfo {
  const [info, setInfo] = useState<UIDensityInfo>(() => getUIDensity());

  useEffect(() => {
    const apply = (next: UIDensityInfo) => {
      const root = document.documentElement;
      root.style.setProperty('--ui-scale', String(next.scale));
      root.dataset.density = next.density;
    };

    // Set immediately on mount.
    apply(info);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handleChange = () => {
      // Debounce so a drag-resize or a rotation animation doesn't
      // thrash layout recalculation.
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const next = getUIDensity();
        setInfo(next);
        apply(next);
      }, 150);
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
    // Deliberately run once: `apply` on mount uses the initial `info`
    // from useState's lazy initializer, and every subsequent update
    // goes through handleChange, not this effect re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return info;
}
