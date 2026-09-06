# LITHOS Regional Geospatial Data Access Guide

Due to GitHub's 100MB per-file limit, large raw geospatial datasets (>100MB) are hosted externally on institutional Google Drive mirrors and high-performance cloud storage.

---

## 📦 Large Datasets Overview

| File Name | File Size | Description | Included in Repo? |
| :--- | :--- | :--- | :---: |
| **`lithos_all_ne_slope_units_final.gpkg`** | 1.71 GB | Full OGC GeoPackage containing 580,508 vector slope unit polygons across 8 Northeast Indian states with complete DEM attributes. | Excluded (Cloud Mirror) |
| **`units_enriched.csv`** | 156.1 MB | Full tabular dataset with all 580,508 slope units enriched with real PINN failure probabilities and MC Dropout epistemic uncertainties. | Excluded (Cloud Mirror) |
| **`pinn_model_v2 (2).pth`** | 340 KB | Trained PyTorch weights for Phase 11 ResNet PINN architecture (79,169 parameters). | **Included in Repo** ✅ |
| **`priority_survey_sites.csv`** | 14 KB | Top 100 prioritized exploration targets ranked by $PSI = \hat{p} \times \sigma$ with IS 14680:1999 recommendations. | **Included in Repo** ✅ |
| **`Fig_Journal_Evaluation.png` / `.pdf`** | 806 KB | 300 DPI high-resolution multi-panel benchmark figure. | **Included in Repo** ✅ |

---

## 📥 How to Download Full Datasets for Local Research

If you are running large-scale spatial queries or retraining the full 8-state model:

### 1. Google Drive Mirror
The complete dataset checkpoint folder is available on Google Drive:
- **Folder Path:** `/LITHOS/Phase11_data/`
- **Files Included:**
  - `units_attributes.csv` (118 MB)
  - `features.npz` (Precomputed 9-feature array for 28,722 training units)
  - `lithos_all_ne_slope_units_final.gpkg` (1.71 GB)
  - `units_enriched.csv` (156.1 MB)

### 2. Automated Python Download Script (Optional)
You can download files directly from Google Drive using `gdown`:
```bash
pip install gdown

# Download the enriched units CSV into the backend directory
# gdown --id <DRIVE_FILE_ID> -O phase7-webapp/backend/units_enriched.csv
```

---

## 🚀 Running the WebApp Without Large Files

The web application (`phase7-webapp`) includes pre-cached regional bounding boxes and GeoJSON grids for **Sikkim, Arunachal Pradesh, Meghalaya, Manipur, and Nagaland**, allowing the 3D Cesium Digital Twin and 2D swipe maps to function out of the box without requiring the 1.7GB GeoPackage download.
