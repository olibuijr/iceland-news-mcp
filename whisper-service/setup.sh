#!/bin/bash
# Setup script for Icelandic Whisper STT Service

set -e

INSTALL_DIR="$HOME/Applications/WhisperICE"
cd "$INSTALL_DIR"

echo "=== Setting up Icelandic Whisper STT Service ==="

# Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch with CUDA support
echo "Installing PyTorch with CUDA support..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install other dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Pre-download the model
echo "Pre-downloading the Icelandic Whisper model (this may take a while)..."
python3 -c "
from transformers import WhisperProcessor, WhisperForConditionalGeneration
MODEL_NAME = 'language-and-voice-lab/whisper-large-icelandic-62640-steps-967h'
print('Downloading processor...')
WhisperProcessor.from_pretrained(MODEL_NAME)
print('Downloading model...')
WhisperForConditionalGeneration.from_pretrained(MODEL_NAME)
print('Model downloaded successfully!')
"

echo "=== Setup complete! ==="
echo "To start the service manually, run:"
echo "  cd $INSTALL_DIR && source venv/bin/activate && python main.py"
