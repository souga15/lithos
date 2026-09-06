import time

start = time.time()
print("Starting mock_data import...")
import mock_data
print(f"Loaded! Time taken: {time.time() - start:.2f} seconds")

# Force save any remaining dirty deformation cache just in case
from deformation_service import DeformationService
import json
ds = mock_data.deformation_service
if ds.cache_dirty > 0:
    with open("deform_cache.json", "w") as f:
        json.dump(ds.cache, f)
    print("Flushed remaining deformation cache to disk.")
