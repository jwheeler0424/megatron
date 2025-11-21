// Copyright (C) 2025 Jonathan Wheeler
// 
// This file is part of megatron.
// 
// megatron is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// megatron is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with megatron.  If not, see <https://www.gnu.org/licenses/>.

import { contextBridge, ipcRenderer } from 'electron';

export type Api = {
  ping: () => Promise<string>;
};

const api: Api = {
  ping: () => ipcRenderer.invoke('ping')
};

contextBridge.exposeInMainWorld('api', api);