# Image Integration Testing Rules

## Image Handling Rules
- Always use base64-encoded images for tests
- Accepted formats: JPEG, PNG, WEBP only
- No SVG/BMP/HEIC, no blank/solid-color/uniform images
- Every test image must have real visual features (text, edges, shapes)
- Animated formats: extract first frame only
- Resize large images before upload (< 4MB recommended)

## Sanjeevni Prescription OCR (GPT-5.2 via Emergent Universal Key)
- Endpoint: `POST /api/prescriptions` with `{ image_url: <base64 data URL or http URL>, note }`
- Model: `openai/gpt-5.2` (vision)
- Expected response shape:
  ```
  {
    "id": "...",
    "user_id": "...",
    "image_url": "...",
    "status": "verified",
    "ai_detected": [
      {"medicine_id": "...", "name": "Paracetamol 500mg", "confidence": 0.93}
    ],
    "raw_ai_output": "<json text>",
    "created_at": "..."
  }
  ```
- Fallback: if AI call fails or returns no matches, return empty `ai_detected` list (don't crash).
