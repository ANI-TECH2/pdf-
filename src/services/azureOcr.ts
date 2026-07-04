export type OcrWord = {
  text: string
  boundingBox?: number[][]
  confidence?: number
}

export type OcrLine = {
  text: string
  boundingBox?: number[][]
  words: OcrWord[]
}

export type OcrPage = {
  pageNumber: number
  width?: number
  height?: number
  unit?: string
  lines: OcrLine[]
}

export type OcrParagraphRole =
  | "title"
  | "sectionHeading"
  | "footnote"
  | "pageHeader"
  | "pageFooter"
  | "pageNumber"
  | null

export type OcrParagraph = {
  text: string
  role?: OcrParagraphRole
  boundingBox?: number[][]
  pageNumber?: number
}

export type OcrTableCell = {
  text: string
  rowIndex: number
  columnIndex: number
  rowSpan: number
  columnSpan: number
  kind: string
}

export type OcrTable = {
  rowCount: number
  columnCount: number
  pageNumber?: number
  cells: OcrTableCell[]
}

export type AzureOcrClientResult = {
  fullText: string
  pages: OcrPage[]
  paragraphs: OcrParagraph[]
  tables: OcrTable[]
}

const SUPABASE_URL = "https://cuexnicarfoxakvomenn.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZXhuaWNhcmZveGFrdm9tZW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjY5ODksImV4cCI6MjA5NzMwMjk4OX0.vf9xljU8NTA0o9E_O7uY9vdtrraOw-C4xYxjBG0TqPg"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function azureReadOcrFromImageUri(input: string): Promise<AzureOcrClientResult> {
  let base64: string

  try {
    if (input.startsWith("http")) {
      const res = await fetch(input)
      const arrayBuffer = await res.arrayBuffer()
      base64 = arrayBufferToBase64(arrayBuffer)
    } else {
      const { File } = await import("expo-file-system")
      const file = new File(input)
      base64 = (file as any).base64Sync()
    }
  } catch (e) {
    throw new Error(`Image preparation failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/azure-ocr-text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64 }),
    })
  } catch (e) {
    throw new Error(`Network request failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `OCR failed with status ${response.status}`)
  }

  return {
    fullText: data.fullText || "",
    pages: Array.isArray(data.pages) ? data.pages : [],
    paragraphs: Array.isArray(data.paragraphs) ? data.paragraphs : [],
    tables: Array.isArray(data.tables) ? data.tables : [],
  }
}