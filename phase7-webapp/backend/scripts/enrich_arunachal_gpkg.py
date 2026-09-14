import pandas as pd
import geopandas as gpd
import pyogrio
import os
import shutil

gpkg_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.gpkg')
csv_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\units_enriched.csv')

print("1. Loading units_enriched.csv for Arunachal Pradesh...")
csv = pd.read_csv(csv_path)
arun_csv = csv[csv['region'] == 'arunachal_pradesh'].copy()
arun_csv['key'] = arun_csv['center_lat'].round(4).astype(str) + '_' + arun_csv['center_lon'].round(4).astype(str)
arun_csv_dedup = arun_csv.drop_duplicates(subset=['key'])[['key', 'fos', 'risk_level', 'pred_probability']]
print(f"Colab Ground Truth: {len(arun_csv_dedup)} unique units.")
print(arun_csv_dedup['risk_level'].value_counts())

print("2. Reading current GPKG...")
gdf = gpd.read_file(gpkg_path)
arun_mask = gdf['region'] == 'arunachal_w'
arun_gpkg = gdf[arun_mask].copy()
other_gpkg = gdf[~arun_mask].copy()

print(f"Current Arunachal GPKG units: {len(arun_gpkg)}")
arun_gpkg['key'] = arun_gpkg['center_lat'].round(4).astype(str) + '_' + arun_gpkg['center_lon'].round(4).astype(str)

# Drop old uncalibrated columns and merge authentic Colab values
arun_merged = arun_gpkg.drop(columns=['fos', 'risk_level', 'pred_probability'], errors='ignore').merge(
    arun_csv_dedup, on='key', how='left'
)
arun_merged = arun_merged.drop(columns=['key'], errors='ignore')

print("\nEnriched Arunachal distribution:")
print(arun_merged['risk_level'].value_counts(dropna=False))
print("FoS statistics:")
print(arun_merged['fos'].describe())
print("Pred Probability statistics:")
print(arun_merged['pred_probability'].describe())

# Recombine with other regions
final_gdf = pd.concat([arun_merged, other_gpkg], ignore_index=True)
final_gdf = gpd.GeoDataFrame(final_gdf, crs=gdf.crs)

print(f"\nTotal units in final GPKG: {len(final_gdf)}")
print(f"Writing to {gpkg_path}...")
pyogrio.write_dataframe(final_gdf, gpkg_path, layer='lithos_all_slope_units_final', driver='GPKG')
print("SUCCESS: GPKG successfully enriched with authentic Colab ground truth!")
