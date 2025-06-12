import torch
from transformers import pipeline
import soundfile as sf
import os

def main():
    """
    Main function to run the audio transcription process.
    """
    print("开始使用 Python 进行语音识别...")

    # Define the path to the locally stored model
    model_path = os.path.join(os.getcwd(), 'models')
    audio_path = os.path.join(os.getcwd(), 'test_audio.wav')

    # Check if model and audio files exist
    if not os.path.exists(model_path):
        print(f"错误: 找不到模型目录 at '{model_path}'")
        return
    if not os.path.exists(audio_path):
        print(f"错误: 找不到音频文件 at '{audio_path}'")
        return

    try:
        # 1. Create a speech-to-text pipeline using the local model
        print(f"正在从本地路径 '{model_path}' 加载模型...")
        transcriber = pipeline(
            "automatic-speech-recognition",
            model=model_path,
            device=0 if torch.cuda.is_available() else -1  # Use GPU if available
        )
        print("模型加载完成。")

        # 2. Read the audio file
        print(f"正在读取音频文件: {audio_path}")
        speech, sample_rate = sf.read(audio_path)

        # Ensure the audio is mono
        if len(speech.shape) > 1:
            speech = speech.mean(axis=1)

        # 3. Transcribe the audio
        print("正在进行语音识别...")
        result = transcriber(
            speech,
            generate_kwargs={"language": "chinese", "task": "transcribe"}
        )
        
        # 4. Print the result
        print("\n--- 识别结果 ---")
        print(result["text"])
        print("------------------\n")

    except Exception as e:
        print(f"执行过程中发生错误: {e}")

if __name__ == "__main__":
    main() 