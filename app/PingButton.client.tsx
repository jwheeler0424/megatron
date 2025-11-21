/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';

export default function PingButton() {
  const [res, setRes] = useState<string | null>(null);
  const onPing = async () => {
    try {
      // window.api is provided by the preload bridge
      const r = await (window as any).api?.ping?.();
      setRes(String(r));
    } catch (e) {
      setRes('error: ' + String(e));
    }
  };

  return (
    <>
      <button onClick={onPing} className="px-4 py-2 rounded bg-slate-700 text-white">
        Ping Main
      </button>
      <div id="ipc-result" className="mt-2 text-sm text-slate-600">
        {res ?? 'no response yet'}
      </div>
    </>
  );
}
