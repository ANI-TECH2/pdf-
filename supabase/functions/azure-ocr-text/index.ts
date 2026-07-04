import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { DocumentAnalysisClient, AzureKeyCredential } from "npm:@azure/ai-form-recognizer@5"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get("content-type") || ""
    let bytes: Uint8Array

    if (contentType.includes("application/json")) {
      const { base64 } = await req.json()
      if (!base64) {
        return new Response(JSON.stringify({ error: "No base64 image" }), {
          status: 400,
          headers: jsonHeaders,
        })
      }
      bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    } else {
      const formData = await req.formData()
      const file = formData.get("image") as File
      if (!file) {
        return new Response(JSON.stringify({ error: "No image" }), {
          status: 400,
          headers: jsonHeaders,
        })
      }
      bytes = new Uint8Array(await file.arrayBuffer())
    }

    const client = new DocumentAnalysisClient(
      Deno.env.get("AZURE_FORM_RECOGNIZER_ENDPOINT")!,
      new AzureKeyCredential(Deno.env.get("AZURE_FORM_RECOGNIZER_KEY")!)
    )

    // "prebuilt-layout" returns paragraphs, roles, AND tables.
    // "prebuilt-read" only returns plain text + lines (no roles, no tables).
    const poller = await client.beginAnalyzeDocument("prebuilt-layout", bytes)
    const result = await poller.pollUntilDone()

    const fullText = result.content || ""

    const pages = (result.pages || []).map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      unit: page.unit,
      lines: (page.lines || []).map((line) => ({
        text: line.content,
        boundingBox: line.polygon,
        words: Array.isArray((line as any).words)
          ? (line as any).words.map((word: any) => ({
              text: word.content,
              boundingBox: word.polygon,
              confidence: word.confidence,
            }))
          : [],
      })),
    }))

    const paragraphs = (result.paragraphs || []).map((para) => ({
      text: para.content,
      role: para.role || null,
      boundingBox: para.boundingRegions?.[0]?.polygon,
      pageNumber: para.boundingRegions?.[0]?.pageNumber,
    }))

    const tables = (result.tables || []).map((table) => ({
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      pageNumber: table.boundingRegions?.[0]?.pageNumber,
      cells: (table.cells || []).map((cell) => ({
        text: cell.content,
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        rowSpan: cell.rowSpan || 1,
        columnSpan: cell.columnSpan || 1,
        kind: cell.kind || "content", // "columnHeader" | "rowHeader" | "content" etc
      })),
    }))

    return new Response(
      JSON.stringify({ fullText, pages, paragraphs, tables }),
      { headers: jsonHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})