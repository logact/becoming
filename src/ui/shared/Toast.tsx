import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

export interface ToastApi {
  /**
   * Show a brief success confirmation (e.g. 'Goal created'). Toasts are
   * transient feedback only — they are never a substitute for persisted
   * history, and must only be shown after the service commits.
   */
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Brief success confirmation announced to assistive technology. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('useToast must be used within a ToastProvider');
  return api;
}

const TOAST_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: string) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={styles.container}>
        {children}
        {message !== null && (
          <View
            style={styles.toast}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            pointerEvents="none"
          >
            <Text style={styles.toastText} maxFontSizeMultiplier={2}>
              ✓ {message}
            </Text>
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    bottom: spacing.xl * 2,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toastText: {
    color: colors.white,
    fontWeight: '600',
  },
});
