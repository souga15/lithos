try:
    import ee
    _HAS_EE = True
except ImportError:
    ee = None
    _HAS_EE = False
import os
import json
from datetime import datetime, timedelta


# Config paths
CREDENTIAL_FILE = os.path.join(os.path.dirname(__file__), "gee_credentials.json")

class GEEService:
    def __init__(self):
        self.initialized = False
        self.project_id = "sougata-489719"

    def _initialize(self):
        """Authenticates with GEE using Service Account JSON."""
        if not os.path.exists(CREDENTIAL_FILE):
            print(f"[GEE] Credentials file missing: {CREDENTIAL_FILE}")
            return False

        try:
            with open(CREDENTIAL_FILE, 'r') as f:
                creds_data = json.load(f)
                email = creds_data.get('client_email')
            
            credentials = ee.ServiceAccountCredentials(email, CREDENTIAL_FILE)
            ee.Initialize(credentials, project=self.project_id)
            print(f"[GEE] Successfully authenticated as {email}")
            self.initialized = True
            return True
        except Exception as e:
            print("\n" + "="*50)
            print("!!! GOOGLE EARTH ENGINE AUTHENTICATION FAILED !!!")
            print(f"Details: {e}")
            print("\nTo fix this, please ensure:")
            print(f"1. Service Account '{email}' is registered at: https://signup.earthengine.google.com/#!/service_accounts")
            print(f"2. Earth Engine API is ENABLED for project '{self.project_id}'")
            print(f"3. Service Account has 'Earth Engine Resource Viewer' role in IAM.")
            print("="*50 + "\n")
            return False

    def get_latest_sar_stats(self, bbox, days=15):
        """
        Calculates mean VV backscatter for a given bounding box.
        bbox: [lon_min, lat_min, lon_max, lat_max]
        """
        if not self.initialized and not self._initialize():
            return None

        try:
            region = ee.Geometry.Rectangle(bbox)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                             .filterBounds(region)
                             .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
                             .filter(ee.Filter.eq('instrumentMode', 'IW'))
                             .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                             .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))) # Consistent orbit

            if s1_collection.size().getInfo() == 0:
                return None

            # Get the most recent image
            latest_image = s1_collection.sort('system:time_start', False).first()
            
            # Reduce region to get mean backscatter value
            stats = latest_image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=100, # 100m scale for fast regional stats
                maxPixels=1e9
            ).getInfo()

            vv_mean = stats.get('VV')
            return {
                "vv_mean_db": round(vv_mean, 2) if vv_mean is not None else None,
                "timestamp": latest_image.get('system:time_start').getInfo(),
                "sensor": "Sentinel-1 SAR GRD"
            }
        except Exception as e:
            print(f"[GEE] Error fetching stats: {e}")
            return None

# Singleton
gee_service = GEEService()
