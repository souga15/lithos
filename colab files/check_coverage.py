# check_coverage.py
import glob, os
import rasterio

base = r'C:\Users\souga\OneDrive\Desktop\LITHOS\colab files\Phase2_data'

print('=== SENTINEL-2 TILE COVERAGE ===\n')

for season in ['pre', 'peak', 'post']:
    folder = os.path.join(base, f'sentinel2_{season}_bands')
    b4_files = glob.glob(f'{folder}/**/*B04*.jp2', recursive=True)
    
    for f in b4_files:
        if 'MSK' in f:
            continue
        with rasterio.open(f) as src:
            bounds = src.bounds
            crs    = src.crs
            
            # Convert bounds to lat/lon
            from rasterio.warp import transform_bounds
            wgs84 = transform_bounds(crs, 'EPSG:4326', *bounds)
            
            print(f'Season: {season}')
            print(f'  File:  {os.path.basename(f)}')
            print(f'  CRS:   {crs}')
            print(f'  Bounds (lat/lon):')
            print(f'    South: {wgs84[1]:.4f}')
            print(f'    North: {wgs84[3]:.4f}')
            print(f'    West:  {wgs84[0]:.4f}')
            print(f'    East:  {wgs84[2]:.4f}')
            print()