// lib/auth-constants.ts
// Replaces usage of lib/msalConfig.ts for purely constant values that do NOT rely on env vars
// For logic relying on env vars (like ClientID), use the async config fetch or contexts.

// Fabric Scopes don't strictly need env vars if they are constant URLs
export const fabricApiScopes = [
    "https://api.fabric.microsoft.com/Workspace.Read.All",
    "https://api.fabric.microsoft.com/Workspace.GitCommit.All",
    "https://api.fabric.microsoft.com/Workspace.GitUpdate.All",
];

// All Power BI Service scopes registered in Azure AD
export const powerBiScopes = [
    "https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All",
    "https://analysis.windows.net/powerbi/api/Item.Execute.All",
    "https://analysis.windows.net/powerbi/api/Lakehouse.ReadWrite.All",
    "https://analysis.windows.net/powerbi/api/Workspace.GitCommit.All",
    "https://analysis.windows.net/powerbi/api/Workspace.GitUpdate.All",
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
    "https://analysis.windows.net/powerbi/api/Workspace.ReadWrite.All",
];

// Azure Storage scope
export const storageScopes = [
    "https://storage.azure.com/user_impersonation",
];

// Bump this version whenever you add new scopes that require user consent.
// When the stored version for a user doesn't match, the consent flow is forced.
export const CONSENT_VERSION = "2";

// Login request scaffolding — only Graph + custom API scopes (same resource group).
// Power BI and Storage are consented separately via ensureConsent().
export const getLoginRequest = (apiScope: string) => ({
    scopes: [
        "User.Read",
        "openid",
        "profile",
        "email",
        "offline_access",
        apiScope,
    ],
});
