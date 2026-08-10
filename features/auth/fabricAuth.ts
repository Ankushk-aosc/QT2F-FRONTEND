// // services/fabricAuth.ts
// // Server-side only – handles token fetching for Fabric

// let cachedToken: { accessToken: string; expiry: number } | null = null;

// export async function getFabricAccessToken(): Promise<string> {
//   try {
//     console.log('[FabricAuth] Checking token cache...');
    
//     if (cachedToken && Date.now() < cachedToken.expiry - 300000) {
//       console.log('[FabricAuth] Using cached token');
//       return cachedToken.accessToken;
//     }

//     console.log('[FabricAuth] Acquiring new token');

//     const tenantId = process.env.FABRIC_TENANT_ID;
//     const clientId = process.env.FABRIC_CLIENT_ID;
//     const clientSecret = process.env.FABRIC_CLIENT_SECRET;
//     const scope = process.env.FABRIC_API_SCOPE || 'https://api.fabric.microsoft.com/.default';

//     const envCheck = {
//       tenantId: !!tenantId,
//       clientId: !!clientId,
//       clientSecret: !!clientSecret,
//       scope: scope,
//     };

//     console.log('[FabricAuth] Env Check:', envCheck);

//     if (!tenantId || !clientId || !clientSecret) {
//       throw new Error('Missing Fabric credentials in environment variables');
//     }

//     const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

//     const body = new URLSearchParams({
//       client_id: clientId,
//       client_secret: clientSecret,
//       scope,
//       grant_type: 'client_credentials',
//     });

//     const response = await fetch(tokenUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: body.toString(),
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error('[FabricAuth] Token response error:', response.status, errorText);
//       throw new Error(`Fabric token failed: ${response.status} - ${errorText}`);
//     }

//     const data = await response.json();

//     cachedToken = {
//       accessToken: data.access_token,
//       expiry: Date.now() + data.expires_in * 1000,
//     };

//     console.log('[FabricAuth] New token acquired');

//     return cachedToken.accessToken;
//   } catch (err) {
//     const errorMessage = err instanceof Error ? err.message : 'Unknown auth error';
//     const errorStack = err instanceof Error ? err.stack : undefined;
    
//     console.error('[FabricAuth] Detailed Error:', {
//       message: errorMessage,
//       stack: errorStack,
//     });
    
//     throw err;
//   }
// }