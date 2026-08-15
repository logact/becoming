import React, { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useShellNavigation } from '../navigation/NavigationShell';
import type { DestinationId } from '../navigation/NavigationShell';

/**
 * Cross-destination detail navigation bridge.
 *
 * The shell keeps one list -> detail stack per destination and unmounts the
 * previously visible destination on a tab switch, so a row inside one
 * destination (e.g. a pursued Goal row on the Project Overview) cannot push
 * a detail route onto another destination's stack directly. This module
 * provides the prototype's `go(tab, detail)` behavior within the shell
 * contract: the row records a pending request and switches destination; the
 * bridge, wrapped around each destination's list by `appDestinations`,
 * completes the detail push once the target destination is active.
 */

interface PendingDetail {
  destination: DestinationId;
  entityId: string;
}

let pendingDetail: PendingDetail | null = null;

/**
 * Record a cross-destination detail request. Call `switchDestination` with
 * the same destination immediately afterwards; the bridge on the target
 * destination consumes the request and pushes the detail route.
 */
export function requestCrossDestinationDetail(request: PendingDetail): void {
  pendingDetail = request;
}

/**
 * Wraps a destination's list route. When this destination becomes active
 * with a pending cross-destination detail request, it pushes the requested
 * detail route onto the active stack.
 */
export function CrossDestinationDetailBridge({ children }: { children: ReactNode }) {
  const navigation = useShellNavigation();
  useEffect(() => {
    if (pendingDetail !== null && pendingDetail.destination === navigation.destination) {
      const request = pendingDetail;
      pendingDetail = null;
      navigation.openDetail(request.entityId);
    }
  }, [navigation]);
  return <>{children}</>;
}
