"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster, toast } from "sonner";
import { Mic, Upload, Video, Rss } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Waveform from "./waveform";
// We will dynamically import MicVAD later.

const AudioProcessor = dynamic(() => import('./audio-processor'), { ssr: false });

/**
 * Encodes a Float32Array of PCM data into a WAV Blob.
 * The VAD library provides raw Float32Array data, which needs to be
 * encoded into a proper WAV file format before being sent to the backend.
 * @param {Float32Array} samples The PCM audio data.
 * @returns {Blob} A Blob object representing the WAV file.
 */
function float32ArrayToWav(samples: Float32Array): Blob {
  const sampleRate = 16000; // MicVAD resamples to 16kHz
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;

  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  let offset = 0;
  // RIFF identifier
  writeString(view, offset, 'RIFF');
  offset += 4;
  // file length
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  // RIFF type
  writeString(view, offset, 'WAVE');
  offset += 4;
  // format chunk identifier
  writeString(view, offset, 'fmt ');
  offset += 4;
  // format chunk length
  view.setUint32(offset, 16, true);
  offset += 4;
  // sample format (1 for PCM)
  view.setUint16(offset, 1, true);
  offset += 2;
  // channel count
  view.setUint16(offset, numChannels, true);
  offset += 2;
  // sample rate
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  // byte rate (sample rate * block align)
  view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true);
  offset += 4;
  // block align (channel count * bytes per sample)
  view.setUint16(offset, numChannels * bytesPerSample, true);
  offset += 2;
  // bits per sample
  view.setUint16(offset, bitsPerSample, true);
  offset += 2;
  // data chunk identifier
  writeString(view, offset, 'data');
  offset += 4;
  // data chunk length
  view.setUint32(offset, dataLength, true);
  offset += 4;

  // Write PCM samples as 16-bit signed integers
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

type ListeningState = "AWAITING_MIC" | "LISTENING" | "RECORDING" | "PROCESSING" | "ERROR";

/**
 * Main component for Whisper voice transcription.
 * Features automatic voice activity detection (VAD) to control recording.
 */
