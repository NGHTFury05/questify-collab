/**
 * useHaptics - lightweight vibration hook with user preference.
 * - Respects browser support and permission.
 * - Persists setting in localStorage under 'haptics:enabled'.
 * - Patterns:
 *    - success(): short 20ms
 *    - error(): 10ms x3 with small gaps
 *    - impact(): medium 30ms
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'haptics:enabled';

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function useHaptics() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored != null) setEnabled(stored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const set = useCallback((value) => {
    setEnabled(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }, []);

  const vibrate = useCallback((pattern) => {
    if (!enabled || !canVibrate()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }, [enabled]);

  const success = useCallback(() => vibrate(20), [vibrate]);
  const impact = useCallback(() => vibrate(30), [vibrate]);
  const error = useCallback(() => vibrate([10, 40, 10, 40, 10]), [vibrate]);

  return { enabled, setEnabled: set, vibrate, success, error, impact };
}

export default useHaptics;