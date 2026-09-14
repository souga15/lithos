import pyogrio
import pandas as pd

path_r2 = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\final r2\lithos_all_ne_slope_units_final (2).gpkg'
df = pyogrio.read_dataframe(path_r2, layer='lithos_all_ne_slope_units_final', columns=['region', 'center_lat', 'center_lon'])
print('Total units:', len(df))
arun = df[df['region'] == 'arunachal_pradesh']
print('Arunachal units count:', len(arun))
print('Lon min/max:', arun['center_lon'].min(), arun['center_lon'].max())
print('Lat min/max:', arun['center_lat'].min(), arun['center_lat'].max())

central = arun[(arun['center_lon'] >= 93.0) & (arun['center_lon'] <= 95.0)]
print('Central Arunachal (lon 93.0-95.0) count:', len(central))

# Also check distribution across longitude bins (91.5 to 97.5 by 0.5 degrees)
import numpy as np
bins = np.arange(91.5, 98.0, 0.5)
counts, _ = np.histogram(arun['center_lon'], bins=bins)
for b0, b1, c in zip(bins[:-1], bins[1:], counts):
    print(f'Lon {b0:.1f} - {b1:.1f} : {c:6d} units')
