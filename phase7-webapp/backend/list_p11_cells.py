import json, sys

sys.stdout.reconfigure(encoding='utf-8')

p11_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase11_PINN_NoSynthetic_v9_priority_export_FIXED (1).ipynb'
with open(p11_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for idx, cell in enumerate(nb['cells']):
    source = "".join(cell.get('source', []))
    print(f"=== Cell {idx} ===")
    lines = source.split('\n')
    print("\n".join(lines[:10]))
    print(f"... ({len(lines)} lines total)")
    print()
