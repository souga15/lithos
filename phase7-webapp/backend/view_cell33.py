import json, sys

sys.stdout.reconfigure(encoding='utf-8')

p11_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase11_PINN_NoSynthetic_v9_priority_export_FIXED (1).ipynb'
with open(p11_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Print Cell 33 fully
src = ''.join(nb['cells'][33]['source'])
print("=== PHASE 11 CELL 33 (Priority Export) ===")
print(src)
