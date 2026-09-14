import pyogrio
import geopandas as gpd
import pandas as pd
import numpy as np

gpkg_curr = r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.gpkg'
gpkg_r2   = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\final r2\lithos_all_ne_slope_units_final (2).gpkg'

print('--- CURRENT GPKG COVERAGE ---')
curr = pyogrio.read_dataframe(gpkg_curr, columns=['region', 'center_lat', 'center_lon'])
for rgn, grp in curr.groupby('region'):
    print(f"{rgn:15s}: {len(grp):6d} units | Lon: [{grp.center_lon.min():.2f}, {grp.center_lon.max():.2f}] | Lat: [{grp.center_lat.min():.2f}, {grp.center_lat.max():.2f}]")

print('\n--- COLAB R2 GPKG COVERAGE ---')
r2 = pyogrio.read_dataframe(gpkg_r2, columns=['region', 'center_lat', 'center_lon'])
for rgn, grp in r2.groupby('region'):
    print(f"{rgn:18s}: {len(grp):6d} units | Lon: [{grp.center_lon.min():.2f}, {grp.center_lon.max():.2f}] | Lat: [{grp.center_lat.min():.2f}, {grp.center_lat.max():.2f}]")
