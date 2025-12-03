"""
Icelandic Whisper Speech-to-Text FastAPI Service
Uses the fine-tuned Icelandic Whisper model from Language and Voice Lab
Runs on GPU (CUDA) for fast inference
"""

import io
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import numpy as np
import soundfile as sf
from pydantic import BaseModel
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Icelandic Whisper STT Service",
    description="Speech-to-text service using fine-tuned Icelandic Whisper model",
    version="1.0.0"
)

# Enable CORS for web app access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_NAME = "language-and-voice-lab/whisper-large-icelandic-62640-steps-967h"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TORCH_DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

# Global model and processor
processor = None
model = None


@app.on_event("startup")
async def load_model():
    """Load the Whisper model on startup"""
    global processor, model

    logger.info(f"Loading model {MODEL_NAME} on {DEVICE}...")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    processor = WhisperProcessor.from_pretrained(MODEL_NAME)
    model = WhisperForConditionalGeneration.from_pretrained(
        MODEL_NAME,
        torch_dtype=TORCH_DTYPE,
        low_cpu_mem_usage=True
    ).to(DEVICE)

    # Enable faster inference
    model.config.forced_decoder_ids = None

    logger.info("Model loaded successfully!")


class TranscribeBase64Request(BaseModel):
    """Request model for base64 encoded audio"""
    audio_data: str  # Base64 encoded audio
    sample_rate: int = 16000  # Sample rate of the audio


class TranscriptionResponse(BaseModel):
    """Response model for transcription"""
    text: str
    language: str = "is"  # Icelandic


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available()
    }


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe an audio file to Icelandic text.
    Accepts WAV, MP3, FLAC, OGG formats.
    """
    if model is None or processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        # Read audio file
        audio_bytes = await file.read()
        audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes))

        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Resample to 16kHz if needed
        if sample_rate != 16000:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)

        # Process audio
        input_features = processor(
            audio_data,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to(DEVICE, dtype=TORCH_DTYPE)

        # Generate transcription
        with torch.no_grad():
            predicted_ids = model.generate(input_features)

        # Decode transcription
        transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

        return TranscriptionResponse(text=transcription.strip())

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/pcm", response_model=TranscriptionResponse)
async def transcribe_pcm(request: TranscribeBase64Request):
    """
    Transcribe base64-encoded PCM audio (16-bit, mono).
    This is the format sent by the web app.
    """
    if model is None or processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio_data)

        # Convert bytes to int16 array
        audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)

        # Convert to float32 [-1, 1]
        audio_float = audio_int16.astype(np.float32) / 32768.0

        # Resample to 16kHz if needed
        if request.sample_rate != 16000:
            import librosa
            audio_float = librosa.resample(
                audio_float,
                orig_sr=request.sample_rate,
                target_sr=16000
            )

        # Process audio
        input_features = processor(
            audio_float,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to(DEVICE, dtype=TORCH_DTYPE)

        # Generate transcription
        with torch.no_grad():
            predicted_ids = model.generate(input_features)

        # Decode transcription
        transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

        return TranscriptionResponse(text=transcription.strip())

    except Exception as e:
        logger.error(f"PCM transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7050)
