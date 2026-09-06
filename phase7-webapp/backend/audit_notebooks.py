import json, sys, os

sys.stdout.reconfigure(encoding='utf-8')

# ── Audit Phase 9 ──
p9_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase9_NE_FullCoverage_(11).ipynb'
with open(p9_path, 'r', encoding='utf-8') as f:
    nb9 = json.load(f)

cells = nb9.get('cells', [])
print(f"=== PHASE 9 AUDIT ({len(cells)} cells) ===\n")

# Check 1: Stream threshold
cell12_src = ''.join(cells[12]['source'])
if 'STREAM_THRESHOLD_CELLS = 1200' in cell12_src:
    print("[OK] Cell 12: STREAM_THRESHOLD_CELLS = 1200.0 (patched)")
elif 'STREAM_THRESHOLD_CELLS = 5000' in cell12_src:
    print("[FAIL] Cell 12: STREAM_THRESHOLD_CELLS still 5000 (NOT patched)")
else:
    print("[WARN] Cell 12: Could not find STREAM_THRESHOLD_CELLS value")

# Check 2: min_slope_deg and min_pixels
cell13_src = ''.join(cells[13]['source'])
if 'min_slope_deg=1.5' in cell13_src:
    print("[OK] Cell 13: min_slope_deg=1.5 (patched)")
else:
    # Find what min_slope_deg is set to
    for line in cell13_src.split('\n'):
        if 'min_slope_deg' in line and 'def ' in line:
            print(f"[WARN] Cell 13: {line.strip()}")
            break

if 'min_pixels=2' in cell13_src:
    print("[OK] Cell 13: min_pixels=2 (patched)")
else:
    for line in cell13_src.split('\n'):
        if 'min_pixels' in line and 'def ' in line:
            print(f"[WARN] Cell 13: {line.strip()}")
            break

if 'poly.area >= 0.00002' in cell13_src:
    print("[OK] Cell 13: poly.area >= 0.00002 (patched)")
elif 'poly.area >= 0.0001' in cell13_src:
    print("[FAIL] Cell 13: poly.area >= 0.0001 (NOT patched)")

# Check 3: Verify all steps are present
required_steps = {
    'STEP 1': 'Install dependencies',
    'STEP 2': 'Mount Drive',
    'STEP 3': 'Define NE state bounding boxes',
    'STEP 4': 'DEM exports',
    'STEP 5': 'Poll exports',
    'STEP 6': 'Copy DEMs',
    'STEP 7': 'WhiteboxTools',
    'STEP 8': 'Hillslope segmentation',
    'STEP 9': 'Convert to polygons',
    'STEP 10': 'Soil parameters',
    'STEP 11': 'Merge + export gpkg',
}

all_src = '\n'.join(''.join(c.get('source', [])) for c in cells)
print("\n--- Step Presence Check ---")
for step, desc in required_steps.items():
    if step in all_src:
        print(f"  [OK] {step}: {desc}")
    else:
        print(f"  [MISSING] {step}: {desc}")

# Check 4: Key imports
key_imports = ['rasterio', 'geopandas', 'shapely', 'whitebox', 'earthengine-api', 'scipy']
print("\n--- Key Dependencies ---")
for pkg in key_imports:
    if pkg in all_src:
        print(f"  [OK] {pkg}")
    else:
        print(f"  [MISSING] {pkg}")

# Check 5: Drive checkpoint paths
if 'DRIVE_CHECKPOINT_DIR' in all_src:
    print("\n[OK] DRIVE_CHECKPOINT_DIR defined")
else:
    print("\n[MISSING] DRIVE_CHECKPOINT_DIR not found")

if 'ENABLE_DRIVE_CHECKPOINTS' in all_src:
    # Check what it's set to
    for c in cells:
        s = ''.join(c.get('source', []))
        if 'ENABLE_DRIVE_CHECKPOINTS' in s and '=' in s:
            for line in s.split('\n'):
                if 'ENABLE_DRIVE_CHECKPOINTS' in line and '=' in line and 'if' not in line:
                    print(f"  Drive Checkpoints: {line.strip()}")
                    break
            break

# Check 6: Output path
if 'OUT_PATH' in all_src or 'lithos_all' in all_src:
    print("[OK] Output path references found")
else:
    print("[WARN] No output path references found")

# Check 7: Cell 15 merge logic
cell15_src = ''.join(cells[15]['source'])
if 'BASELINE_PATH' in cell15_src:
    print("[OK] Cell 15: Baseline merge logic present")
if '.to_file' in cell15_src or 'to_file' in cell15_src:
    print("[OK] Cell 15: GPKG export present")

# Check 8: NE_REGIONS coverage
cell3_src = ''.join(cells[3]['source'])
ne_states = ['arunachal', 'assam', 'meghalaya', 'nagaland', 'manipur', 'mizoram', 'tripura', 'sikkim']
print("\n--- NE State Coverage ---")
for state in ne_states:
    if state in cell3_src:
        print(f"  [OK] {state}")
    else:
        print(f"  [MISSING] {state}")

# Check 9: Soil params
cell14_src = ''.join(cells[14]['source'])
soil_regions = ['cherrapunji', 'sikkim', 'manipur', 'nagaland', 'mizoram', 'tripura', 'arunachal', 'assam', 'meghalaya']
print("\n--- Soil Parameter Coverage ---")
for reg in soil_regions:
    if reg in cell14_src:
        print(f"  [OK] {reg}")
    else:
        print(f"  [MISSING] {reg}")

# Check 10: Verify cell ordering is sequential (no gaps)
print("\n--- Cell Sequence ---")
code_cells = [(i, ''.join(c['source'])[:60]) for i, c in enumerate(cells) if c['cell_type'] == 'code']
for i, (idx, preview) in enumerate(code_cells):
    print(f"  Code cell {i+1} (nb cell {idx}): {preview}")

print("\n=== AUDIT COMPLETE ===")
