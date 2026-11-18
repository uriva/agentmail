import type {
  InstaQLLifecycleState,
  InstaQLOptions,
  ValidQuery,
} from "@instantdb/core";
import { init } from "@instantdb/react";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import schema, { type AppSchema } from "../../instant.schema.ts";

// @ts-ignore: Vite injects import.meta.env at build time
const INSTANT_APP_ID: string = import.meta.env?.VITE_INSTANT_APP_ID ?? "";

type ClientDb = ReturnType<typeof init<typeof schema>>;
const dbCell: ClientDb[] = [];

const getDb = (): ClientDb =>
  dbCell[0] ??
    (dbCell[0] = init({
      appId: INSTANT_APP_ID || "00000000-0000-0000-0000-000000000000",
      schema,
      devtool: false,
    }));

const transientPatterns = [
  "handle-receive",
  "timed out",
  "timeout",
  "took too long",
  "failed to fetch",
  "network",
  "load failed",
  "rate limit",
];

const permanentPatterns = [
  "permission",
  "access denied",
  "unauthorized",
  "forbidden",
];

const extractErrorMessage = (err: unknown): string =>
  typeof err === "string"
    ? err
    : err && typeof err === "object" && "message" in err &&
        typeof err.message === "string"
    ? err.message
    : "";

export const isTransientQueryError = (err: unknown): boolean => {
  const msg = extractErrorMessage(err).toLowerCase();
  return Boolean(msg) &&
    !permanentPatterns.some((p) => msg.includes(p)) &&
    transientPatterns.some((p) => msg.includes(p));
};

const maxRetries = 3;
const retryBaseDelayMs = 400;
const resubscribeGapMs = 60;

export const useQuery = <Q extends ValidQuery<Q, AppSchema>>(
  query: null | Q,
  opts?: InstaQLOptions,
): InstaQLLifecycleState<AppSchema, Q, false> & { retry: () => void } => {
  const queryKey = query ? JSON.stringify(query) : "";
  const [paused, setPaused] = useState(false);
  const [waitingRetry, setWaitingRetry] = useState(false);
  const retryCountRef = useRef(0);
  const prevKeyRef = useRef(queryKey);
  const res = getDb().useQuery(paused ? null : query, opts);
  const lastDataRef = useRef<typeof res.data>(undefined);

  if (prevKeyRef.current !== queryKey) {
    prevKeyRef.current = queryKey;
    retryCountRef.current = 0;
    lastDataRef.current = undefined;
  }

  useEffect(() => {
    setWaitingRetry(false);
    setPaused(false);
  }, [queryKey]);

  if (res.data !== undefined) {
    lastDataRef.current = res.data;
  }

  useEffect(() => {
    if (
      query && !paused && !waitingRetry && !res.isLoading && !res.error &&
      res.data !== undefined
    ) {
      retryCountRef.current = 0;
    }
  }, [queryKey, paused, waitingRetry, res.isLoading, res.error, res.data]);

  const transient = isTransientQueryError(res.error);
  const canAutoRetry = Boolean(
    query && res.error && transient && retryCountRef.current < maxRetries &&
      !waitingRetry && !paused,
  );

  useEffect(() => {
    if (!canAutoRetry) return;
    retryCountRef.current += 1;
    setWaitingRetry(true);
  }, [canAutoRetry, queryKey]);

  useEffect(() => {
    if (!waitingRetry) return;
    const timer = setTimeout(() => {
      setWaitingRetry(false);
      setPaused(true);
    }, retryBaseDelayMs * Math.max(1, retryCountRef.current));
    return () => clearTimeout(timer);
  }, [waitingRetry]);

  useEffect(() => {
    if (!paused) return;
    const timer = setTimeout(() => setPaused(false), resubscribeGapMs);
    return () => clearTimeout(timer);
  }, [paused]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setWaitingRetry(false);
    setPaused(true);
  }, []);

  const isRetrying = canAutoRetry || waitingRetry || paused;
  const effectiveData = res.data ?? lastDataRef.current;

  return (isRetrying || (effectiveData !== undefined && transient)
    ? {
      ...res,
      data: effectiveData,
      error: undefined,
      isLoading: effectiveData === undefined,
      retry,
    }
    : { ...res, retry }) as InstaQLLifecycleState<AppSchema, Q, false> & {
      retry: () => void;
    };
};

export const useInfiniteQuery = <Q extends ValidQuery<Q, AppSchema>>(
  query: Q,
  opts?: InstaQLOptions,
) => {
  const queryKey = query ? JSON.stringify(query) : "";
  const [paused, setPaused] = useState(false);
  const [waitingRetry, setWaitingRetry] = useState(false);
  const retryCountRef = useRef(0);
  const prevKeyRef = useRef(queryKey);
  const res = getDb().useInfiniteQuery(
    (paused ? null : query) as Q,
    opts,
  );
  const lastDataRef = useRef<typeof res.data>(undefined);

  if (prevKeyRef.current !== queryKey) {
    prevKeyRef.current = queryKey;
    retryCountRef.current = 0;
    lastDataRef.current = undefined;
  }

  useEffect(() => {
    setWaitingRetry(false);
    setPaused(false);
  }, [queryKey]);

  if (res.data !== undefined) {
    lastDataRef.current = res.data;
  }

  useEffect(() => {
    if (
      query && !paused && !waitingRetry && !res.isLoading && !res.error &&
      res.data !== undefined
    ) {
      retryCountRef.current = 0;
    }
  }, [queryKey, paused, waitingRetry, res.isLoading, res.error, res.data]);

  const transient = isTransientQueryError(res.error);
  const canAutoRetry = Boolean(
    query && res.error && transient && retryCountRef.current < maxRetries &&
      !waitingRetry && !paused,
  );

  useEffect(() => {
    if (!canAutoRetry) return;
    retryCountRef.current += 1;
    setWaitingRetry(true);
  }, [canAutoRetry, queryKey]);

  useEffect(() => {
    if (!waitingRetry) return;
    const timer = setTimeout(() => {
      setWaitingRetry(false);
      setPaused(true);
    }, retryBaseDelayMs * Math.max(1, retryCountRef.current));
    return () => clearTimeout(timer);
  }, [waitingRetry]);

  useEffect(() => {
    if (!paused) return;
    const timer = setTimeout(() => setPaused(false), resubscribeGapMs);
    return () => clearTimeout(timer);
  }, [paused]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setWaitingRetry(false);
    setPaused(true);
  }, []);

  const isRetrying = canAutoRetry || waitingRetry || paused;
  const effectiveData = res.data ?? lastDataRef.current;

  return isRetrying || (effectiveData !== undefined && transient)
    ? {
      ...res,
      data: effectiveData,
      error: undefined,
      isLoading: effectiveData === undefined,
      retry,
    }
    : { ...res, retry };
};

export const useAuth = () => getDb().useAuth();

export const auth = {
  sendMagicCode: (params: Parameters<ClientDb["auth"]["sendMagicCode"]>[0]) =>
    getDb().auth.sendMagicCode(params),
  signInWithMagicCode: (
    params: Parameters<ClientDb["auth"]["signInWithMagicCode"]>[0],
  ) => getDb().auth.signInWithMagicCode(params),
  signOut: () => getDb().auth.signOut(),
};

export { getDb as db };
