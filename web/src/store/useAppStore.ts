import { create } from 'zustand';
import { AppState, SystemStatus, ToolInfo, RealtimeEvent } from '../types';
import { useConfigStore } from './configStore';

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  connected: false,
  systemStatus: null,
  tools: [],
  events: [],
  selectedServer: null,
  selectedTool: null,

  serverLogs: {},

  // Operation methods
  setConnected: (connected: boolean) => {
    set({ connected });
  },

  addServerLog: (log: any) => {
    set(state => {
      const currentServerLogs = state.serverLogs[log.serverName] || [];
      const updatedServerLogs = [...currentServerLogs, log].slice(-100);
      return {
        serverLogs: {
          ...state.serverLogs,
          [log.serverName]: updatedServerLogs,
        },
      };
    });
  },

  setSystemStatus: (status: SystemStatus) => {
    set({ systemStatus: status });

    // Update individual server statuses in configStore
    status.servers.forEach(serverStatus => {
      useConfigStore.getState().syncServerStatus(serverStatus.name, {
        connected: serverStatus.connected,
        toolCount: serverStatus.toolCount,
        enabledToolCount: serverStatus.enabledToolCount,
      });
    });
  },

  setTools: (tools: ToolInfo[]) => {
    set({ tools });
  },

  addEvent: (event: RealtimeEvent) => {
    const { events } = get();
    const newEvents = [event, ...events].slice(0, 100); // Keep latest 100 events
    set({ events: newEvents });
  },

  setSelectedServer: (server: string | null) => {
    set({ selectedServer: server });
  },

  setSelectedTool: (tool: string | null) => {
    set({ selectedTool: tool });
  },
}));