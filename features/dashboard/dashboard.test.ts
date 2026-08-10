import { describe, it, expect, beforeEach, vi } from "vitest"
import { DashboardService } from "./dashboard.service"
import type { MigrationConfig } from "./dashboard.types"

// Mock getActiveToken
vi.mock("@/components/providers/MsalProviderWrapper", () => ({
  getActiveToken: vi.fn().mockResolvedValue("mock-token"),
}))

describe("DashboardService", () => {
  let dashboardService: DashboardService
  let globalFetchMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    dashboardService = new DashboardService()
    
    // Mock global fetch
    globalFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    })
    vi.stubGlobal("fetch", globalFetchMock)
  })

  it("should start migration by making a POST request with correct payload", async () => {
    const config: MigrationConfig = {
      siteUrl: "https://tableau.example.com",
      projectName: "Sales",
      workbookName: "Dashboard",
    }

    const mockResponse = {
      id: "run-1",
      config,
      status: "running",
      startTime: new Date().toISOString(),
      agents: [],
      logs: [],
    }

    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    })

    const result = await dashboardService.startMigration(config)

    expect(result.id).toBe("run-1")
    expect(result.status).toBe("running")
    expect(globalFetchMock).toHaveBeenCalledWith("/api/migration/start", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(config),
      headers: expect.objectContaining({
        "Authorization": "Bearer mock-token",
        "Content-Type": "application/json",
      })
    }))
  })

  it("should get migration status with standard GET request", async () => {
    const mockResponse = {
      id: "run-1",
      status: "completed",
      agents: [],
      logs: [],
    }

    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    })

    const result = await dashboardService.getMigrationStatus("run-1")

    expect(result.status).toBe("completed")
    expect(globalFetchMock).toHaveBeenCalledWith("/api/migration/status/run-1", expect.any(Object))
  })

  it("should get migration history with standard GET request", async () => {
    const mockResponse = [
      { id: "run-1", status: "completed" },
      { id: "run-2", status: "running" },
    ]

    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    })

    const result = await dashboardService.getMigrationHistory()

    expect(result).toHaveLength(2)
    expect(globalFetchMock).toHaveBeenCalledWith("/api/migration/status", expect.any(Object))
  })
})
