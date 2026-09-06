import json, sys

sys.stdout.reconfigure(encoding='utf-8')
nb_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase9_NE_FullCoverage_(11).ipynb'

with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for idx, c in enumerate(nb.get('cells', [])):
    if c.get('cell_type') == 'code':
        src = ''.join(c.get('source', []))
        print(f"\n=================== CODE CELL {idx} ===================")
        print(src[:500])
