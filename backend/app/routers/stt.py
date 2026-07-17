from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import httpx
from app.core.config import get_settings
from app.core.auth import get_current_user, CurrentUser

router = APIRouter()


@router.get("/token")
def get_deepgram_token(user: CurrentUser = Depends(get_current_user)):
    settings = get_settings()
    if not settings.deepgram_api_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not configured")

    # Deepgram token endpoint for client-side streaming
    response = httpx.post(
        "https://api.deepgram.com/v1/auth/token",
        headers={"Authorization": f"Token {settings.deepgram_api_key}"},
        timeout=10.0,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    settings = get_settings()
    if not settings.deepgram_api_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not configured")

    content = await file.read()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": file.content_type or "audio/webm",
            },
            content=content,
            timeout=30.0,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    transcript = (
        data.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
        .get("transcript", "")
    )
    return {"transcript": transcript}
