import os
import sys
import uvicorn
import main

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting LITHOS FastAPI server on http://0.0.0.0:{port} (PORT={port}) ...", flush=True)
    uvicorn.run(main.app, host="0.0.0.0", port=port, reload=False)
