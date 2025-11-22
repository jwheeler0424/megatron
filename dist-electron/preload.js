"use strict";const e=require("electron"),i={ping:()=>e.ipcRenderer.invoke("ping")};e.contextBridge.exposeInMainWorld("api",i);
