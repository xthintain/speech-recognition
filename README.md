[English](./README_en.md) | 中文

# 实时语音识别 (VAD + Faster-Whisper)

这是一个基于网页的实时语音识别应用。它使用 **VAD (Voice Activity Detection)** 技术在浏览器端自动检测用户的语音起止，并录制音频片段。随后，音频被发送到 **Python Flask** 后端，由 **`faster-whisper`** 模型进行高效的语音转文字处理。

## ✨ 主要功能

- **实时语音识别**: 对用户的语音输入进行实时转录。
- **自动语音检测 (VAD)**: 无需手动点击录音按钮，应用会自动检测语音并进行录制。
- **高效率后端**: 使用 `faster-whisper` 和 CTranslate2 优化，实现快速、低资源占用的推理。
- **模型本地化**: 所有必要的模型文件（Whisper和VAD）都可以预先下载并放置在本地，**无需在运行时从网络下载**，非常适合网络受限的环境。
- **简繁转换**: 后端自动将识别出的繁体中文结果转换为简体中文。
- **文件上传**: 支持直接上传音频文件进行识别。
- **麦克风选择**: 允许用户选择使用的麦克风设备。

## 🛠️ 技术栈

- **前端**: Next.js, React, TypeScript, Tailwind CSS
- **后端**: Python, Flask
- **语音识别 (ASR)**: `faster-whisper` (small model)
- **语音活动检测 (VAD)**: `@ricky0123/vad-web`

---

## ⚠️ 重要：环境设置与模型下载

在运行此项目前，**必须手动下载**所需的模型文件，因为应用被配置为从本地加载它们。

### 1. 后端: `faster-whisper` 模型

本项目默认使用 `small` 模型以平衡速度与准确性。

1.  **访问模型仓库**:
    前往 Hugging Face 的模型页面: [Systran/faster-whisper-small](httpsa://huggingface.co/Systran/faster-whisper-small/tree/main)

2.  **下载所有文件**:
    将该仓库中的**所有文件**下载下来。主要文件包括:
    - `model.bin`
    - `config.json`
    - `tokenizer.json`
    - `vocabulary.txt`

3.  **放置文件**:
    在项目的 `backend/` 目录下创建一个名为 `models` 的新文件夹。将上一步下载的所有文件放入 `backend/models/` 目录中。

    最终目录结构应如下所示:
    ```
    backend/
    ├── models/
    │   ├── model.bin
    │   ├── config.json
    │   ├── tokenizer.json
    │   └── vocabulary.txt
    ├── backend.py
    └── ... (其他后端文件)
    ```

### 2. 前端: VAD & ONNX 模型

前端的 VAD 功能同样需要几个关键文件才能在浏览器中离线运行。

1.  **下载所需文件**:
    - **ONNX Runtime Wasm 文件**:
        - [ort-wasm.wasm](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm.wasm)
        - [ort-wasm-simd.wasm](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm)
    - **VAD Worklet**:
        - [vad.worklet.min.js](https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.11/dist/vad.worklet.min.js)
    - **VAD 模型**:
        - [silero_vad_legacy.onnx](https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.11/dist/silero_vad_legacy.onnx)

2.  **放置文件**:
    将以上所有下载的文件全部放入 `frontend/public/` 目录下。

    最终目录结构应如下所示:
    ```
    frontend/
    ├── public/
    │   ├── ort-wasm.wasm
    │   ├── ort-wasm-simd.wasm
    │   ├── vad.worklet.min.js
    │   └── silero_vad_legacy.onnx
    └── ... (其他前端文件)
    ```
    *注意：`frontend/src/components/whisper-recorder.tsx` 中的代码已配置为从 `/` 根路径加载这些资源，因此将它们放在 `public` 文件夹下即可确保应用能找到它们。*

### 3. 软件依赖

- **Python**: 推荐使用 Python 3.9 或更高版本。
- **Node.js**: 推荐使用 Node.js 18.x 或更高版本。

---

## 🚀 如何运行

完成上述模型下载和配置后，请按以下步骤运行应用。

### 1. 启动后端服务

```bash
# 1. 进入后端目录
cd backend

# 2. (建议) 创建并激活虚拟环境
python -m venv venv
# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 启动 Flask 服务器
python backend.py
```
服务器默认在 `http://127.0.0.1:5000` 上运行。

### 2. 启动前端应用

在**新的终端**中执行以下命令:

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装 Node.js 依赖
npm install

# 3. 启动 Next.js 开发服务器
npm run dev
```
应用将在 `http://localhost:3000` 上可用。

### 3. 开始使用

- 打开浏览器并访问 `http://localhost:3000`。
- 浏览器会请求麦克风权限，请点击"允许"。
- 选择一个麦克风设备，应用会进入"正在聆听..."状态。
- 开始说话，应用会自动检测到语音并录制，录制结束后会将文本显示在屏幕上。

## ⚙️ 工作流程

1.  **前端**: 页面加载后，`@ricky0123/vad-web` 库从 `public` 目录加载其模型和 worklet。
2.  **前端**: VAD 持续监听麦克风。当检测到用户开始说话 (`onSpeechStart`)，状态变为"正在录制"。
3.  **前端**: 当用户停止说话 (`onSpeechEnd`)，VAD 将录制的音频数据 (Float32Array) 打包成 WAV 格式的 Blob。
4.  **前端 -> 后端**: 前端将此 WAV Blob 发送到 Flask 后端的 `/transcribe` API 端点。
5.  **后端**: Flask 服务器接收音频数据，将其保存为临时文件。
6.  **后端**: `faster-whisper` 模型加载本地 `models/` 目录中的文件，并对临时音频文件进行转录。
7.  **后端**: 使用 `opencc-python-reimplemented` 将结果从繁体中文转换为简体中文。
8.  **后端 -> 前端**: 后端将转录后的简体中文文本以 JSON 格式返回给前端。
9.  **前端**: 前端接收到文本并更新UI界面。

## ❓ 故障排查

- **麦克风无法工作**:
  - 确保您已在浏览器中为此网站授予了麦克风访问权限。
  - 检查您的操作系统设置，确保浏览器有权访问麦克风。
  - 尝试在设备选择下拉菜单中选择不同的麦克风。

- **识别结果一直是固定的错误文本 (如 "字幕by索兰娅")**:
  - 这通常表示后端 `faster-whisper` 模型无法正确处理接收到的音频数据。
  - **最可能的原因是前端发送的音频格式不正确**。请确保 `whisper-recorder.tsx` 中 `float32ArrayToWav` 函数正确无误。
  - 检查后端 `backend.py` 是否能正确接收和保存文件。

- **控制台出现 `Failed to fetch ... .onnx` 或 `.js` 错误**:
  - 这意味着前端无法加载 VAD 所需的资源。
  - 请仔细检查**"重要：环境设置与模型下载"**部分的第2步，确保所有必需的文件都已下载并放置在 `frontend/public/` 目录下，并且文件名完全正确。 