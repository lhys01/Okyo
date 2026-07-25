export type InitialScanAction = 'camera' | 'photos';

export function consumeInitialScanAction<T extends { initialAction?: InitialScanAction }>(params: T | undefined) {
  const action = params?.initialAction ?? null;
  if (!action) {
    return { action: null, params };
  }

  return {
    action,
    params: { ...params, initialAction: undefined },
  };
}

export function getScanSourceForInitialAction(action: InitialScanAction) {
  return action === 'camera' ? 'camera' as const : 'photos' as const;
}
