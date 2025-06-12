"use client";

import { useRef, useEffect } from 'react';

interface WaveformProps {
  stream: MediaStream | null;
}

const Waveform: React.FC<WaveformProps> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    if (!stream || !canvasRef.current || stream.getAudioTracks().length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) {
      return;
    }
    
    const audioContext = new AudioContext({});
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    let isCancelled = false;

    const draw = () => {
      if (isCancelled) return;

      animationFrameId.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(244, 244, 245)'; // Tailwind's 'muted' color
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgb(239, 68, 68)'; // Tailwind's 'red-500' color
      canvasCtx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();

    return () => {
      isCancelled = true;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      source.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [stream]);

  return stream ? <canvas ref={canvasRef} width="500" height="100" className="w-full rounded-md bg-muted" /> : null;
};

export default Waveform; 