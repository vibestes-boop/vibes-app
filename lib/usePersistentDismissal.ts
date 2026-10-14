import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
/** Wait for the account's preference before showing a dismissible prompt. */
export function usePersistentDismissal(key: string | null) {
  const [state, setState] = useState<{ key: string | null; dismissed: boolean }>({ key: null, dismissed: true });
  useEffect(() => {
    if (!key) return;
    let active = true;
    AsyncStorage.getItem(key).then(value => { if (active) setState({ key, dismissed: value === '1' }); }).catch(() => { if (active) setState({ key, dismissed: false }); });
    return () => { active = false; };
  }, [key]);
  const dismiss = useCallback(() => {
    if (!key) return;
    setState({ key, dismissed: true });
    void AsyncStorage.setItem(key, '1').catch(() => {});
  }, [key]);
  return { visible: !!key && state.key === key && !state.dismissed, dismiss };
}
