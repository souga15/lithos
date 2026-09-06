# Real Seismic Landslide Model

This folder contains a fully separate hybrid-model project for landslide prediction with explicit earthquake and dry-soil shear-failure support.

It does not import or modify the existing `pinn_model.py`, `mock_data.py`, or any other production path in the current backend.

## Goal

Build a real-data-driven model that combines:

- empirical event learning from historical landslide records
- earthquake hazard inputs such as magnitude, distance, and shaking intensity
- slope stability mechanics for dry and wet soil conditions
- a hybrid fusion layer that explains whether rainfall, earthquake loading, or mixed forcing is dominant

## Planned Outputs

- `landslide_probability`
- `earthquake_triggered_probability`
- `dry_soil_shear_failure_probability`
- `dominant_trigger`
- `stability_margin`
- `critical_acceleration_g`
- `newmark_displacement_cm`

## Folder Layout

```text
real_seismic_landslide_model/
  configs/
  data/
    raw/
    interim/
    processed/
  models/
  notebooks/
  src/
    api/
    evaluation/
    features/
    ingest/
    models/
    physics/
  tests/
```

## Suggested Data Flow

1. Ingest local landslide records and earthquake catalogs.
2. Standardize event geometry, time, trigger labels, and location precision.
3. Build terrain, material, hydrologic, deformation, and seismic features.
4. Compute stability features including static FoS, pseudo-static FoS, critical acceleration, and Newmark displacement proxies.
5. Train a tabular event model on real records.
6. Fuse the learned probability with seismic stability outputs.
7. Validate with spatial and temporal holdout splits.

## Local Data References

The first version is expected to use these existing workspace files as inputs:

- `../data/processed_landslides.json`
- `../data/landslides/nasa_landslides.csv`
- `../data/landslides/kerala_landslides.csv`
- `../data/landslides/northeast_india_landslides.csv`
- `../data/sar/*.tif`

## Getting Started

1. Create a dedicated virtual environment for this folder.
2. Install `requirements.txt`.
3. Edit `configs/project_config.yaml` if file locations change.
4. Run the future dataset builder, trainer, and API entrypoint from this folder.

## Current Scaffold Status

The code in `src/` is a starter scaffold. It defines interfaces, data contracts, and simple placeholder logic so we can build the full pipeline incrementally without touching the old codebase.
