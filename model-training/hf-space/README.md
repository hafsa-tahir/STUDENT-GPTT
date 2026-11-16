---
title: StudentGPT Academic AI Engine
emoji: 🎓
colorFrom: purple
colorTo: pink
sdk: gradio
sdk_version: 5.9.1
app_file: app.py
pinned: true
---

# StudentGPT — 24/7 Fine-Tuned Academic AI Inference Space

This Hugging Face Space hosts the **4-bit quantized GGUF weights** of the custom fine-tuned **StudentGPT Academic AI Model** and serves an OpenAI-compatible REST API (`POST /v1/chat/completions`) 24/7 for free.

## How to Deploy on Hugging Face Spaces (Free 24/7 Hosting)

1. Go to **[huggingface.co/new-space](https://huggingface.co/new-space)**.
2. Name your Space `studentgpt-model`, select **Docker** as the Space SDK, and choose **CPU Basic (Free - 2 vCPU, 16 GB RAM)**.
3. Upload the 4 files from this `model-training/hf-space/` folder (`Dockerfile`, `requirements.txt`, `app.py`, and `README.md`) to your Space.
4. *(Optional)* In your Space **Settings → Variables**, set:
   - `HF_GGUF_REPO`: `hafsa-tahir/StudentGPT-Academic-GGUF` (created by Step 6 of the Google Colab notebook)
   - `HF_GGUF_FILE`: `unsloth.Q4_K_M.gguf`
5. Once the Space status says **Running**, your permanent 24/7 API URL is:
   `https://<your-hf-username>-studentgpt-model.hf.space/v1/chat/completions`

