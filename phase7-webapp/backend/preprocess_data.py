import pandas as pd
import os
import json

DATA_DIR = "c:/Users/souga/OneDrive/Desktop/LITHOS/phase7-webapp/backend/data/landslides/"
OUTPUT_FILE = "c:/Users/souga/OneDrive/Desktop/LITHOS/phase7-webapp/backend/data/processed_landslides.json"

def preprocess_csvs():
    all_landslides = []
    
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".csv")]
    print(f"📂 Found {len(files)} landslide datasets.")
    
    for file in files:
        path = os.path.join(DATA_DIR, file)
        try:
            df = pd.read_csv(path, low_memory=False)
            # Filter for rows with lat/lon
            df = df.dropna(subset=['latitude', 'longitude'])
            
            for _, row in df.iterrows():
                # Extract core features
                all_landslides.append({
                    "lat": float(row['latitude']),
                    "lon": float(row['longitude']),
                    "date": str(row.get('event_date', 'unknown')),
                    "trigger": str(row.get('landslide_trigger', 'unknown')),
                    "source": file
                })
        except Exception as e:
            print(f"⚠️ Error processing {file}: {e}")

    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_landslides, f, indent=2)
    
    print(f"✅ Preprocessed {len(all_landslides)} historical events into {OUTPUT_FILE}")

if __name__ == "__main__":
    preprocess_csvs()
