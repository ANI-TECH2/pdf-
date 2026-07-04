# azure-ocr-text Edge Function

## Purpose
Extract text from an image using **Azure AI Vision Read**.

## Endpoint
POST `/functions/v1/azure-ocr-text`

## Request body (JSON)
Provide exactly one of:

### Option A: base64 image
```json
{
  "image": "<base64>"
}
```

### Option B: image URL
```json
{
  "imageUri": "https://example.com/image.jpg"
}
```

## Response
```json
{ "text": "..." }
```

## Environment variables (Edge Function)
Set these secrets in Supabase:
- `AZURE_OCR_ENDPOINT` (e.g. `https://<resource>.cognitiveservices.azure.com/`)
- `AZURE_OCR_KEY`
- `AZURE_OCR_REGION` (optional)

(For convenience, the function also accepts `EXPO_PUBLIC_AZURE_OCR_ENDPOINT/KEY/REGION` if you already have them.)

## Deploy
From the repo root:
```bash
supabase functions deploy azure-ocr-text
```
