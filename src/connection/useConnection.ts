import { useEffect, useState } from 'react';
import { clearLocalWorkspaceData } from './cache-reset';
import { ConnectionManager } from './connection-manager';
import { deviceConnectionStore } from './device-store';

export function useConnection(active: boolean) {
  const [manager] = useState(() => new ConnectionManager({ store: deviceConnectionStore, clearWorkspaceData: clearLocalWorkspaceData }));
  const [snapshot, setSnapshot] = useState(manager.getSnapshot);
  useEffect(() => {
    const unsubscribe = manager.subscribe(setSnapshot);
    void manager.start();
    return () => { unsubscribe(); manager.dispose(); };
  }, [manager]);
  useEffect(() => { manager.setActive(active); }, [manager, active]);
  const enabled = active && snapshot.hasToken && !['loading', 'authentication-required', 'resetting', 'reset-error', 'storage-error'].includes(snapshot.status);
  return { manager, snapshot, client: manager.getClient(), enabled };
}
