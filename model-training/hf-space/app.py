import spaces
import os
import json
import torch
import gradio as gr
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = os.environ.get("BASE_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")
LORA_DIR = "./studentgpt_lora_model"

DEFAULT_SYSTEM_PROMPT = (
    "You are StudentGPT, a custom fine-tuned academic AI engine created by Hafsa Tahir for "
    "university-level note synthesis, mathematical derivation, active-recall assessment generation, "
    "publication-grade research analysis, and 8-mode Socratic tutoring. Always maintain strict "
    "source fidelity, use clean KaTeX/LaTeX notation for formulas, and never invent citations."
)

print(f"Loading tokenizer & model: {MODEL_ID} on ZeroGPU...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
).to("cuda")

if os.path.exists(os.path.join(LORA_DIR, "adapter_model.safetensors")):
    from peft import PeftModel
    print("Attaching custom fine-tuned StudentGPT LoRA adapter weights...")
    model = PeftModel.from_pretrained(model, LORA_DIR).to("cuda")

model.eval()


@spaces.GPU(duration=90)
def predict(prompt_or_json: str, max_tokens: int = 1800, temperature: float = 0.3):
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
            max_new_tokens=min(int(max_tokens or 1800), 2400),
            temperature=max(float(temperature or 0.3), 0.05),
            do_sample=True,
        )

    reply = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True).strip()
    return reply


with gr.Blocks(title="StudentGPT 24/7 ZeroGPU Academic AI Engine") as demo:
    gr.Markdown(
        f"""
        # 🎓 StudentGPT — 24/7 Custom Fine-Tuned Academic AI Engine (ZeroGPU)
        **Engineered by Hafsa Tahir** · Powered by `{MODEL_ID}` + QLoRA on Hugging Face **ZeroGPU**
        """
    )
    inp = gr.Textbox(
        label="Ask StudentGPT an Academic Question",
        placeholder="Explain Coulomb's Law and derive the electric field of a dipole...",
        lines=4,
    )
    max_tok = gr.Slider(minimum=128, maximum=2400, value=1800, step=64, label="Max New Tokens")
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
