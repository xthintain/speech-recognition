"use client";

import dynamic from 'next/dynamic'

/**
 * 使用 next/dynamic 动态导入 WhisperRecorder 组件，并禁用服务器端渲染 (SSR)。
 * 这确保了依赖于浏览器 API 的 @xenova/transformers 库只在客户端执行。
 */
const WhisperRecorder = dynamic(
  () => import('@/components/whisper-recorder'),
  { 
    ssr: false,
    // 在组件加载时显示一个简单的占位符
    loading: () => (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <p className="text-lg text-muted-foreground">正在加载语音识别器...</p>
        </div>
    )
  }
)

/**
 * 应用的主页面。
 * 它只负责渲染被动态导入的 WhisperRecorder 组件。
 * @returns {JSX.Element}
 */
export default function HomePage() {
  return <WhisperRecorder />
}