import time
start = time.time()
print("Starting mock_data second import...")
import mock_data
print(f"Loaded from cache! Time taken: {time.time() - start:.2f} seconds")