export default function WhisperRecorder() {
  const [transcription, setTranscription] = useState<string>("");
  const [listeningState, setListeningState] = useState<ListeningState>("AWAITING_MIC");
  const [isClient, setIsClient] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioBlobForProcessing, setAudioBlobForProcessing] = useState<Blob | null>(null);
  
  const vadRef = useRef<any | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTranscriptionTimeRef = useRef<number | null>(null);

  /**
   * Initializes and starts the Voice Activity Detector.
   */
  const startVad = useCallback(async () => {
    // Clean up previous instances
    if (vadRef.current) {
      await vadRef.current.destroy();
      vadRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      const { MicVAD } = await import('@ricky0123/vad-web');
      const ort = await import('onnxruntime-web');

      // Configure ONNX Runtime to use local WASM files
      ort.env.wasm.wasmPaths = {
        'ort-wasm.wasm': '/ort-wasm.wasm',
        'ort-wasm-simd.wasm': '/ort-wasm-simd.wasm',
      };
      
      // Get audio stream from selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedDevice ? { exact: selectedDevice } : undefined }
      });
      streamRef.current = stream;
      setAudioStream(stream);

      const vad = await MicVAD.new({
        stream: stream,
        onSpeechStart: () => {
          console.log("Speech started");
          setListeningState("RECORDING");
        },
        onSpeechEnd: (audio: Float32Array) => {
          console.log("Speech ended, audio data length:", audio.length);
          if (audio.length > 0) {
            setListeningState("PROCESSING");
            const wavBlob = float32ArrayToWav(audio);
            setAudioBlobForProcessing(wavBlob);
            vadRef.current?.pause();
          } else {
            setListeningState("LISTENING");
          }
        },
      });
      vadRef.current = vad;
      vad.start();
      setListeningState("LISTENING");
    } catch (error) {
      console.error("VAD start error:", error);
      toast.error("启动麦克风监听失败。请检查浏览器权限。");
      setListeningState("ERROR");
    }
  }, [selectedDevice]);

  /**
   * Enumerates available audio input devices and sets the initial device.
   */
  const getAudioDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = allDevices.filter(device => device.kind === 'audioinput');
      setDevices(audioDevices);
      if (audioDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    } catch (error) {
      toast.error("麦克风访问被拒绝。请在浏览器设置中允许访问。");
      setListeningState("ERROR");
    }
  }, []);

  // Effect to run on component mount to initialize client-side logic.
  useEffect(() => {
    setIsClient(true);
    getAudioDevices();
  }, [getAudioDevices]);

  // Effect to start/restart VAD when the selected device changes.
  useEffect(() => {
    if (isClient && selectedDevice) {
      startVad();
    }
    // Cleanup function to destroy VAD instance and stream on component unmount or device change.
    return () => {
      vadRef.current?.destroy();
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [isClient, selectedDevice, startVad]);

  /**
   * Handles the file input change event for uploading audio files.
   * @param {React.ChangeEvent<HTMLInputElement>} event The file input change event.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setTranscription("");
      setAudioBlobForProcessing(file);
    } else {
      toast.error("请选择一个有效的音频文件。");
    }
  };

  /**
   * Handles the successful transcription result from the backend.
   * @param {string} text The transcribed text.
   */
  const handleTranscriptionResult = useCallback((text: string) => {
    const now = Date.now();
    const lastTime = lastTranscriptionTimeRef.current;

    if (lastTime && (now - lastTime) > 1500) {
      setTranscription(text);
    } else {
      setTranscription(prev => (prev ? prev + " " : "") + text);
    }
    lastTranscriptionTimeRef.current = now;

    setAudioBlobForProcessing(null);
    setListeningState("LISTENING");
    vadRef.current?.start(); // Resume VAD
  }, []);

  /**
   * Handles errors returned from the backend processor.
   * @param {string} errorMessage The error message.
   */
  const handleError = useCallback((errorMessage: string) => {
    toast.error(errorMessage);
    setAudioBlobForProcessing(null);
    setListeningState("LISTENING");
    vadRef.current?.start(); // Resume VAD
  }, []);

  /**
   * Returns the appropriate status indicator based on the current listening state.
   * @returns {JSX.Element} The status indicator component.
   */
  const getListeningStateIndicator = () => {
    switch (listeningState) {
      case "AWAITING_MIC":
        return <><Mic className="mr-2" />等待麦克风</>;
      case "LISTENING":
        return <><Rss className="mr-2 text-green-500 animate-pulse" />正在聆听...</>;
      case "RECORDING":
        return <><Mic className="mr-2 text-red-500 animate-pulse" />正在录制...</>;
      case "PROCESSING":
        return <>正在处理...</>;
      case "ERROR":
         return <>麦克风错误</>;
    }
  };

  if (!isClient) return null;

  return (
    <>
      <Toaster position="top-center" richColors />
      <AudioProcessor 
        audioBlob={audioBlobForProcessing}
        onTranscriptionResult={handleTranscriptionResult}
        onProcessingChange={(isProcessing: boolean) => {
          if (!isProcessing && listeningState === 'PROCESSING') {
            setListeningState("LISTENING");
            vadRef.current?.start();
          }
        }}
        onError={handleError}
      />
      <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-2xl">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">实时语音识别 (Python 后端)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex w-full items-center justify-center space-x-2">
                  <Select value={selectedDevice} onValueChange={setSelectedDevice} disabled={listeningState !== 'AWAITING_MIC' && listeningState !== 'LISTENING'}>
                    <SelectTrigger className="w-[280px]"><Video className="mr-2 h-4 w-4" /><SelectValue placeholder="选择麦克风..." /></SelectTrigger>
                    <SelectContent>
                      {devices.map(device => <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `麦克风 ${devices.indexOf(device) + 1}`}</SelectItem>)}
                      {devices.length === 0 && <SelectItem value="no-devices" disabled>未找到麦克风</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="w-48 h-10 flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {getListeningStateIndicator()}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="audio/*" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={listeningState === 'PROCESSING' || listeningState === 'RECORDING'} variant="outline" className="w-28 h-10 text-md"><Upload className="mr-2 h-4 w-4" />上传</Button>
                </div>
              </div>
              <Waveform stream={audioStream} />
              <div className="w-full min-h-[200px] p-4 border rounded-md bg-muted">
                <p className="whitespace-pre-wrap">{listeningState === 'PROCESSING' && !transcription ? "正在处理中..." : (transcription || "请开始说话...")}</p>
              </div>
            </CardContent>
          </Card>
          <footer className="text-center mt-6 text-sm text-muted-foreground"><p>使用 Python, Flask & Transformers.js</p></footer>
        </div>
      </main>
    </>
  );
} 