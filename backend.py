import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from faster_whisper import WhisperModel
# import soundfile as sf
# import io
import logging
# from pydub import AudioSegment
import tempfile
import opencc

# If pydub fails to find ffmpeg, you can specify the path manually.
# Uncomment and update the path if you know where ffmpeg.exe is located.
# For example: AudioSegment.converter = "C:/path/to/ffmpeg/bin/ffmpeg.exe"
# AudioSegment.converter = "path/to/your/ffmpeg.exe"

# --- Configuration ---
# Get the absolute path of the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Build the absolute path to the model directory
MODEL_PATH = os.path.join(SCRIPT_DIR, "models")
# Ensure the model path is in the correct format for the OS
MODEL_PATH = os.path.normpath(MODEL_PATH)
# For faster-whisper, we will use the model from the local 'models' folder.

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Global Variables ---
transcriber_model = None
is_model_loaded = False

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)

# --- Model Loading ---
def load_model():
    """Loads the transcription model using faster-whisper."""
    global transcriber_model, is_model_loaded
    if is_model_loaded:
        logging.info("Model already loaded.")
        return

    try:
        logging.info(f"Loading faster-whisper model: '{MODEL_PATH}'...")
        # Determine device and compute type
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if torch.cuda.is_available() else "int8"
        logging.info(f"Using device: {device} with compute_type: {compute_type}")

        # Load the model from the local path.
        transcriber_model = WhisperModel(MODEL_PATH, device=device, compute_type=compute_type)
        is_model_loaded = True
        logging.info("Faster-whisper model loaded successfully!")
    except Exception as e:
        logging.error(f"Model loading failed: {e}", exc_info=True)
        raise e

# --- API Endpoints ---
@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """API endpoint to transcribe an audio file."""
    if not is_model_loaded or transcriber_model is None:
        return jsonify({"error": "Model is not loaded"}), 503

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        file_bytes = file.read()
        if not file_bytes:
            logging.error("Received an empty audio file from the client.")
            return jsonify({"error": "Received an empty audio file"}), 400

        # Save the received audio blob to a temporary file.
        # The file path will be passed directly to the transcription model.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp:
            temp.write(file_bytes)
            temp_filepath = temp.name
        
        logging.info(f"Audio data temporarily saved to {temp_filepath}")

        # Perform transcription directly from the audio file path
        segments, info = transcriber_model.transcribe(
            temp_filepath,
            beam_size=5,
            language="zh"
        )
        
        # Clean up the temporary file after processing
        os.remove(temp_filepath)

        # Concatenate all segments to get the full transcription
        transcription = "".join(segment.text for segment in segments)
        
        # Convert traditional Chinese to simplified Chinese
        converter = opencc.OpenCC('t2s')
        transcription = converter.convert(transcription)
        
        logging.info(f"Transcription result: {info.language} ({info.language_probability:.2f}), Text: {transcription}")

        return jsonify({"transcription": transcription})
    except Exception as e:
        # If a temporary file was created, ensure it's cleaned up in case of an error
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        logging.error("An error occurred during transcription:", exc_info=True)
        error_message = str(e)
        user_friendly_error = f"音频处理失败: {error_message}"
        if "ffmpeg" in error_message.lower():
            user_friendly_error = "音频处理失败：后端无法找到 FFMPEG。"
        return jsonify({"error": user_friendly_error}), 500

# --- Server Startup ---
if __name__ == '__main__':
    load_model()  # Load the model when the server starts
    app.run(host='0.0.0.0', port=5000, debug=True) 