"use client";

import { useState, useEffect } from "react";
// NOTE: Assumes AppInfo type is globally defined in your project types
// For this single file demonstration, we will define the type locally.
type AppInfo = {
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
};

export default function PingButton() {
  const [pingRes, setPingRes] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  // Function to load app info on mount
  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        if (window.api && window.api.getAppInfo) {
          const info = await window.api.getAppInfo();
          setAppInfo(info);
        }
      } catch (e) {
        console.error("Failed to fetch app info:", e);
      }
    };
    fetchAppInfo();
  }, []); // Run only once on component mount

  const onPing = async () => {
    try {
      if (window.api && window.api.ping) {
        const r = await window.api.ping();
        setPingRes(String(r));
      }
    } catch (e) {
      console.error("IPC Error:", e);
      setPingRes("IPC Error: Check console for details.");
    }
  };

  const onBeep = async () => {
    try {
      if (window.api && window.api.beep) {
        await window.api.beep();
        // Optionally update the UI to confirm the action
        setPingRes("Beep sound triggered in Main Process!");
      }
    } catch (e) {
      console.error("Beep Error:", e);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-gray-50 rounded-xl shadow-2xl border border-gray-200 w-full max-w-xl mx-auto space-y-4">
      {/* App Info Display */}
      <div className="w-full text-left p-3 border-b border-indigo-100 mb-4">
        <h2 className="text-lg font-bold text-indigo-700 mb-2">
          Application Runtimes
        </h2>
        {appInfo ? (
          <div className="text-sm space-y-1 font-mono text-gray-600">
            <p>
              Node Version:{" "}
              <span className="text-indigo-900 font-semibold">
                {appInfo.nodeVersion}
              </span>
            </p>
            <p>
              Electron Version:{" "}
              <span className="text-indigo-900 font-semibold">
                {appInfo.electronVersion}
              </span>
            </p>
            <p>
              App Version:{" "}
              <span className="text-indigo-900 font-semibold">
                {appInfo.appVersion}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Loading version info via IPC...
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={onPing}
          className="px-6 py-3 text-white bg-indigo-600 rounded-full transition duration-150 ease-in-out hover:bg-indigo-700 shadow-md hover:shadow-lg"
        >
          Ping Main (IPC Test)
        </button>
        <button
          onClick={onBeep}
          className="px-6 py-3 text-white bg-pink-600 rounded-full transition duration-150 ease-in-out hover:bg-pink-700 shadow-md hover:shadow-lg"
        >
          {/* Now using the secure IPC bridge */}
          Trigger System Beep
        </button>
      </div>

      {/* IPC Result */}
      <div className="mt-4 pt-4 border-t w-full text-center">
        <p className="text-sm font-medium text-gray-500">
          Last IPC Action Result:
        </p>
        <div
          id="ipc-result"
          className={`mt-1 text-base font-mono font-semibold ${pingRes?.includes("Error") ? "text-red-600" : "text-green-600"}`}
        >
          {pingRes ?? "Click an action button above."}
        </div>
      </div>
    </div>
  );
}
