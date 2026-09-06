import sys
import uvicorn
import main

if __name__ == "__main__":
    print("Starting LITHOS FastAPI server on http://0.0.0.0:8000 (accessible locally and across network) ...", flush=True)
    uvicorn.run(main.app, host="0.0.0.0", port=8000, reload=False)

