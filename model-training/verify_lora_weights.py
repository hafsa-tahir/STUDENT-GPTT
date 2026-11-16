"""
Verify and inspect the fine-tuned StudentGPT LoRA Adapter weights
saved in model-training/studentgpt_lora_model/adapter_model.safetensors
"""
import json
import struct
from pathlib import Path

model_dir = Path(__file__).parent / "studentgpt_lora_model"
config_path = model_dir / "adapter_config.json"
weights_path = model_dir / "adapter_model.safetensors"

config = json.loads(config_path.read_text(encoding="utf-8"))

# Read SafeTensors header (first 8 bytes = uint64 little-endian header length)
with open(weights_path, "rb") as f:
    header_size = struct.unpack("<Q", f.read(8))[0]
    header_json = json.loads(f.read(header_size).decode("utf-8"))

tensor_names = [k for k in header_json.keys() if k != "__metadata__"]
total_params = 0
for name in tensor_names:
    shape = header_json[name]["shape"]
    n = 1
    for dim in shape:
        n *= dim
    total_params += n

print("=" * 65)
print("  STUDENTGPT FINE-TUNED LORA ADAPTER VERIFICATION REPORT")
print("=" * 65)
print(f"Base Architecture   : {config['base_model_name_or_path']}")
print(f"PEFT Type           : {config['peft_type']} (PEFT v{config['peft_version']})")
print(f"LoRA Rank (r)       : {config['r']}")
print(f"LoRA Alpha          : {config['lora_alpha']}")
print(f"Target Modules      : {', '.join(config['target_modules'])}")
print(f"SafeTensors File    : {weights_path.name} ({weights_path.stat().st_size / (1024*1024):.2f} MB)")
print(f"Trained LoRA Tensors: {len(tensor_names)} tensors")
print(f"Trainable Parameters: {total_params:,} parameters ({total_params / 1e6:.2f}M)")
print("-" * 65)
print("Sample Trained Tensors:")
for name in tensor_names[:6]:
    info = header_json[name]
    print(f"  - {name} | shape={info['shape']} | dtype={info['dtype']}")
print("=" * 65)

