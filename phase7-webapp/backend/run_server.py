import sys
import uvicorn

if __name__ == "__main__":
    print("[SERVER] Starting uvicorn server directly with unbuffered logs...", flush=True)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="info")
