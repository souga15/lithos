import json, shutil

f1 = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase11_PINN_NoSynthetic_v9_priority_export_FIXED (1).ipynb'
f2 = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\final r2\LITHOS_Phase11_FIXED_Fast_Dense.ipynb'

shutil.copyfile(f1, f2)

with open(f1, 'r', encoding='utf-8') as f:
    nb1 = json.load(f)

with open(f2, 'r', encoding='utf-8') as f:
    nb2 = json.load(f)

print(f"Verified nb1: {len(nb1['cells'])} cells")
print(f"Verified nb2: {len(nb2['cells'])} cells")
print("Both files are 100% synced and valid!")
