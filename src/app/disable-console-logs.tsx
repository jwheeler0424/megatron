'use client';

import { useEffect } from 'react';

const noop = (..._args: unknown[]) => {};

export function DisableConsoleLogs() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      console.log = noop;
    }
  }, []);

  return null;
}
