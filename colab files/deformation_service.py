# find_overlap.py
# Find the EXACT coordinates where pre + post tiles overlap
# Run this to get test points that will return real S2 NDVI

import glob, os
import rasterio
from rasterio.warp import transform_bounds

BASE = r'C:\Users\souga\OneDrive\Desktop\LITHOS\colab files\Phase2_data'

def get_bounds(season):
    folder = os.path.join(BASE, f'sentinel2_{season}_bands')
    files  = glob.glob(f'{folder}/**/*B04*.jp2', recursive=True)
    real   = [f for f in files if 'MSK' not in f]
    if not real:
        return None
    with rasterio.open(real[0]) as src:
        w = transform_bounds(src.crs, 'EPSG:4326', *src.bounds)
        return {'west': w[0], 'south': w[1], 'east': w[2], 'north': w[3]}

print('=== INDIVIDUAL TILE BOUNDS ===\n')
bounds = {}
for s in ['pre', 'peak', 'post']:
    b = get_bounds(s)
    bounds[s] = b
    print(f'{s:4}: {b["south"]:.4f}N – {b["north"]:.4f}N  |  {b["west"]:.4f}E – {b["east"]:.4f}E')

print('\n=== PRE + POST OVERLAP ===\n')
pre  = bounds['pre']
post = bounds['post']

overlap_south = max(pre['south'], post['south'])
overlap_north = min(pre['north'], post['north'])
overlap_west  = max(pre['west'],  post['west'])
overlap_east  = min(pre['east'],  post['east'])

if overlap_south < overlap_north and overlap_west < overlap_east:
    print(f'  Overlap exists!')
    print(f'  Lat: {overlap_south:.4f}N – {overlap_north:.4f}N')
    print(f'  Lon: {overlap_west:.4f}E  – {overlap_east:.4f}E')

    mid_lat = (overlap_south + overlap_north) / 2
    mid_lon = (overlap_west  + overlap_east)  / 2
    print(f'\n  Centre point: {mid_lat:.4f}N, {mid_lon:.4f}E')
    print(f'\n  Safe test points (2km buffer = 0.018 deg):')

    for i, (lat, lon) in enumerate([
        (overlap_south + 0.05, overlap_west  + 0.05),
        (mid_lat,              mid_lon             ),
        (overlap_north - 0.05, overlap_east  - 0.05),
    ]):
        if (lat - 0.018 >= overlap_south and
            lat + 0.018 <= overlap_north and
            lon - 0.018 >= overlap_west  and
            lon + 0.018 <= overlap_east):
            print(f'    Point {i+1}: ({lat:.4f}, {lon:.4f}) ✅ safe')
        else:
            print(f'    Point {i+1}: ({lat:.4f}, {lon:.4f}) ⚠️ too close to edge')
else:
    print('  ❌ NO OVERLAP between pre and post tiles!')
    print(f'  pre  ends at:   {pre["north"]:.4f}N')
    print(f'  post starts at: {post["south"]:.4f}N')
    print(f'  Gap: {post["south"] - pre["north"]:.4f} degrees')
    print()
    print('  This means we need to use pre vs PEAK instead.')
    print()

    print('=== PRE + PEAK OVERLAP ===\n')
    peak = bounds['peak']
    o_s = max(pre['south'],  peak['south'])
    o_n = min(pre['north'],  peak['north'])
    o_w = max(pre['west'],   peak['west'])
    o_e = min(pre['east'],   peak['east'])

    if o_s < o_n and o_w < o_e:
        mid_lat = (o_s + o_n) / 2
        mid_lon = (o_w + o_e) / 2
        print(f'  PRE+PEAK overlap:')
        print(f'  Lat: {o_s:.4f}N – {o_n:.4f}N')
        print(f'  Lon: {o_w:.4f}E  – {o_e:.4f}E')
        print(f'  Centre: {mid_lat:.4f}N, {mid_lon:.4f}E  ← use this for testing')
    else:
        print('  No pre+peak overlap either.')

    print('\n=== PEAK + POST OVERLAP ===\n')
    o_s = max(peak['south'], post['south'])
    o_n = min(peak['north'], post['north'])
    o_w = max(peak['west'],  post['west'])
    o_e = min(peak['east'],  post['east'])

    if o_s < o_n and o_w < o_e:
        mid_lat = (o_s + o_n) / 2
        mid_lon = (o_w + o_e) / 2
        print(f'  PEAK+POST overlap:')
        print(f'  Lat: {o_s:.4f}N – {o_n:.4f}N')
        print(f'  Lon: {o_w:.4f}E  – {o_e:.4f}E')
        print(f'  Centre: {mid_lat:.4f}N, {mid_lon:.4f}E  ← use this for testing')
    else:
        print('  No peak+post overlap either.')

print('\n=== RECOMMENDATION ===\n')
print('  Best pair for NDVI change = whichever two tiles overlap most.')
print('  Will update deformation_service.py to use that pair automatically.')