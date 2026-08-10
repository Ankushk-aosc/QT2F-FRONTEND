// stores/datalayer.store.ts
import { create } from 'zustand'
import { datalayerService } from '@/services/datalayer.service'
import { mapDataLayerResponse } from '@/app/Mapper/datalayerMapper'

export interface DataLayerData {
  id: string
  status: string
  created_at: string
  project_id: string
  workbook_id: string
  run_id: string
  processing_summary: any[]
  [key: string]: any
}

interface DataLayerStore {
  datalayerData: Record<string, DataLayerData>
  isLoading: boolean
  error: string | null
  fetchDataLayerResult: (projectId: string, workbookId: string, runId: string) => Promise<void>
  reset: () => void
}

export const useDatalayerStore = create<DataLayerStore>((set, get) => ({
  datalayerData: {},
  isLoading: false,
  error: null,

  fetchDataLayerResult: async (projectId, workbookId, runId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await datalayerService.fetchDataLayer(projectId, workbookId, runId)
      if (data) {
        const mapped = mapDataLayerResponse(data)
        set((state) => ({
          datalayerData: {
            ...state.datalayerData,
            [workbookId]: mapped
          },
          isLoading: false
        }))
      } else {
        set({ isLoading: false })
      }
    } catch (err: any) {
      const is404 = err.message?.includes('404')
      set({ 
        error: is404 ? null : (err.message || 'Failed to fetch Data Layer result'), 
        isLoading: false 
      })
      // If it's a 404, we don't throw, allowing the caller (Promise.allSettled) to treat it as a silent "no-op"
      if (!is404) throw err
    }
  },

  reset: () => set({ datalayerData: {}, isLoading: false, error: null })
}))
