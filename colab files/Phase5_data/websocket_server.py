
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import sqlite3, pandas as pd
from datetime import datetime
from typing import List

app = FastAPI(title="LITHOS Alert API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                  allow_methods=["*"], allow_headers=["*"])
DB_PATH = "lithos_alerts.db"

class ConnectionManager:
    def __init__(self): self.active: List[WebSocket] = []
    async def connect(self, ws):
        await ws.accept(); self.active.append(ws)
    def disconnect(self, ws):
        if ws in self.active: self.active.remove(ws)
    async def broadcast(self, msg: dict):
        dead = []
        for ws in self.active:
            try: await ws.send_json(msg)
            except: dead.append(ws)
        for ws in dead: self.active.remove(ws)

manager = ConnectionManager()

@app.get("/")
def root(): return {"status": "LITHOS running"}

@app.get("/alerts")
def get_alerts(region: str = None, limit: int = 100):
    conn  = sqlite3.connect(DB_PATH)
    query = "SELECT * FROM alerts"
    if region: query += f" WHERE region = '{region}'"
    query += f" ORDER BY timestamp DESC LIMIT {limit}"
    df = pd.read_sql(query, conn); conn.close()
    return {"alerts": df.to_dict("records"), "count": len(df)}

@app.get("/snapshots")
def get_snapshots():
    conn = sqlite3.connect(DB_PATH)
    df   = pd.read_sql(
        "SELECT region,timestamp,red_count,orange_count,green_count,max_score,avg_score"
        " FROM risk_snapshots GROUP BY region ORDER BY timestamp DESC", conn)
    conn.close()
    return {"snapshots": df.to_dict("records")}

@app.get("/risk-grid")
def get_risk_grid():
    conn = sqlite3.connect(DB_PATH)
    df   = pd.read_sql("""
        SELECT r.* FROM risk_snapshots r
        INNER JOIN (
            SELECT region, MAX(timestamp) ts FROM risk_snapshots GROUP BY region
        ) l ON r.region=l.region AND r.timestamp=l.ts""", conn)
    conn.close()
    return {"grid": df.to_dict("records")}

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        conn  = sqlite3.connect(DB_PATH)
        recent= pd.read_sql(
            "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10", conn
        ).to_dict("records")
        conn.close()
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "LITHOS Alert Stream connected",
            "timestamp": datetime.now().isoformat(),
            "recent_alerts": recent
        })
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def push_alert(alert: dict):
    await manager.broadcast({
        "type": "NEW_ALERT",
        "timestamp": datetime.now().isoformat(),
        "alert": alert
    })
