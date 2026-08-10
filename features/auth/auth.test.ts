import { describe, it, expect, beforeEach, vi } from "vitest"
import { AuthService } from "./auth.service"

// Mock @azure/msal-browser
const { mockMsalInstance } = vi.hoisted(() => ({
  mockMsalInstance: {
    initialize: vi.fn().mockResolvedValue(undefined),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    getAllAccounts: vi.fn().mockReturnValue([]),
    getActiveAccount: vi.fn().mockReturnValue(null),
    setActiveAccount: vi.fn(),
    loginRedirect: vi.fn().mockResolvedValue(undefined),
    logoutPopup: vi.fn().mockResolvedValue(undefined),
    acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: "mock-silent-token" }),
    acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: "mock-popup-token" }),
  }
}))

vi.mock("@azure/msal-browser", () => {
  return {
    PublicClientApplication: class {
      constructor() {
        return mockMsalInstance;
      }
    },
    InteractionRequiredAuthError: class {},
  }
})

describe("AuthService", () => {
  let authService: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    authService = new AuthService()
  })

  it("should initialize MSAL and set active account if accounts exist", async () => {
    const mockMsal = (authService as any).instance
    mockMsal.getAllAccounts.mockReturnValue([{ localAccountId: "user-1", username: "test@example.com", name: "Test User" }])

    await authService.initialize()

    expect(mockMsal.initialize).toHaveBeenCalled()
    expect(mockMsal.handleRedirectPromise).toHaveBeenCalled()
    expect(mockMsal.setActiveAccount).toHaveBeenCalled()
  })

  it("should call loginRedirect when login is called", async () => {
    const mockMsal = (authService as any).instance
    await authService.login()
    expect(mockMsal.loginRedirect).toHaveBeenCalled()
  })

  it("should call logoutPopup when logout is called", async () => {
    const mockMsal = (authService as any).instance
    await authService.logout()
    expect(mockMsal.logoutPopup).toHaveBeenCalled()
  })

  it("should return correct user details when active account is present", () => {
    const mockMsal = (authService as any).instance
    mockMsal.getActiveAccount.mockReturnValue({
      localAccountId: "user-1",
      username: "test@example.com",
      name: "Test User"
    })

    const user = authService.getUser()
    expect(user).toEqual({
      id: "user-1",
      email: "test@example.com",
      name: "Test User"
    })
  })

  it("should retrieve access token silently", async () => {
    const mockMsal = (authService as any).instance
    mockMsal.getActiveAccount.mockReturnValue({ localAccountId: "user-1" })
    
    const token = await authService.getAccessToken()
    expect(token).toBe("mock-silent-token")
  })
})
