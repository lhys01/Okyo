import { useCallback, useEffect, useRef, useState } from 'react';

type BranchPersistence<Draft> = {
  write: (draft: Draft) => Promise<Draft | null>;
};

export type BranchTransitionResult<Draft> =
  | { accepted: false; draft: Draft }
  | { accepted: true; draft: Draft; destination: string };

/**
 * A small transition gate shared by the active branch flows. A successful
 * transition stays locked until the destination has committed, so two rapid
 * presses cannot reduce through two consecutive branch steps.
 */
export function createBranchTransitionGate<Draft, Event>({
  getStep,
  persist,
  reduce,
}: {
  getStep: (draft: Draft) => string;
  persist: (draft: Draft) => Promise<Draft | null>;
  reduce: (draft: Draft, event: Event) => Draft;
}) {
  let locked = false;

  return {
    get isLocked() {
      return locked;
    },
    release() {
      locked = false;
    },
    async run(draft: Draft, event: Event): Promise<BranchTransitionResult<Draft>> {
      if (locked) return { accepted: false, draft };
      const next = reduce(draft, event);
      if (getStep(next) === getStep(draft)) return { accepted: false, draft };

      locked = true;
      const persisted = await persist(next);
      if (persisted === null) {
        locked = false;
        return { accepted: false, draft };
      }

      return { accepted: true, draft: next, destination: getStep(next) };
    },
  };
}

/**
 * Persists branch answers in order and only releases Back/Next after React has
 * committed the requested branch screen. The reducer remains the sole owner
 * of route validation and answer normalization.
 */
export function usePersistedBranchTransition<Draft, Event>({
  draft,
  getStep,
  hydrated,
  persistence,
  reduce,
  dispatch,
}: {
  draft: Draft;
  getStep: (draft: Draft) => string;
  hydrated: boolean;
  persistence: BranchPersistence<Draft>;
  reduce: (draft: Draft, event: Event) => Draft;
  dispatch: (event: Event) => void;
}) {
  const draftRef = useRef(draft);
  const getStepRef = useRef(getStep);
  const reduceRef = useRef(reduce);
  const persistenceRef = useRef(persistence);
  const writeTailRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  const pendingRef = useRef<{
    destination: string;
    resolve: (advanced: boolean) => void;
  } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  draftRef.current = draft;
  getStepRef.current = getStep;
  reduceRef.current = reduce;
  persistenceRef.current = persistence;

  const enqueueWrite = useCallback((nextDraft: Draft) => {
    const write = async () => {
      try {
        return await persistenceRef.current.write(nextDraft);
      } catch {
        return null;
      }
    };
    const queued = writeTailRef.current.then(write, write);
    writeTailRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  const gateRef = useRef<ReturnType<typeof createBranchTransitionGate<Draft, Event>> | null>(null);
  if (gateRef.current === null) {
    gateRef.current = createBranchTransitionGate({
      getStep: (nextDraft) => getStepRef.current(nextDraft),
      persist: (nextDraft) => enqueueWrite(nextDraft),
      reduce: (currentDraft, event) => reduceRef.current(currentDraft, event),
    });
  }

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || getStep(draft) !== pending.destination) return;
    pendingRef.current = null;
    gateRef.current?.release();
    setIsTransitioning(false);
    pending.resolve(true);
  }, [draft, getStep]);

  useEffect(() => () => {
    mountedRef.current = false;
    const pending = pendingRef.current;
    pendingRef.current = null;
    gateRef.current?.release();
    pending?.resolve(false);
  }, []);

  const persistDraft = useCallback(async (nextDraft: Draft) => enqueueWrite(nextDraft), [enqueueWrite]);

  const schedulePersist = useCallback((nextDraft: Draft) => {
    void enqueueWrite(nextDraft);
  }, [enqueueWrite]);

  const transition = useCallback(async (event: Event) => {
    if (!hydrated) return false;
    const gate = gateRef.current;
    if (!gate) return false;

    setIsTransitioning(true);
    const result = await gate.run(draftRef.current, event);
    if (!result.accepted) {
      // A duplicate press sees the first transition's lock. Do not clear it:
      // the first caller still owns persistence and the destination commit.
      if (!gate.isLocked && mountedRef.current) setIsTransitioning(false);
      return false;
    }
    if (!mountedRef.current) {
      gate.release();
      return false;
    }

    return new Promise<boolean>((resolve) => {
      pendingRef.current = { destination: result.destination, resolve };
      draftRef.current = result.draft;
      dispatch(event);
    });
  }, [dispatch, hydrated]);

  return { isTransitioning, persistDraft, schedulePersist, transition };
}
