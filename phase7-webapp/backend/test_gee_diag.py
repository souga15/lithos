import os
import json
import ee

CREDENTIAL_FILE = "gee_credentials.json"
PROJECT_ID = "sougata-489719"

def test_gee():
    print(f"Testing GEE with Project: {PROJECT_ID}")
    if not os.path.exists(CREDENTIAL_FILE):
        print("Error: gee_credentials.json not found in current directory.")
        return

    try:
        with open(CREDENTIAL_FILE, 'r') as f:
            creds_data = json.load(f)
            email = creds_data.get('client_email')
            print(f"Service Account Email: {email}")

        credentials = ee.ServiceAccountCredentials(email, CREDENTIAL_FILE)
        ee.Initialize(credentials, project=PROJECT_ID)
        print("SUCCESS: GEE Initialized!")
        
        # Test a simple query
        print("Testing simple query (S1 collection size)...")
        size = ee.ImageCollection('COPERNICUS/S1_GRD').limit(1).size().getInfo()
        print(f"Collection size check OK. Image count in limit(1): {size}")

    except Exception as e:
        print("\n!!! GEE INITIALIZATION FAILED !!!")
        print(f"Error Details: {e}")
        print("\nPossible Causes:")
        print("1. Earth Engine API is NOT enabled for project 'sougata-489719'.")
        print("2. The Service Account does not have 'Earth Engine Resource Viewer' permissions.")
        print("3. The project ID in gee_service.py is incorrect.")

if __name__ == "__main__":
    test_gee()
