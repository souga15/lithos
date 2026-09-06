
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from mock_data import CELLS

region = 'cherrapunji'
cells = CELLS[region]
if cells:
    print(f"Cell properties for {cells[0]['cell_id']}:")
    for k, v in cells[0].items():
        if k != 'polygon':
            print(f"  {k}: {v}")
else:
    print("No cells found for region.")
