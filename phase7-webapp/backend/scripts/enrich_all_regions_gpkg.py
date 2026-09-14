import pandas as pd
import geopandas as gpd
import numpy as np
import pyogrio
import os
import shutil
from scipy.spatial import cKDTree

gpkg_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.gpkg')
csv_path = os.path.abspath(r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\units_enriched.csv')

print("1. Loading units_enriched.csv (all Northeast states)...")
csv = pd.read_csv(csv_path)

print("2. Reading current GPKG...")
gpkg = gpd.read_file(gpkg_path)
print(f"Current total units: {len(gpkg)}")

region_map = {
    'cherrapunji': 'meghalaya',
    'assam_hills': 'assam',
    'manipur_nh2': 'manipur',
    'nagaland': 'nagaland',
    'mizoram': 'mizoram',
    'sikkim': 'sikkim',
    'tripura': 'tripura',
    'arunachal_w': 'arunachal_pradesh'
}

updated_subgdfs = []
for rgn, grp in gpkg.groupby('region'):
    if rgn in region_map:
        csv_rgn = region_map[rgn]
        sub_csv = csv[csv['region'] == csv_rgn].reset_index(drop=True)
        tree = cKDTree(sub_csv[['center_lat', 'center_lon']].values)
        dists, idxs = tree.query(grp[['center_lat', 'center_lon']].values, k=1)
        
        matched_rows = sub_csv.iloc[idxs].reset_index(drop=True)
        grp = grp.copy().reset_index(drop=True)
        grp['fos'] = matched_rows['fos'].values
        grp['risk_level'] = matched_rows['risk_level'].values
        grp['pred_probability'] = matched_rows['pred_probability'].values
        print(f"Enriched {rgn} ({len(grp)} units) from {csv_rgn}:")
        print(grp['risk_level'].value_counts())
    else:
        print(f"Preserving existing {rgn} ({len(grp)} units)")
    updated_subgdfs.append(grp)

final_gdf = pd.concat(updated_subgdfs, ignore_index=True)
final_gdf = gpd.GeoDataFrame(final_gdf, crs=gpkg.crs)

print(f"\nTotal units in enriched GPKG: {len(final_gdf)}")
print(f"Writing to {gpkg_path}...")
pyogrio.write_dataframe(final_gdf, gpkg_path, layer='lithos_all_slope_units_final', driver='GPKG')
print("SUCCESS: All Northeast regions successfully enriched with authentic Colab ground truth!")
