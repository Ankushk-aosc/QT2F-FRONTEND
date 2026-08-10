import { create } from 'zustand'

export interface LogEntry {
    id: string
    timestamp: string
    message: string
    severity?: 'Info' | 'Warning' | 'Error' | 'Success'
    source?: string
    // Extended metadata for dashboard compatibility
    agent?: string
    siteName?: string
    workbookName?: string
}

interface AppStoreState {
    // Centralized Logs
    logs: LogEntry[]

    // generic shared state storage (key-value)
    sharedData: Record<string, any>

    // Actions
    addLog: (
        message: string,
        severity?: LogEntry['severity'],
        source?: string,
        metadata?: { agent?: string, siteName?: string, workbookName?: string }
    ) => void

    setStoreData: (key: string, value: any) => void
    getStoreData: (key: string) => any
    clearLogs: () => void
}

export const useAppStore = create<AppStoreState>((set, get) => ({
    logs: [],
    sharedData: {},

    addLog: (message, severity = 'Info', source = 'App', metadata = {}) => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message,
            severity,
            source,
            ...metadata
        }
        // Using functional update to ensure latest state
        set((state) => ({ logs: [newLog, ...state.logs] }))
        // Log to console for debugging
        const prefix = source ? `[${source}]` : ''
        const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : ''
        console.log(`${prefix} ${message} ${metaStr}`)
    },

    setStoreData: (key, value) => {
        set((state) => ({
            sharedData: { ...state.sharedData, [key]: value }
        }))
    },

    getStoreData: (key) => {
        return get().sharedData[key]
    },

    clearLogs: () => set({ logs: [] })
}))
