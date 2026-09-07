import zipfile, os, glob

base = r'C:\Users\souga\OneDrive\Desktop\LITHOS\colab files'

zips = {
    'pre':  r'Phase2_data\sentinel2_pre_monsoon\S2B_MSIL1C_20220428T041539_N0510_R090_T46RDN_20240606T102028.SAFE.zip',
    'peak': r'Phase2_data\sentinel2_peak_monsoon\S2B_MSIL1C_20220819T042709_N0510_R133_T46RCP_20240718T115954.SAFE.zip',
    'post': r'Phase2_data\sentinel2_post_monsoon\S2A_MSIL1C_20221129T042131_N0510_R090_T46RDP_20240730T152504.SAFE.zip',
}

for season, zpath in zips.items():
    full_zip = os.path.join(base, zpath)
    out_dir  = os.path.join(base, f'Phase2_data\sentinel2_{season}_bands')
    os.makedirs(out_dir, exist_ok=True)

    print(f'Extracting {season}...')
    with zipfile.ZipFile(full_zip, 'r') as z:
        # Only extract B04 and B08 (Red + NIR for NDVI)
        # Ignore everything else to save space
        extracted = 0
        for name in z.namelist():
            if ('B04_10m.jp2' in name or
                'B08_10m.jp2' in name or
                'B04.jp2'     in name or
                'B08.jp2'     in name):
                z.extract(name, out_dir)
                size = z.getinfo(name).file_size // (1024*1024)
                print(f'  extracted: {os.path.basename(name)} ({size}MB)')
                extracted += 1
        print(f'  {extracted} band files extracted\n')

print('Done! Band files ready for deformation script.')
