from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
import json
import os
import uvicorn

app = FastAPI(title="NetPulse Automation Core | Admin Dashboard")

# Setup templates directory
templates = Jinja2Templates(directory="templates")

STATS_FILE = "staff_stats.json"

def load_performance_data():
    """Reads the JSON stats file populated by the Discord bot."""
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

@app.get("/", response_class=HTMLResponse)
async def render_dashboard(request: Request):
    staff_data = load_performance_data()
    
    # Parsing charts data structurally for Chart.js configuration
    names = []
    ticket_counts = []
    avg_ratings = []
    
    for staff_id, data in staff_data.items():
        names.append(f"Admin ({staff_id[-4:]})") # Displays last 4 digits for sleek look
        ticket_counts.append(data.get("tickets_handled", 0))
        
        # Prevent division by zero
        total_tickets = max(1, data.get("tickets_handled", 0))
        avg_stars = round(data.get("total_stars", 0) / total_tickets, 2)
        avg_ratings.append(avg_stars)

    # Updated: Added 'channel_id' to match the dynamic URLs needed for transcripts
    live_tickets = [
        {"channel_id": "123456789012345678", "channel_name": "ticket-mohammed", "user": "Mohammed", "status": "Claimed", "sla": "Optimal"},
        {"channel_id": "876543210987654321", "channel_name": "ticket-shadow", "user": "ShadowMC", "status": "Waiting", "sla": "Breached (3m+)"}
    ]

    return templates.TemplateResponse("index.html", {
        "request": request,
        "names": json.dumps(names),
        "ticket_counts": json.dumps(ticket_counts),
        "avg_ratings": json.dumps(avg_ratings),
        "live_tickets": live_tickets,
        "total_staff": len(staff_data)
    })

@app.get("/transcript/{channel_id}", response_class=HTMLResponse)
async def view_transcript(channel_id: str, request: Request):
    """Reads the archived ticket JSON and passes it to a cinematic web layout."""
    file_path = f"transcripts/{channel_id}.json"
    
    if not os.path.exists(file_path):
        return HTMLResponse(content="<h1 style='color:white; background:#030712; text-align:center; padding:50px;'>❌ Transcript Record Expired or Not Found</h1>", status_code=404)
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            transcript_content = json.load(f)
    except Exception:
        return HTMLResponse(content="<h1 style='color:white; background:#030712; text-align:center; padding:50px;'>❌ Failed to parse corrupt transcript asset</h1>", status_code=500)
        
    return templates.TemplateResponse("transcript.html", {
        "request": request,
        "data": transcript_content,
        "channel_id": channel_id
    })

@app.get("/transcript/{channel_id}/download")
async def download_raw_json(channel_id: str):
    """Enables one-click secure direct downloads of the raw chat log."""
    file_path = f"transcripts/{channel_id}.json"
    if not os.path.exists(file_path):
        return {"error": "Requested file asset does not exist on core cluster."}
        
    return FileResponse(file_path, filename=f"transcript-{channel_id}.json", media_type="application/json")

if __name__ == "__main__":
    # Corrected: Module resolution string changed from "dashboard.py:app" to "dashboard:app"
    uvicorn.run("dashboard:app", host="0.0.0.0", port=8000, reload=True)
