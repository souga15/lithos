from __future__ import annotations

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    slope_deg: float = Field(..., ge=0.0, le=90.0)
    cohesion_kpa: float = Field(12.0, ge=0.0)
    friction_angle_deg: float = Field(28.0, ge=0.0, le=60.0)
    failure_depth_m: float = Field(3.0, ge=0.1, le=50.0)
    saturation_ratio: float = Field(0.3, ge=0.0, le=1.0)
    pga_g: float = Field(0.0, ge=0.0, le=2.0)
    magnitude: float = Field(0.0, ge=0.0, le=10.0)
    epicentral_distance_km: float = Field(999.0, ge=0.0)
    matched_eq_depth_km: float = Field(10.0, ge=0.0)
    matched_eq_time_delta_hours: float = Field(0.0, ge=0.0)
    deformation_proxy: float = Field(0.0, ge=0.0, le=1.0)
    terrain_elevation_m: float = Field(300.0)
    terrain_area_km2: float = Field(1.0, ge=0.0)
    terrain_rain_72h: float = Field(0.0, ge=0.0)
    terrain_fos_proxy: float = Field(1.5, ge=0.0)
    terrain_distance_to_unit_m: float = Field(0.0, ge=0.0)
    sar_latest_value: float = Field(0.0)
    sar_previous_value: float = Field(0.0)
    fatality_count: float = Field(0.0, ge=0.0)
    injury_count: float = Field(0.0, ge=0.0)
