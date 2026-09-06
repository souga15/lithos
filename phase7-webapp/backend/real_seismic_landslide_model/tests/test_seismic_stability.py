from src.physics.seismic_stability import compute_stability


def test_dry_shaking_case_has_nonzero_dry_failure_probability() -> None:
    result = compute_stability(
        slope_deg=35.0,
        cohesion_kpa=8.0,
        friction_angle_deg=24.0,
        failure_depth_m=3.5,
        saturation_ratio=0.1,
        pga_g=0.3,
    )

    assert result.dry_soil_shear_failure_probability > 0.0
    assert result.fos_static > 0.0
    assert result.fos_pseudostatic > 0.0
