"""
StudentGPT Fine-Tuned Model Evaluation & Interactive Test Suite
===============================================================
Tests the fine-tuned `StudentGPT-3B-Academic-Tutor` LoRA model across:
1. StudentGPT Identity & Creator Attribution ("Hafsa Tahir")
2. Socratic Study Tutor Mode (Guided Questions & LaTeX Math)
3. Strict JSON Flashcards Generation (Practice Studio)
4. Strict JSON Quiz Generation (Exam Simulator)
5. Document-Grounded RAG + Diagram Analysis
"""

from unsloth import FastLanguageModel

# If `model` and `tokenizer` are not already in memory, load from ./studentgpt_lora_model:
try:
    model
    tokenizer
except NameError:
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="studentgpt_lora_model",
        max_seq_length=2048,
        load_in_4bit=True,
    )

FastLanguageModel.for_inference(model)

# Balance LoRA adapter scaling (prevents overfitting phrases from overriding general knowledge)
for module in model.modules():
    if hasattr(module, "scaling") and isinstance(module.scaling, dict):
        for k in module.scaling:
            module.scaling[k] = 0.35

SYSTEM_PROMPT = (
    "You are StudentGPT, an expert academic AI tutor, study strategist, and research assistant "
    "created by Hafsa Tahir. Provide clear, rigorous, encouraging, and structured academic responses."
)

TEST_CASES = [
    {
        "title": "TEST 1: Identity & Creator Verification",
        "user": "Who are you, who created you, and how do you help university students?",
    },
    {
        "title": "TEST 2: Socratic Tutor Mode (Physics)",
        "user": (
            "[Tutor Mode: Socratic Questioning]\n"
            "Student Question: Why is a satellite in a circular orbit at constant speed still accelerating?"
        ),
    },
    {
        "title": "TEST 3: Strict JSON Flashcard Generator (Computer Science)",
        "user": (
            "Generate 2 high-yield flashcards on Binary Search Trees (BST). "
            "Return ONLY a valid JSON array with keys: front, back, difficulty, tag."
        ),
    },
    {
        "title": "TEST 4: Document-Grounded RAG + Diagram Analysis",
        "user": (
            "Uploaded Document Context:\n"
            "\"[Page 4 - Figure 2.1: Action Potential Graph] Resting membrane potential is -70 mV. "
            "Depolarization occurs when voltage-gated Na+ channels open at the -55 mV threshold, "
            "driving membrane potential to +30 mV. Repolarization follows as K+ channels open.\"\n\n"
            "Question: Based strictly on the uploaded document and Figure 2.1, explain what happens at -55 mV."
        ),
    },
]

for test in TEST_CASES:
    print("\n" + "=" * 70)
    print(f"🧪 {test['title']}")
    print("=" * 70)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": test["user"]},
    ]
    inputs = tokenizer.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
    ).to("cuda")
    outputs = model.generate(input_ids=inputs, max_new_tokens=400, temperature=0.3)
    reply = tokenizer.decode(outputs[0][inputs.shape[-1] :], skip_special_tokens=True)
    print(reply)

