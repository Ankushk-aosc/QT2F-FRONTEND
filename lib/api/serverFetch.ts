export async function serverFetchWithAuth(
    url: string,
    authHeader: string | null,
    options: RequestInit = {}
) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (authHeader) {
        (headers as any)["Authorization"] = authHeader;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        let errorText = "";
        try { errorText = await response.text(); } catch {}
        const err = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (err as any).status = response.status;
        throw err;
    }

    return await response.json();
}
