import geopandas as gpd
import pandas as pd
import shutil
import os

gpkg_curr_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../lithos_all_slope_units_final.gpkg"))
gpkg_backup_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../lithos_all_slope_units_final.backup.gpkg"))
gpkg_ne_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../colab files/SIH_NEW_INTRIGATION/result/lithos_all_ne_slope_units_final (2).gpkg"))


print("Creating backup of current GPKG...")
if not os.path.exists(gpkg_backup_path):
    shutil.copyfile(gpkg_curr_path, gpkg_backup_path)

print("Loading current GPKG...")
g_curr = gpd.read_file(gpkg_curr_path)

print("Loading full NE GPKG...")
g_ne = gpd.read_file(gpkg_ne_path)

# Map G2 region names to LITHOS region keys
region_key_map = {
    'arunachal_pradesh': 'arunachal_w',
    'meghalaya': 'cherrapunji',
    'manipur': 'manipur_nh2',
    'nagaland': 'nagaland',
    'assam': 'assam_hills',
    'mizoram': 'mizoram',
    'tripura': 'tripura',
    'sikkim': 'sikkim'
}

g_ne['region'] = g_ne['region'].map(lambda r: region_key_map.get(r, r))

# For Arunachal Pradesh: combine existing western slope units with full state slope units
arun_west = g_curr[g_curr['region'] == 'arunachal_w']
arun_east = g_ne[g_ne['region'] == 'arunachal_w']
print(f"Arunachal: {len(arun_west)} west units + {len(arun_east)} east units")
arun_full = pd.concat([arun_west, arun_east], ignore_index=True)
arun_full_gdf = gpd.GeoDataFrame(arun_full, crs=g_curr.crs)

# Keep Sikkim from current (1,835 high-res glacial slope units)
sikkim_gdf = g_curr[g_curr['region'] == 'sikkim']

# For Meghalaya, Manipur, Nagaland, Assam, Mizoram, Tripura: use the comprehensive NE units
other_regions = ['cherrapunji', 'manipur_nh2', 'nagaland', 'assam_hills', 'mizoram', 'tripura']
ne_others = g_ne[g_ne['region'].isin(other_regions)]

# Also preserve Wayanad, Idukki, Munnar from current if present
legacy = g_curr[g_curr['region'].isin(['wayanad', 'idukki', 'munnar'])]

merged_gdf = pd.concat([sikkim_gdf, arun_full_gdf, ne_others, legacy], ignore_index=True)
merged_gdf = gpd.GeoDataFrame(merged_gdf, crs=g_curr.crs)

# Drop duplicate geometries if any
merged_gdf = merged_gdf.drop_duplicates(subset=['region', 'center_lat', 'center_lon'])

print("\n--- MERGED GPKG SUMMARY ---")
print("Total slope units:", len(merged_gdf))
for rgn, grp in merged_gdf.groupby('region'):
    b = grp.total_bounds
    print(f"  {rgn}: {len(grp)} units, bounds: [{b[0]:.2f}, {b[1]:.2f}, {b[2]:.2f}, {b[3]:.2f}]")

print("\nSaving to:", gpkg_curr_path)
merged_gdf.to_file(gpkg_curr_path, driver="GPKG")
print("SUCCESS: Exported full zero-gap coverage to lithos_all_slope_units_final.gpkg!")
