import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

    if (!apiKey || !endpoint || !deploymentName) {
      return NextResponse.json({ error: 'Azure OpenAI configuration is missing in .env.' }, { status: 500 });
    }

    // Trim trailing slash if present
    const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const systemPrompt = `You are an expert Migration Consultant specializing in Tableau to Microsoft Fabric migrations.
You will be provided with telemetry data from a migration assessment portfolio, including aggregated totals and detailed statistics for individual high-risk workbooks.
Your goal is to dynamically generate AI-driven insights based on this data.
1. Executive Summary: A 1-paragraph summary (approx 7-8 lines) of the estate, effort, risk, and overall advice.
2. Key Findings: An array of 5-7 bullet points summarizing critical data points (complexity, blockers, Custom SQL, LODs, etc.). Reference specific workbook names when they represent significant outliers or drivers of complexity.
3. Recommended Approaches: An array of exactly 5 strategies tailored to this specific portfolio. They must span categories like Execution Strategy, Risk Mitigation, Data Foundation, Analytics Modernization, and Governance. Each must have a short uppercase title, and a narrative that explicitly details the Observation, the Impact, and the Recommended Action.

You MUST return the output strictly as a JSON object with the following schema:
{
  "executiveSummary": "string",
  "keyFindings": ["string"],
  "recommendedApproach": [
    { "title": "string", "narrative": "string" }
  ]
}
DO NOT wrap the response in markdown code blocks like \`\`\`json. Return only the raw JSON.`;

    const userPrompt = `Please analyze the following migration portfolio data and generate the JSON insights:
${JSON.stringify(data, null, 2)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Azure OpenAI Error Response:', errText);
      return NextResponse.json({ error: 'Failed to generate insights from Azure OpenAI. See server logs.' }, { status: response.status });
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
