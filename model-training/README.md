# StudentGPT — Custom LoRA Fine-Tuning & 24/7 Deployment Suite

This folder contains the complete **Supervised Fine-Tuning (SFT), QLoRA Training Pipeline, and 24/7 Cloud Deployment Suite** for **StudentGPT**.

> **Safety Guarantee:** Your live web app (`https://student-gptt.vercel.app`) and Android APK remain **100% untouched**. Everything in this folder is self-contained.

---

## 1. Folder Contents (`model-training/`)

| File / Folder | Purpose |
| :--- | :--- |
| [`build_dataset.py`](./build_dataset.py) | Python dataset builder that generates **245 multi-disciplinary academic training examples** across 12 subjects, all 6 StudentGPT modules, **all 8 Pedagogical Study Tutor modes**, Document-Grounded RAG + Diagram Analysis, and **StudentGPT Identity Alignment**. |
| [`studentgpt_sft_dataset.jsonl`](./studentgpt_sft_dataset.jsonl) | **245 examples** in ChatML / OpenAI `messages` JSONL format (for Unsloth & Hugging Face `SFTTrainer`). |
| [`studentgpt_alpaca_dataset.json`](./studentgpt_alpaca_dataset.json) | **245 examples** in Alpaca (`instruction` / `input` / `output`) JSON format. |
| [`studentgpt_gemini_tuning.csv`](./studentgpt_gemini_tuning.csv) | **245 examples** in Google AI Studio `text_input,output` CSV format for **24/7 Free Gemini Supervised Fine-Tuning**. |
| [`StudentGPT_LoRA_FineTuning_Colab.ipynb`](./StudentGPT_LoRA_FineTuning_Colab.ipynb) | **1-Click Free Google Colab Notebook** that fine-tunes `Qwen2.5-3B-Instruct` in 4-bit QLoRA, plots the `#724060` Training Loss curve, and pushes both the **LoRA Adapter** and **4-bit GGUF model** to Hugging Face Hub. |
| [`train_lora.py`](./train_lora.py) | Standalone Python QLoRA training script (`PyTorch` + `Unsloth` + `TRL SFTTrainer`). |
| [`Modelfile`](./Modelfile) | **Ollama `Modelfile`** for running `studentgpt` locally offline (`ollama create studentgpt -f Modelfile`). |
| [`hf-space/`](./hf-space/) | **Ready-to-Deploy 24/7 Free Hugging Face Space Server** (`Dockerfile`, `app.py`, `requirements.txt`, `README.md`) serving an OpenAI-compatible `/v1/chat/completions` API 24/7 on Hugging Face's free 16 GB RAM tier. |

---

## 2. Two Ways to Train & Host Your Model 24/7 for Free (\$0)

### Path A: Open-Source PyTorch QLoRA + 24/7 Hugging Face Space
1. Open **[Google Colab](https://colab.research.google.com/)**, upload [`StudentGPT_LoRA_FineTuning_Colab.ipynb`](./StudentGPT_LoRA_FineTuning_Colab.ipynb), select **Runtime → Change runtime type → T4 GPU**, upload [`studentgpt_sft_dataset.jsonl`](./studentgpt_sft_dataset.jsonl), and click **Run all**.
2. In **Step 6** of the notebook, paste your free Hugging Face Write Token (`https://huggingface.co/settings/tokens`) to publish:
   - `hafsa-tahir/StudentGPT-Academic-LoRA`
   - `hafsa-tahir/StudentGPT-Academic-GGUF`
3. Create a free Docker Space at **[huggingface.co/new-space](https://huggingface.co/new-space)** (select **Docker** + **CPU Basic Free 16 GB RAM**) and upload the 4 files from [`model-training/hf-space/`](./hf-space/). Your model is now live 24/7 at `https://<your-username>-studentgpt-model.hf.space/v1/chat/completions`!

### Path B: Google AI Studio 24/7 Free Tuned Model (Fastest GPU Response)
1. Go to **[Google AI Studio — Tune a Model](https://aistudio.google.com/)**.
2. Upload [`studentgpt_gemini_tuning.csv`](./studentgpt_gemini_tuning.csv) (`245 examples`).
3. Click **Tune**—Google trains and hosts your custom tuned model (`tunedModels/studentgpt-...`) 24/7 on Google's TPUs for \$0!
