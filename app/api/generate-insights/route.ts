import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { withRetry } from "@/lib/api/retry";

export const dynamic = "force-dynamic";

// Matches the 60s bound used by every other outbound call in the app
// (lib/fetchWithAuth.ts, lib/api/httpClient.ts) -- this was previously the
// only outbound fetch in the app with no timeout at all, so a hung Azure
// OpenAI endpoint could block this route handler indefinitely.
const AZURE_OPENAI_TIMEOUT_MS = 60000;

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const env = getEnv();

    const { AZURE_OPENAI_API_KEY: apiKey, AZURE_OPENAI_ENDPOINT: endpoint, AZURE_OPENAI_DEPLOYMENT_NAME: deploymentName, AZURE_OPENAI_API_VERSION: apiVersion } = env;

    if (!apiKey || !endpoint || !deploymentName || !apiVersion) {
      return NextResponse.json(
        { error: "Azure OpenAI is not configured. Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME, and AZURE_OPENAI_API_VERSION to enable AI insights." },
        { status: 503 }
      );
    }

    const cleanEndpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const systemPrompt = `You are an expert Migration Consultant specializing in Qlik to Microsoft Fabric migrations.
You will be provided with telemetry data from a migration assessment portfolio, including aggregated complexity totals and per-app details for the apps assessed so far.
Your goal is to generate AI-driven insights based only on this data — do not invent numbers or app names that are not present in the data.
1. Executive Summary: A 1-paragraph summary (approx 6-8 lines) of the estate, effort, risk, and overall advice.
2. Key Findings: An array of 4-7 bullet points summarizing critical data points from the provided complexity distribution and per-app details. Reference specific app names when they represent significant outliers.
3. Recommended Approaches: An array of 3-5 strategies tailored to this specific portfolio, spanning categories like Execution Strategy, Risk Mitigation, Data Foundation, and Governance. Each must have a short uppercase title and a narrative detailing the Observation, the Impact, and the Recommended Action.

You MUST return the output strictly as a JSON object with the following schema:
{
  "executiveSummary": "string",
  "keyFindings": ["string"],
  "recommendedApproach": [
    { "title": "string", "narrative": "string" }
  ]
}
DO NOT wrap the response in markdown code blocks like \`\`\`json. Return only the raw JSON.`;

    const userPrompt = `Please analyze the following Qlik-to-Fabric migration portfolio data and generate the JSON insights:
${JSON.stringify(data, null, 2)}`;

    const response = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AZURE_OPENAI_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 1500,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        // Retry on 429s and 5xx -- a transient rate-limit or upstream hiccup,
        // not a request we should give up on after one try.
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`Azure OpenAI request failed with ${res.status}`);
        }
        return res;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new Error(`Azure OpenAI request timed out after ${AZURE_OPENAI_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[API /api/generate-insights] Azure OpenAI error:", errText);
      return NextResponse.json({ error: "Failed to generate insights from Azure OpenAI." }, { status: response.status });
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Azure OpenAI returned an empty response." }, { status: 502 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[API /api/generate-insights] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
