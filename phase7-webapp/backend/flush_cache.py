import time
import json
import mock_data

print("Mock data loaded.")

ds = mock_data.deformation_service
if ds.cache_dirty > 0:
    with open("deform_cache.json", "w") as f:
        json.dump(ds.cache, f)
    print("Flushed remaining dirty items to deform_cache.json")
else:
    print("Cache was completely clean/committed.")
