#!/usr/bin/env python3
"""
StudentGPT — 4-Bit QLoRA Supervised Fine-Tuning (SFT) Pipeline
==============================================================
Trains a custom LoRA adapter on `studentgpt_sft_dataset.jsonl` using:
- Base Model : Qwen/Qwen2.5-7B-Instruct (or unsloth/Llama-3.2-3B-Instruct-bnb-4bit)
- Method     : 4-bit NormalFloat (NF4) QLoRA via Unsloth + Hugging Face TRL SFTTrainer
- Target     : Attention & MLP projection matrices (q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj)
- Output     :
    1. LoRA Adapter Weights (`./outputs/studentgpt-lora-adapter`)
    2. Quantized GGUF for Ollama (`./outputs/studentgpt-q4_k_m.gguf`)
    3. Training Loss Plot (`./outputs/training_loss_curve.png`)
"""

import json
import os
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import FastLanguageModel, is_bfloat16_supported

# 1. Configuration (Qwen2.5-7B-Instruct with 16K Long-Context & Anti-Overfitting LoRA)
BASE_MODEL_NAME = os.environ.get(
    "BASE_MODEL_NAME", "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
)
MAX_SEQ_LENGTH = 16384
LORA_RANK = 16
LORA_ALPHA = 8
OUTPUT_DIR = "./studentgpt_7b_lora_model"
DATASET_PATH = os.path.join(os.path.dirname(__file__), "studentgpt_sft_dataset.jsonl")


def main():
    print(f"[1/5] Loading 4-bit quantized base model: {BASE_MODEL_NAME}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL_NAME,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )

    print(f"[2/5] Injecting LoRA adapters (r={LORA_RANK}, alpha={LORA_ALPHA})")
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=LORA_ALPHA,
        lora_dropout=0.0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    print(f"[3/5] Loading StudentGPT SFT dataset from {DATASET_PATH}")
    dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

    def format_chat_template(batch):
        texts = [
            tokenizer.apply_chat_template(
                msgs, tokenize=False, add_generation_prompt=False
            )
            for msgs in batch["messages"]
        ]
        return {"text": texts}

    dataset = dataset.map(format_chat_template, batched=True)

    print("[4/5] Starting Supervised Fine-Tuning (SFTTrainer)...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=10,
            num_train_epochs=3,
            learning_rate=2e-4,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=5,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir=OUTPUT_DIR,
            report_to="none",
        ),
    )

    trainer_stats = trainer.train()
    print(f"Training completed! Final loss: {trainer_stats.training_loss:.4f}")

    print(f"[5/5] Saving LoRA adapter weights to {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    # Save training loss history for plotting
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(OUTPUT_DIR, "training_log_history.json"), "w") as f:
        json.dump(trainer.state.log_history, f, indent=2)

    # Optional: Push to Hugging Face Hub if HF_TOKEN is set
    hf_token = os.environ.get("HF_TOKEN")
    hf_repo = os.environ.get("HF_REPO_ID", "hafsa-tahir/StudentGPT-Academic-7B-LoRA")
    if hf_token:
        print(f"Pushing fine-tuned LoRA adapter to Hugging Face Hub: {hf_repo}")
        model.push_to_hub(hf_repo, token=hf_token)
        tokenizer.push_to_hub(hf_repo, token=hf_token)


if __name__ == "__main__":
    main()

