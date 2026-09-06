import time
from mock_data import ALL_REGIONS, generate_cells

print("Testing generate_cells overhead")

start_all = time.time()
for k in ALL_REGIONS:
    start = time.time()
    generate_cells(k)
    print(f"Region {k} took: {time.time() - start:.2f} seconds")
    
print(f"Total time: {time.time() - start_all:.2f} seconds")
