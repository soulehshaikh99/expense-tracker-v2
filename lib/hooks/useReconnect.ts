'use client';

import { useEffect, useRef } from 'react';

/** Call `onReconnect` when `online` goes from false to true. */
export function useReconnect(online: boolean, onReconnect: () => void): void {
  const wasOnline = useRef(online);
  const callback = useRef(onReconnect);

  useEffect(() => {
    callback.current = onReconnect;
  });

  useEffect(() => {
    if (online && !wasOnline.current) callback.current();
    wasOnline.current = online;
  }, [online]);
}
