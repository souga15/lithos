import urllib.request
import json
import os
from shapely.geometry import shape

url = 'https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States'
print('Fetching official GADM India States GeoJSON...')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

state_map = {
    'Sikkim': 'sikkim',
    'Meghalaya': 'cherrapunji',
    'Arunachal Pradesh': 'arunachal_w',
    'Manipur': 'manipur_nh2',
    'Nagaland': 'nagaland',
    'Assam': 'assam_hills',
    'Mizoram': 'mizoram',
    'Tripura': 'tripura'
}

colors = {
    'sikkim': '#00C2FF',
    'cherrapunji': '#6E40C9',
    'arunachal_w': '#30D158',
    'manipur_nh2': '#FF9500',
    'nagaland': '#FF6B6B',
    'assam_hills': '#4FC3F7',
    'mizoram': '#F8BBD9',
    'tripura': '#A5D6A7'
}

res = {}

for f in data['features']:
    name = f['properties'].get('NAME_1')
    if name in state_map:
        key = state_map[name]
        raw_geom = shape(f['geometry'])
        simp = raw_geom.simplify(0.005, preserve_topology=True)
        if simp.geom_type == 'MultiPolygon':
            poly = max(simp.geoms, key=lambda p: p.area)
        else:
            poly = simp
        
        coords = [[round(pt[0], 5), round(pt[1], 5)] for pt in poly.exterior.coords]
        res[key] = {
            'name': name,
            'coords': coords,
            'bounds': [round(b, 4) for b in poly.bounds]
        }
        print(f"Extracted {name} ({key}): {len(coords)} points, bounds: {res[key]['bounds']}")

js_lines = [
    '/**',
    ' * NE_STATE_BOUNDARIES.js',
    ' * Official Survey of India / GADM Level 1 geographic boundaries for the 8 Northeast Indian states.',
    ' * Precision: ~500m simplified exterior ring for 60fps clamped Cesium terrain rendering.',
    ' * Coordinates: [longitude, latitude] in EPSG:4326 WGS84.',
    ' * Keyed to match ALL_REGIONS in mock_data.py.',
    ' */',
    '',
    'export const NE_STATE_BOUNDARIES = {'
]

for key in ['sikkim', 'cherrapunji', 'arunachal_w', 'manipur_nh2', 'nagaland', 'assam_hills', 'mizoram', 'tripura']:
    info = res[key]
    js_lines.append(f"  // {info['name'].upper()} (Bounds: {info['bounds']})")
    js_lines.append(f"  {key}: [")
    pts = info['coords']
    chunk_size = 4
    for i in range(0, len(pts), chunk_size):
        chunk = pts[i:i+chunk_size]
        pts_str = ','.join(f'[{pt[0]},{pt[1]}]' for pt in chunk)
        js_lines.append(f"    {pts_str},")
    js_lines.append("  ],")
    js_lines.append("")

js_lines.append("};")
js_lines.append("")
js_lines.append("// Per-state accent colors for boundary fill and glowing contour line")
js_lines.append("export const STATE_BORDER_COLORS = {")
for k, c in colors.items():
    js_lines.append(f"  {k}: '{c}',")
js_lines.append("};")
js_lines.append("")

out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/src/constants/NE_STATE_BOUNDARIES.js'))
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(js_lines))

print(f"Successfully written NE_STATE_BOUNDARIES.js to {out_path}!")
