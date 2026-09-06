import json, sys

sys.stdout.reconfigure(encoding='utf-8')

p11_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase11_PINN_NoSynthetic_v9_priority_export_FIXED (1).ipynb'
with open(p11_path, 'r', encoding='utf-8') as f:
    nb11 = json.load(f)

cells = nb11.get('cells', [])
print(f"=== PHASE 11 AUDIT ({len(cells)} cells) ===\n")

all_src = '\n'.join(''.join(c.get('source', [])) for c in cells)

# Check 1: GPKG loading path
print("--- GPKG Input Path ---")
for c in cells:
    s = ''.join(c.get('source', []))
    for line in s.split('\n'):
        if '.gpkg' in line and ('read_file' in line or 'GPKG' in line.upper() or 'gpkg_path' in line.lower()):
            print(f"  {line.strip()}")

# Check 2: Feature count
print("\n--- Feature Vector Check ---")
cell12_src = ''.join(cells[12]['source'])
if '9' in cell12_src or 'nine' in cell12_src.lower():
    print("  9-feature references found in dataset build cell")

features = ['slope', 'cohesion', 'friction', 'depth', 'saturation', 'pga', 'ndvi', 'soil_type', 'rainfall']
for f in features:
    if f in all_src:
        print(f"  [OK] {f}")
    else:
        print(f"  [MISSING] {f}")

# Check 3: PINN architecture
print("\n--- PINN Architecture ---")
cell14_src = ''.join(cells[14]['source'])
if 'AdvancedLandslidePINN' in cell14_src or 'PINN' in cell14_src:
    print("  [OK] PINN model class found")
if 'ResNet' in cell14_src or 'residual' in cell14_src.lower():
    print("  [OK] Residual connections present")
if 'Dropout' in cell14_src or 'dropout' in cell14_src:
    print("  [OK] MC Dropout for uncertainty")

# Check 4: Training epochs
cell16_src = ''.join(cells[16]['source'])
for line in cell16_src.split('\n'):
    if 'epoch' in line.lower() and ('500' in line or 'range' in line):
        print(f"\n--- Training Config ---")
        print(f"  {line.strip()}")
        break

# Check 5: Model export
print("\n--- Model Export ---")
cell29_src = ''.join(cells[29]['source'])
if 'torch.save' in cell29_src or '.pth' in cell29_src:
    print("  [OK] Model .pth export found")
    for line in cell29_src.split('\n'):
        if '.pth' in line:
            print(f"    {line.strip()}")
            break

# Check 6: Priority export (Cell 33)
print("\n--- Priority Export (Cell 33) ---")
cell33_src = ''.join(cells[33]['source'])
if 'units_enriched' in cell33_src or 'gpkg' in cell33_src:
    print("  [OK] Enriched GPKG export found")
if 'risk_score' in cell33_src:
    print("  [OK] risk_score computation present")
if 'fos_seismic' in cell33_src or 'fos_static' in cell33_src:
    print("  [OK] FoS calculation present")
for line in cell33_src.split('\n'):
    if 'to_file' in line or '.gpkg' in line:
        print(f"    {line.strip()}")

# Check 7: Spatial holdout
if 'spatial' in all_src.lower() and 'holdout' in all_src.lower():
    print("\n  [OK] Spatial holdout evaluation present")

# Check 8: Physics loss
if 'physics' in all_src.lower() and ('loss' in all_src.lower() or 'regulariz' in all_src.lower()):
    print("  [OK] Physics-informed loss/regularization present")

# Check 9: AUC metric
if 'auc' in all_src.lower() or 'roc_auc' in all_src.lower():
    print("  [OK] AUC evaluation metric present")

# Check 10: Key dependencies
print("\n--- Phase 11 Dependencies ---")
p11_deps = ['torch', 'sklearn', 'numpy', 'geopandas', 'ee']
for dep in p11_deps:
    if dep in all_src:
        print(f"  [OK] {dep}")
    else:
        print(f"  [MISSING] {dep}")

print("\n=== PHASE 11 AUDIT COMPLETE ===")
