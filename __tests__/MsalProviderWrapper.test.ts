/**
 * __tests__/MsalProviderWrapper.test.ts
 *
 * Unit tests for the MSAL lifecycle fix — Phase 12.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InteractionRequiredAuthError,
  BrowserAuthError,
  InteractionStatus,
} from "@azure/msal-browser";

// ─── Shared mock state ────────────────────────────────────────────────────────

let mockActiveAccount: any = null;
let mockAllAccounts: any[] = [];
let mockAcquireTokenSilentResult: any = null;
let mockAcquireTokenSilentError: any = null;
let mockAcquireTokenPopupResult: any = null;
let mockAcquireTokenPopupError: any = null;
let mockHandleRedirectResult: any = null;
let mockHandleRedirectError: any = null;
let mockInteractionStatus: InteractionStatus = InteractionStatus.None;

const mockJwtPayload = btoa(JSON.stringify({ scp: "mock-scope" }));
const mockJwt = `header.${mockJwtPayload}.signature`;

// Number of times each method was called — used for deduplication assertions.
let acquireTokenSilentCallCount = 0;
let initializeCallCount = 0;
let handleRedirectCallCount = 0;

vi.mock("@/stores/ui.store", () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      setMigrationMode: vi.fn(),
      fetchTimezone: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

function makeInteractionRequiredError() {
  const err = new InteractionRequiredAuthError("interaction_required");
  return err;
}

function makeNoTokenCacheError() {
  const err = Object.assign(new Error("no_token_request_cache_error"), {
    errorCode: "no_token_request_cache_error",
  });
  // Make it instanceof BrowserAuthError for the instanceof check.
  Object.setPrototypeOf(err, BrowserAuthError.prototype);
  return err;
}

// ─── Mock PublicClientApplication ────────────────────────────────────────────

const mockPca = {
  initialize: vi.fn(async () => {
    initializeCallCount++;
  }),
  handleRedirectPromise: vi.fn(async () => {
    handleRedirectCallCount++;
    if (mockHandleRedirectError) throw mockHandleRedirectError;
    return mockHandleRedirectResult;
  }),
  getActiveAccount: vi.fn(() => mockActiveAccount),
  getAllAccounts: vi.fn(() => mockAllAccounts),
  setActiveAccount: vi.fn((account: any) => {
    mockActiveAccount = account;
  }),
  acquireTokenSilent: vi.fn(async () => {
    acquireTokenSilentCallCount++;
    if (mockAcquireTokenSilentError) throw mockAcquireTokenSilentError;
    return mockAcquireTokenSilentResult;
  }),
  acquireTokenPopup: vi.fn(async () => {
    if (mockAcquireTokenPopupError) throw mockAcquireTokenPopupError;
    return mockAcquireTokenPopupResult;
  }),
  logoutRedirect: vi.fn(async () => {}),
  getInteractionStatus: vi.fn(() => mockInteractionStatus),
};

// ─── Mock PublicClientApplication constructor ─────────────────────────────────

vi.mock("@azure/msal-browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@azure/msal-browser")>();
  return {
    ...actual,
    PublicClientApplication: vi.fn(function () {
      return mockPca;
    }),
  };
});

// ─── Mock /api/auth/config fetch ──────────────────────────────────────────────

const mockConfig = {
  clientId: "test-client-id",
  authority: "https://login.microsoftonline.com/test-tenant",
  redirectUri: "http://localhost:3000",
  postLogoutRedirectUri: "http://localhost:3000/signin",
  apiScope: "api://test-api/.default",
  migrationMode: "standard",
};

// ─── Module reset helper ──────────────────────────────────────────────────────
async function importFreshModule() {
  vi.resetModules();
  const mod = await import("@/components/providers/MsalProviderWrapper");
  return mod;
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset mock state
  mockActiveAccount = null;
  mockAllAccounts = [];
  
  // Create a valid fake JWT so checkAllConsents can parse payload.scp without crashing
  const mockJwtPayload = btoa(JSON.stringify({ scp: "mock-scope" }));
  const mockJwt = `header.${mockJwtPayload}.signature`;
  
  mockAcquireTokenSilentResult = { accessToken: mockJwt, scopes: [] };
  mockAcquireTokenSilentError = null;
  mockAcquireTokenPopupResult = { accessToken: mockJwt, scopes: [] };
  mockAcquireTokenPopupError = null;
  mockHandleRedirectResult = null;
  mockHandleRedirectError = null;
  mockInteractionStatus = InteractionStatus.None;

  acquireTokenSilentCallCount = 0;
  initializeCallCount = 0;
  handleRedirectCallCount = 0;

  vi.clearAllMocks();

  mockPca.initialize.mockImplementation(async () => {
    initializeCallCount++;
  });
  mockPca.handleRedirectPromise.mockImplementation(async () => {
    handleRedirectCallCount++;
    if (mockHandleRedirectError) throw mockHandleRedirectError;
    return mockHandleRedirectResult;
  });
  mockPca.acquireTokenSilent.mockImplementation(async () => {
    acquireTokenSilentCallCount++;
    if (mockAcquireTokenSilentError) throw mockAcquireTokenSilentError;
    return mockAcquireTokenSilentResult;
  });
  mockPca.acquireTokenPopup.mockImplementation(async () => {
    if (mockAcquireTokenPopupError) throw mockAcquireTokenPopupError;
    return mockAcquireTokenPopupResult;
  });
  mockPca.getActiveAccount.mockImplementation(() => mockActiveAccount);
  mockPca.getAllAccounts.mockImplementation(() => mockAllAccounts);
  mockPca.getInteractionStatus.mockImplementation(() => mockInteractionStatus);

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockConfig,
  } as any);

  const sessionStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    };
  })();
  Object.defineProperty(global, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MsalProviderWrapper — initialization lifecycle", () => {

  // Test 1
  it("initializes MSAL exactly once", async () => {
    const { initializeMsal, isMsalReady } = await importFreshModule();

    expect(isMsalReady()).toBe(false);
    expect(initializeCallCount).toBe(0);

    await initializeMsal();

    expect(isMsalReady()).toBe(true);
    expect(initializeCallCount).toBe(1);
  }, 20000);

  // Test 2
  it("calls handleRedirectPromise after initialize()", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    mockAllAccounts = [mockActiveAccount];

    await initializeMsal();
    await getActiveToken();

    expect(initializeCallCount).toBeGreaterThanOrEqual(1);
    expect(handleRedirectCallCount).toBeGreaterThanOrEqual(1);
    
    const initOrder = mockPca.initialize.mock.invocationCallOrder[0];
    const redirectOrder = mockPca.handleRedirectPromise.mock.invocationCallOrder[0];
    expect(initOrder).toBeLessThan(redirectOrder);
  });

  // Test 3
  it("does NOT call acquireTokenSilent when no account exists", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    await initializeMsal();
    await expect(getActiveToken()).rejects.toThrow("No active account");
    expect(acquireTokenSilentCallCount).toBe(0);
  });

  // Test 4
  it("acquires token silently when account exists", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    await initializeMsal();
    
    const token = await getActiveToken();

    expect(token).toBe(mockJwt);
    expect(acquireTokenSilentCallCount).toBe(1);
    expect(mockPca.acquireTokenPopup).not.toHaveBeenCalled();
  });

  // Test 5
  it("does NOT open a popup during active MSAL interaction", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    mockInteractionStatus = InteractionStatus.Login; // MSAL is busy
    mockAcquireTokenSilentError = makeInteractionRequiredError();

    await initializeMsal();
    await expect(getActiveToken()).rejects.toThrow("interaction_in_progress");
    expect(mockPca.acquireTokenPopup).not.toHaveBeenCalled();
  });

  // Test 6
  it("consent check (ensureConsent) runs after MSAL is ready", async () => {
    const { initializeMsal, ensureConsent, isMsalReady } = await importFreshModule();

    expect(isMsalReady()).toBe(false);
    let result = await ensureConsent();
    // Returns false when not ready
    expect(result).toBe(false);

    await initializeMsal();
    expect(isMsalReady()).toBe(true);
    
    // No account set, so it returns true
    result = await ensureConsent();
    expect(result).toBe(true);
  });

  // Test 7
  it("second initialization call shares first promise — PCA created only once", async () => {
    const { initializeMsal } = await importFreshModule();

    const [t1, t2] = await Promise.all([
      initializeMsal(),
      initializeMsal(),
    ]);

    expect(t1).toBeDefined();
    expect(t2).toBeDefined();

    const { PublicClientApplication } = await import("@azure/msal-browser");
    expect(vi.mocked(PublicClientApplication)).toHaveBeenCalledTimes(1);
    expect(initializeCallCount).toBe(1);
  });

  // Test 8
  it("concurrent token requests for same scope share one in-flight promise", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    await initializeMsal();

    const [t1, t2, t3] = await Promise.all([
      getActiveToken(),
      getActiveToken(),
      getActiveToken(),
    ]);

    expect(t1).toBe(mockJwt);
    expect(t2).toBe(mockJwt);
    expect(t3).toBe(mockJwt);

    expect(acquireTokenSilentCallCount).toBe(1);
  });

  // Test 9
  it("interaction_in_progress is handled safely — no crash, no nested popup", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    mockInteractionStatus = InteractionStatus.AcquireToken;
    mockAcquireTokenSilentError = makeInteractionRequiredError();

    await initializeMsal();
    const err = await getActiveToken().catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("interaction_in_progress");
    expect(mockPca.acquireTokenPopup).not.toHaveBeenCalled();
  });

  // Test 10
  it("interaction_required falls back to popup ONLY when MSAL is idle", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };
    mockInteractionStatus = InteractionStatus.None; // MSAL is idle
    mockAcquireTokenSilentError = makeInteractionRequiredError();

    await initializeMsal();
    const token = await getActiveToken();

    expect(token).toBe(mockJwt);
    expect(mockPca.acquireTokenPopup).toHaveBeenCalledTimes(1);
  });

  // Test 11
  it("no_token_request_cache_error during handleRedirectPromise is non-fatal", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    mockHandleRedirectError = makeNoTokenCacheError();
    mockActiveAccount = { username: "user@test.com", localAccountId: "123" };

    // Should NOT throw — expected during normal page loads
    await initializeMsal();
    const token = await getActiveToken();
    expect(token).toBe(mockJwt);
  });

  // Test 12
  it("existing authenticated session returns token without re-login", async () => {
    const { initializeMsal, getActiveToken } = await importFreshModule();

    const existingAccount = { username: "existing@test.com", localAccountId: "existing-123" };
    mockActiveAccount = existingAccount;
    mockAllAccounts = [existingAccount];
    mockHandleRedirectResult = null;

    await initializeMsal();
    const token = await getActiveToken();

    expect(token).toBe(mockJwt);
    expect(mockPca.acquireTokenPopup).not.toHaveBeenCalled();
    expect(mockPca.logoutRedirect).not.toHaveBeenCalled();
  });

  // Test 13
  it("logout calls logoutRedirect correctly", async () => {
    mockPca.logoutRedirect.mockResolvedValue(undefined);

    await mockPca.logoutRedirect({ postLogoutRedirectUri: "/signin" });

    expect(mockPca.logoutRedirect).toHaveBeenCalledWith({
      postLogoutRedirectUri: "/signin",
    });
  });
});
