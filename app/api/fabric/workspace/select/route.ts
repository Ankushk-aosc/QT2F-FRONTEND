import { NextRequest, NextResponse } from "next/server"
 
// Make sure this is exported
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId } = body
 
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required" },
        { status: 400 }
      )
    }
 
    console.log(`[API] Workspace selected: ${workspaceId}`)
 
    return NextResponse.json({
      success: true,
      workspaceId,
      message: "Workspace selected successfully"
    })
  } catch (error) {
    console.error("[API] Error selecting workspace:", error)
    return NextResponse.json(
      { error: "Failed to select workspace" },
      { status: 500 }
    )
  }
}
 
// Optional: Add OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200 })
}
 