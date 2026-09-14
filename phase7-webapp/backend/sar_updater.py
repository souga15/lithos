import os
import requests
import shutil
import time
from datetime import datetime, timedelta
from gee_service import gee_service, ee
import mock_data
from deformation_service import deformation_service

# Base directory for SAR files
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "sar")
os.makedirs(BASE_DATA_DIR, exist_ok=True)

def fetch_region_sar(region_key, bbox, output_dir):
    """
    Downloads latest Sentinel-1 GRD VV imagery for a specific region.
    """
    print(f"[{region_key}] Fetching latest SAR imagery...")
    
    region = ee.Geometry.Rectangle(bbox)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=15)
    
    s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                     .filterBounds(region)
                     .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
                     .filter(ee.Filter.eq('instrumentMode', 'IW'))
                     .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')))
                     
    if s1_collection.size().getInfo() == 0:
        print(f"[{region_key}] No Sentinel-1 images found in the last 15 days.")
        return False
        
    latest_image = s1_collection.sort('system:time_start', False).first()
    vv_image = latest_image.select('VV')
    
    # Download at 500m resolution to ensure it fits the 50MB sync limit
    try:
        url = vv_image.getDownloadURL({
            'scale': 500,
            'crs': 'EPSG:4326',
            'region': region,
            'format': 'GEO_TIFF'
        })
        
        output_path = os.path.join(output_dir, f"{region_key}_latest.tif")
        prev_path = os.path.join(output_dir, f"{region_key}_previous.tif")
        
        # Shift existing latest to previous
        if os.path.exists(output_path):
            # Gracefully release handles perfectly in-time
            deformation_service.close_all_sources()
            try:
                if os.path.exists(prev_path): os.remove(prev_path)
                shutil.move(output_path, prev_path)
                print(f"[{region_key}] Shifted old latest to previous baseline.")
            except Exception as e:
                print(f"[{region_key}] Could not shift baseline due to file lock: {e}")

        response = requests.get(url, stream=True)
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=1024*1024):
                    if chunk: f.write(chunk)
            print(f"[{region_key}] Downloaded fresh SAR to {output_path}")
            return output_path
        else:
            print(f"[{region_key}] Download failed. HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"[{region_key}] GEE Export Error: {e}")
        return False

def run_global_update():
    """Loops through all 9 regions and updates their SAR imagery if needed."""
    if not gee_service.initialized:
        gee_service._initialize()
    if not gee_service.initialized:
        print("[SAR Updater] GEE Service not initialized. Skipping.")
        return

    for region_key, info in mock_data.ALL_REGIONS.items():
        bbox = list(info["bbox"]) # [lon_min, lat_min, lon_max, lat_max]
        
        # In GEE Rectangle expects [minLon, minLat, maxLon, maxLat]
        fetch_region_sar(region_key, bbox, BASE_DATA_DIR)
        
        # Small delay to avoid hitting Google quotas too hard
        time.sleep(2)

async def run_updater_loop():
    """Persistent background task for FastAPI lifespan."""
    print("[SAR Updater] Background satellite sync loop started.")
    import asyncio
    await asyncio.sleep(10)
    while True:
        try:
            await asyncio.to_thread(run_global_update)
        except Exception as e:
            print(f"[SAR Updater] Loop error: {e}")
        
        # Update once every 24 hours (satellite passes aren't more frequent than ~6 days anyway)
        await asyncio.sleep(60 * 60 * 24)

if __name__ == "__main__":
    print("=========================================")
    print("  LITHOS: Mult-Region SAR Satellite Sync ")
    print("=========================================")
    run_global_update()
    print("Done.")

