import React, { createContext, useContext } from 'react';

export interface CaptureRevisionValue {
  revision: number;
  increment: () => void;
}

const NO_CAPTURE_REVISION: CaptureRevisionValue = {
  revision: 0,
  increment: () => undefined,
};

export const CaptureRevisionContext = createContext<CaptureRevisionValue>(NO_CAPTURE_REVISION);

/** Changes after a successful global capture so mounted collection pages can reload. */
export function useCaptureRevision(): number {
  return useContext(CaptureRevisionContext).revision;
}

/** Used by the shell-owned capture adapter after the transaction succeeds. */
export function useCaptureRevisionActions(): CaptureRevisionValue {
  return useContext(CaptureRevisionContext);
}
