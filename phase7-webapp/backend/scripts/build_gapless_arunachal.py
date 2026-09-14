import pyogrio
import geopandas as gpd
import pandas as pd
import numpy as np
import os
import shutil

gpkg_curr_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.gpkg')
gpkg_backup_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.v2.backup.gpkg')
gpkg_r2_path   = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\final r2\lithos_all_ne_slope_units_final (2).gpkg')

print("1. Creating backup...")
shutil.copyfile(gpkg_curr_path, gpkg_backup_path)

print("2. Reading Arunachal Pradesh from Colab R2 (169,033 units)...")
# We read the full columns from Colab R2 for Arunachal Pradesh
arun_all = pyogrio.read_dataframe(
    gpkg_r2_path,
    layer='lithos_all_ne_slope_units_final',
    where="region = 'arunachal_pradesh'"
)
print(f"Loaded {len(arun_all)} Arunachal units. Bounds: {arun_all.total_bounds}")

# Sample 14,000 units evenly across the spatial extent
# To get perfect spatial coverage without clustering, we use a 2D spatial grid binning:
print("3. Stratified spatial sampling across all 100% of Arunachal territory...")
arun_all['lon_bin'] = np.floor((arun_all['center_lon'] - 91.5) / 0.05).astype(int)
arun_all['lat_bin'] = np.floor((arun_all['center_lat'] - 26.5) / 0.05).astype(int)
arun_all['cell_bin'] = arun_all['lon_bin'].astype(str) + "_" + arun_all['lat_bin'].astype(str)

# Group by spatial bin and take up to 2-3 units per bin
arun_sampled = arun_all.groupby('cell_bin', group_keys=False).apply(
    lambda grp: grp.sample(n=min(len(grp), 3), random_state=42)
).reset_index(drop=True)

# Drop temporary bin columns
arun_sampled = arun_sampled.drop(columns=['lon_bin', 'lat_bin', 'cell_bin'], errors='ignore')
arun_sampled['region'] = 'arunachal_w'
print(f"Sampled {len(arun_sampled)} Arunachal units. Bounds: {arun_sampled.total_bounds}")
print(f"Central units (lon 93-95): {len(arun_sampled[(arun_sampled.center_lon >= 93) & (arun_sampled.center_lon <= 95)])}")
print(f"North units (lat > 28.3): {len(arun_sampled[arun_sampled.center_lat >= 28.3])}")

print("4. Reading other regions from current GPKG...")
curr = pyogrio.read_dataframe(gpkg_curr_path)
other_regions = curr[curr['region'] != 'arunachal_w']
print(f"Existing other regions count: {len(other_regions)}")

# Combine
final_gdf = pd.concat([arun_sampled, other_regions], ignore_index=True)
final_gdf = gpd.GeoDataFrame(final_gdf, crs=curr.crs)

print("\n--- FINAL GPKG SUMMARY ---")
print(f"Total units: {len(final_gdf)}")
for rgn, grp in final_gdf.groupby('region'):
    b = grp.total_bounds
    print(f"  {rgn:15s}: {len(grp):6d} units | Lon: [{b[0]:.2f}, {b[2]:.2f}] | Lat: [{b[1]:.2f}, {b[3]:.2f}]")

print(f"\nWriting to {gpkg_curr_path}...")
pyogrio.write_dataframe(final_gdf, gpkg_curr_path, layer='lithos_all_slope_units_final', driver='GPKG')
print("SUCCESS! Completed gapless GPKG update!")
