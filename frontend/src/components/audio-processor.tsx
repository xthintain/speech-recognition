"use client";

import { useEffect, useState } from "react";

interface AudioProcessorProps {
    audioBlob: Blob | null;
    onTranscriptionResult: (text: string) => void;
    onProcessingChange: (isProcessing: boolean) => void;
    onError: (errorMessage: string) => void;
}

const BACKEND_URL = "http://localhost:5000/api/transcribe";

export default function AudioProcessor({
    audioBlob,
    onTranscriptionResult,
    onProcessingChange,
    onError,
}: AudioProcessorProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(true);
    }, []);

    useEffect(() => {
        if (!audioBlob || !isReady) {
            return;
        }

        const processAudio = async () => {
            onProcessingChange(true);
            
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.wav");

            try {
                const response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "后端返回了一个错误。");
                }

                onTranscriptionResult(data.transcription);

            } catch (error) {
                console.error("与后端通信失败:", error);
                let errorMessage = "请求失败，请检查网络连接或后端服务状态。";
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                onError(errorMessage);
            } finally {
                onProcessingChange(false);
            }
        };

        processAudio();
    }, [audioBlob, isReady, onError, onProcessingChange, onTranscriptionResult]);

    // This component does not render anything to the DOM.
    return null;
} 