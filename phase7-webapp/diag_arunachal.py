
import sys
import os
import json
from datetime import datetime, timezone

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

try:
    from mock_data import CELLS, ALL_REGIONS, REGION_COUNTS
    
    region_key = "arunachal_w"
    if region_key not in CELLS:
        print(f"Error: Region '{region_key}' not found in CELLS")
        sys.exit(1)
        
    cells = CELLS[region_key]
    total = len(cells)
    red = sum(1 for c in cells if c["risk_level"] == "RED")
    orange = sum(1 for c in cells if c["risk_level"] == "ORANGE")
    green = sum(1 for c in cells if c["risk_level"] == "GREEN")
    
    print(f"Region: {ALL_REGIONS[region_key]['name']}")
    print(f"Total Cells: {total}")
    print(f"RED: {red} ({100*red/total:.1f}%)")
    print(f"ORANGE: {orange} ({100*orange/total:.1f}%)")
    print(f"GREEN: {green} ({100*green/total:.1f}%)")
    
    # Analyze a few cells
    print("\nSample Cell Data (First 3):")
    for i in range(min(3, total)):
        c = cells[i]
        print(f"Cell ID: {c['cell_id']}")
        print(f"  Risk Score: {c['risk_score']}")
        print(f"  FoS Seismic: {c.get('fos_seismic')}")
        print(f"  FoS Static: {c.get('fos_static')}")
        print(f"  Deformation Proxy: {c.get('deformation_proxy')}")
        print(f"  Slope Mean: {c.get('slope_mean')}")
        print(f"  Rain 72h: {c.get('rainfall_72h')}")
        print(f"  Soil Type: {c.get('soil_type')}")
        print("-" * 20)

    # Check if any global factor is high
    avg_deform = sum(c.get('deformation_proxy', 0) for c in cells) / total
    avg_slope = sum(c.get('slope_mean', 0) for c in cells) / total
    avg_fos_s = sum(c.get('fos_seismic', 0) for c in cells) / total
    
    print(f"\nAverages for {region_key}:")
    print(f"  Avg Deformation: {avg_deform:.3f}")
    print(f"  Avg Slope: {avg_slope:.1f}")
    print(f"  Avg FoS Seismic: {avg_fos_s:.3f}")

except Exception as e:
    import traceback
    traceback.print_exc()
