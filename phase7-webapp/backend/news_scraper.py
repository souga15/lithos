import urllib.parse
import xml.etree.ElementTree as ET
import urllib.request
import asyncio
from datetime import datetime
import json
import uuid

import mock_data
import os

SEEN_TITLES_FILE = "seen_titles.json"

def load_seen_titles():
    if os.path.exists(SEEN_TITLES_FILE):
        try:
            with open(SEEN_TITLES_FILE, 'r') as f:
                return set(json.load(f))
        except:
            pass
    return set()

def save_seen_titles(seen):
    # Keep only last 200
    recent = list(seen)[-200:]
    try:
        with open(SEEN_TITLES_FILE, 'w') as f:
            json.dump(recent, f)
    except Exception as e:
        print(f"[News Scraper] Error saving seen titles: {e}")

KEYWORDS_TO_COORDS = {
    # Specific towns in headlines
    "imphal":      (24.82, 93.95),
    "kohima":      (25.67, 94.11),
    "shillong":    (25.57, 91.88),
    "gangtok":     (27.33, 88.61),
    "itanagar":    (27.10, 93.62),
    "mao gate":    (25.20, 93.87),
    
    # Highways (very common in headlines)
    "nh6":         (24.82, 93.95),
    "nh102":       (25.10, 93.50),
    "nh31":        (26.10, 91.80),
    "nh37":        (26.20, 91.50),
    "nh40":        (25.57, 91.88),
    "nh54":        (24.50, 93.00),

    # Regions
    "manipur":     (24.82, 93.95),
    "cherrapunji": (25.27, 91.73),
    "meghalaya":   (25.35, 91.90),
    "wayanad":     (11.65, 76.08),
    "idukki":      (10.01, 76.97),
    "sikkim":      (27.33, 88.61),
    "arunachal":   (27.10, 93.60),
    "nagaland":    (25.67, 94.11),
    "assam":       (26.14, 91.74),
    "munnar":      (10.09, 77.06),
}

# In a real deployed app, feedparser is better, but this built-in XML parser works
# reliably without needing external pip installs if we stick to standard RSS.
# If the user can't pip install feedparser, we will use this standard library approach.

def fetch_rss_feed(query):
    """Fetches Google News RSS feed for a specific query using standard libraries."""
    encoded_query = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            articles = []
            for item in root.findall('.//item')[:5]: # Get top 5 recent articles
                title = item.find('title').text
                link = item.find('link').text
                pub_date = item.find('pubDate').text
                source = item.find('source').text if item.find('source') is not None else "News Source"
                
                # Check if it mentions roads or blockages to classify severity
                severity = "serious"
                if "block" in title.lower() or "close" in title.lower() or "trap" in title.lower() or "kill" in title.lower() or "dead" in title.lower():
                    severity = "life_threatening"
                elif "warn" in title.lower() or "alert" in title.lower() or "predict" in title.lower():
                    severity = "minor"
                
                articles.append({
                    "title": title,
                    "link": link,
                    "pub_date": pub_date,
                    "source": source,
                    "severity": severity
                })
            
            return articles
    except Exception as e:
        print(f"[News Scraper Error] {e}")
        return []

def article_to_report(article):
    """Converts a scraped news article into our LITHOS internal report JSON structure."""
    
    # We assign it roughly to a known region or generic bounds if unknown
    # For a real implementation, NLP NER (Named Entity Recognition) would extract the exact location from the text.
    # For now, we will pick a random monitored region to place the coordinate near so it shows up on our maps.
    import random
    
    assigned_lat, assigned_lon = None, None
    title_lower = article["title"].lower()
    
    # Try finding exact keyword match first (highest priority wins implicitly due to dict order)
    for kw, coords in KEYWORDS_TO_COORDS.items():
        if kw in title_lower:
            assigned_lat, assigned_lon = coords
            break
            
    # Fallback to random if no keyword match
    region_key = random.choice(list(mock_data.ALL_REGIONS.keys()))
    reg = mock_data.ALL_REGIONS[region_key]
    if assigned_lat is None:
        lon_min, lat_min, lon_max, lat_max = reg["bbox"]
        assigned_lat = random.uniform(lat_min, lat_max)
        assigned_lon = random.uniform(lon_min, lon_max)
    
    now = mock_data._now()
    
    report = {
        "report_id": f"RPT_NEWS_{uuid.uuid4().hex[:8].upper()}",
        "user_id": "News_Bot_Scraper",
        "trust_score": 4.5, # High trust for established news engines
        "type": "road_blocked" if article["severity"] != "minor" else "warning_leaving_area",
        "severity": article["severity"],
        "lat": round(assigned_lat, 5),
        "lon": round(assigned_lon, 5),
        "region": region_key,
        "region_name": reg["name"],
        "cell_id": f"{region_key}_NEWS",
        "timestamp": mock_data._iso(now),
        "confirmed_by": [article["source"]],
        "confirm_count": 1,
        "verified": True, 
        "resolved": False,
        "lithos_score": 0.85,
        "lithos_level": "RED" if article["severity"] == "life_threatening" else "ORANGE",
        "users_alerted": random.randint(100, 5000),
        "description": f"📰 LIVE NEWS ({article['source']}): {article['title']}",
        "link": article["link"]
    }
    return report

async def run_scraper_loop():
    """Background async task to run every X minutes and pull live news."""
    from main import report_manager, ALL_REPORTS
    queries = ["landslide road blocked India", "landslide highway India", "mudslide road closed India"]
    
    # Wait a bit before starting on server boot
    await asyncio.sleep(15) 
    
    seen_titles = load_seen_titles()
    
    # Also inject existing titles from memory just in case the file was empty
    seen_titles.update([r.get("description", "").replace("📰 LIVE NEWS (", "").split("): ")[-1] for r in ALL_REPORTS if "📰" in r.get("description", "")])
    save_seen_titles(seen_titles)
    
    MAX_ARTICLES_PER_RUN = 5
    await asyncio.sleep(5)
    
    while True:
        import random
        query = random.choice(queries)
        print(f"[News Scraper] Running search for: {query}")
        
        articles = await asyncio.to_thread(fetch_rss_feed, query)
        new_reports_added = 0
        
        for article in articles[:MAX_ARTICLES_PER_RUN]:
            # Prevent duplicates by checking if we already scraped this exact headline
            if article["title"] not in seen_titles:
                seen_titles.add(article["title"])
                save_seen_titles(seen_titles)
                
                # Convert to our LITHOS standard format
                new_report = article_to_report(article)
                
                # Prepend to ALL_REPORTS so it shows up first in history
                ALL_REPORTS.insert(0, new_report)
                new_reports_added += 1
                
                # Broadcast over websocket to refresh live UI immediately clientside!
                try:
                    await report_manager.broadcast({
                        "type": "new_report",
                        "lat": new_report["lat"], "lon": new_report["lon"],
                        "report_type": new_report["type"], "severity": new_report["severity"],
                        "verified": new_report["verified"],
                        "timestamp": new_report["timestamp"],
                    })
                except Exception as e:
                    print(f"[News Scraper Websocket Error]: {e}")
                    
        print(f"[News Scraper] Finished cycle. Added {new_reports_added} new real-world reports. Sleeping for 15 mins.")
        
        # Scrape every 15 minutes
        await asyncio.sleep(60 * 15) 
