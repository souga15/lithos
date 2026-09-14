# deformation_service.py

import numpy as np
import os
import json
import rasterio
from rasterio.windows import from_bounds
import warnings

class DeformationService:
    def __init__(self):
        self.base_data_dir = os.path.join(os.path.dirname(__file__), "data", "sar")
        self.sources = {} # {region_key: {"pre": src, "post": src, "bounds": bounds}}
        self.cache = {}
        self.cache_dirty = 0
        self.cache_path = os.path.join(os.path.dirname(__file__), "deform_cache.json")
        
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r") as f:
                    self.cache = json.load(f)
            except Exception:
                pass

    def _ensure_region_loaded(self, region_key):
        """Lazy loads SAR datasets for a specific region if they exist."""
        if region_key in self.sources:
            return True
            
        pre_path = os.path.join(self.base_data_dir, f"{region_key}_previous.tif")
        post_path = os.path.join(self.base_data_dir, f"{region_key}_latest.tif")
        
        if os.path.exists(pre_path) and os.path.exists(post_path):
            try:
                pre_src = rasterio.open(pre_path)
                post_src = rasterio.open(post_path)
                self.sources[region_key] = {
                    "pre": pre_src,
                    "post": post_src,
                    "bounds": pre_src.bounds
                }
                print(f"[SAR] Loaded SAR imagery for region: {region_key}")
                return True
            except Exception as e:
                print(f"[SAR] Error loading imagery for {region_key}: {e}")
                return False
    def close_all_sources(self):
        """Releases all file handles to allow file operations (like updates on Windows)."""
        for region in self.sources.values():
            try:
                region["pre"].close()
                region["post"].close()
            except: pass
        self.sources = {}
        print("[SAR] All file handles released for update.")

    def get_deformation_proxy(self, region_key, cell_lat, cell_lon):
        """
        Compute SAR backscatter change as deformation proxy for a specific region.
        """
        if not self._ensure_region_loaded(region_key):
            return {
                "backscatter_change_db": 0.0,
                "deformation_proxy":     0.0,
                "data_source":           "SAR not loaded",
                "note":                  f"Missing SAR TIFs for {region_key} in data/sar/"
            }

        # Check cache
        cache_key = f"{region_key}_{round(cell_lat,5)},{round(cell_lon,5)}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        region_data = self.sources[region_key]
        min_lon, min_lat, max_lon, max_lat = region_data["bounds"]
        
        if not (min_lon <= cell_lon <= max_lon and min_lat <= cell_lat <= max_lat):
            result = {
                "backscatter_change_db": 0.0,
                "deformation_proxy":     0.0,
                "data_source":           "Outside SAR extent",
                "note":                  "Point not covered by region's satellite pass"
            }
        else:
            result = self._compute_proxy(region_data, cell_lat, cell_lon)
        
        self.cache[cache_key] = result
        self.cache_dirty += 1
        if self.cache_dirty > 20000:
            self._save_cache()
            
        return result

    def _save_cache(self):
        try:
            with open(self.cache_path, "w") as f:
                json.dump(self.cache, f)
            self.cache_dirty = 0
        except: pass

    def _compute_proxy(self, region_data, cell_lat, cell_lon):
        pre_src = region_data["pre"]
        post_src = region_data["post"]

        try:
            buffer = 0.009  # ~1km window for higher precision calculation
            
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=RuntimeWarning)
                
                window_pre = from_bounds(
                    cell_lon - buffer, cell_lat - buffer,
                    cell_lon + buffer, cell_lat + buffer,
                    pre_src.transform
                )
                pre_data = pre_src.read(1, window=window_pre).astype(float)
                pre_data[pre_data <= 0] = np.nan
                
                window_post = from_bounds(
                    cell_lon - buffer, cell_lat - buffer,
                    cell_lon + buffer, cell_lat + buffer,
                    post_src.transform
                )
                post_data = post_src.read(1, window=window_post).astype(float)
                post_data[post_data <= 0] = np.nan

                if np.all(np.isnan(pre_data)) or np.all(np.isnan(post_data)):
                     return {"backscatter_change_db": 0.0, "deformation_proxy": 0.0, "data_source": "No Valid Pixels"}

                pre_mean = np.nanmean(pre_data)
                post_mean = np.nanmean(post_data)
                
                if pre_mean <= 0 or post_mean <= 0:
                     return {"backscatter_change_db": 0.0, "deformation_proxy": 0.0, "data_source": "Zero Value Error"}
                
                pre_db  = 10 * np.log10(pre_mean)
                post_db = 10 * np.log10(post_mean)
                change  = post_db - pre_db

                # Normalise to 0-1 proxy (3dB change = high risk)
                proxy = max(0.0, min(1.0, float(np.abs(change) / 3.0)))

                return {
                    "backscatter_change_db": round(float(change), 2),
                    "deformation_proxy":     round(proxy, 3),
                    "data_source":           "Sentinel-1 (Live GEE Sync)"
                }

        except Exception as e:
            return {"backscatter_change_db": 0.0, "deformation_proxy": 0.0, "data_source": "Rasterio error", "note": str(e)}

# Singleton instance
deformation_service = DeformationService()

