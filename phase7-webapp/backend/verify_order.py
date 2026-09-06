import json, sys

sys.stdout.reconfigure(encoding='utf-8')

nb_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase9_NE_FullCoverage_(11).ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

cells = nb.get('cells', [])
print(f"Total cells: {len(cells)}\n")
for idx, c in enumerate(cells):
    src = ''.join(c.get('source', []))
    first = src.strip().split('\n')[0][:100] if src.strip() else ''
    print(f"  Cell {idx:02d} [{c.get('cell_type')}]: {first}")
