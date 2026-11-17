import spaces
import os
import json
import inspect
import torch
import safetensors.torch
import gradio as gr
from transformers import AutoModelForCausalLM, AutoTokenizer

# Force safetensors to load weights on CPU during ZeroGPU startup (before @spaces.GPU attaches physical CUDA)
_orig_safe_load = safetensors.torch.load_file
safetensors.torch.load_file = lambda filename, device="cpu": _orig_safe_load(filename, device="cpu")

# Automatically detect uploaded LoRA adapter weights (either in root ./ or ./studentgpt_lora_model)
LORA_DIR = None
if os.path.exists("./adapter_model.safetensors") and os.path.exists("./adapter_config.json"):
    LORA_DIR = "."
elif os.path.exists("./studentgpt_lora_model/adapter_model.safetensors"):
    LORA_DIR = "./studentgpt_lora_model"

MODEL_ID = os.environ.get("BASE_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")
if LORA_DIR and os.path.exists(os.path.join(LORA_DIR, "adapter_config.json")):
    cfg_path = os.path.join(LORA_DIR, "adapter_config.json")
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        base_path = str(cfg.get("base_model_name_or_path", ""))
        if "3B" in base_path:
            MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
        elif "7B" in base_path:
            MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"

        # Strip experimental Unsloth keys that older PEFT versions reject
        from peft import LoraConfig
        valid_keys = set(inspect.signature(LoraConfig.__init__).parameters.keys())
        cleaned_cfg = {k: v for k, v in cfg.items() if k in valid_keys or k == "peft_type"}
        cleaned_cfg["base_model_name_or_path"] = MODEL_ID
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cleaned_cfg, f, indent=2)
    except Exception as e:
        print("Config cleanup warning:", e)

DEFAULT_SYSTEM_PROMPT = (
    "You are StudentGPT, a custom fine-tuned academic AI engine created by Hafsa Tahir for "
    "university-level note synthesis, mathematical derivation, active-recall assessment generation, "
    "publication-grade research analysis, and 8-mode Socratic tutoring. Always maintain strict "
    "source fidelity, use clean KaTeX/LaTeX notation for formulas, and never invent citations."
)

print(f"Loading tokenizer & base model on CPU: {MODEL_ID}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
base_model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    low_cpu_mem_usage=False,
)

LORA_STATUS = "Base Model + StudentGPT Alignment"
if LORA_DIR:
    try:
        from peft import PeftModel
        print(f"Attaching & merging custom fine-tuned StudentGPT LoRA weights from {LORA_DIR} on CPU...")
        peft_model = PeftModel.from_pretrained(base_model, LORA_DIR, torch_device="cpu")
        base_model = peft_model.merge_and_unload()
        LORA_STATUS = f"Custom QLoRA Fine-Tuned Weights Merged ({LORA_DIR}/adapter_model.safetensors)"
        print("Successfully merged custom LoRA weights into base model!")
    except Exception as e:
        print("LoRA attach warning (falling back to base model):", e)

model = base_model.to("cuda")
model.eval()


@spaces.GPU(duration=25)
def predict(prompt_or_json: str, max_tokens: int = 1500, temperature: float = 0.3):
    if not prompt_or_json or not str(prompt_or_json).strip():
        return "Please enter a question."

    raw = str(prompt_or_json).strip()
    messages = None
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                messages = parsed
        except Exception:
            messages = None

    if not messages:
        messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": raw},
        ]

    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to("cuda")

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=min(int(max_tokens or 1500), 2000),
            temperature=max(float(temperature or 0.3), 0.05),
            do_sample=True,
        )

    reply = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True).strip()
    return reply


with gr.Blocks(title="StudentGPT 24/7 ZeroGPU Academic AI Engine") as demo:
    gr.Markdown(
        f"""
        # 🎓 StudentGPT — 24/7 Custom Fine-Tuned Academic AI Engine (ZeroGPU)
        **Engineered by Hafsa Tahir** · Powered by `{MODEL_ID}` · **Status:** `{LORA_STATUS}`
        """
    )
    inp = gr.Textbox(
        label="Ask StudentGPT an Academic Question",
        placeholder="Explain Coulomb's Law and derive the electric field of a dipole...",
        lines=4,
    )
    max_tok = gr.Slider(minimum=128, maximum=2000, value=1500, step=64, label="Max New Tokens")
    temp = gr.Slider(minimum=0.05, maximum=1.0, value=0.3, step=0.05, label="Temperature")
    btn = gr.Button("Generate Academic Response", variant="primary")
    out = gr.Markdown(label="StudentGPT Output")

    btn.click(
        fn=predict,
        inputs=[inp, max_tok, temp],
        outputs=out,
        api_name="predict",
    )

demo.launch()
