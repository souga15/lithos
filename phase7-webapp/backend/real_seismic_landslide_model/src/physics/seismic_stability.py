from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class StabilityResult:
    fos_static: float
    fos_pseudostatic: float
    critical_acceleration_g: float
    newmark_displacement_cm: float
    dry_soil_shear_failure_probability: float


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def compute_stability(
    slope_deg: float,
    cohesion_kpa: float,
    friction_angle_deg: float,
    failure_depth_m: float,
    saturation_ratio: float,
    pga_g: float,
    unit_weight_knm3: float = 18.0,
    water_unit_weight_knm3: float = 9.81,
) -> StabilityResult:
    """
    Compute static and pseudo-static slope stability metrics.

    This simplified starter implementation explicitly keeps dry-soil earthquake
    failure in the loop by allowing low saturation and non-zero shaking.
    """
    beta = math.radians(max(slope_deg, 0.1))
    phi = math.radians(max(friction_angle_deg, 0.1))
    z = max(failure_depth_m, 0.1)
    m = _clamp(saturation_ratio, 0.0, 1.0)

    numerator = cohesion_kpa + (unit_weight_knm3 - m * water_unit_weight_knm3) * z * (math.cos(beta) ** 2) * math.tan(phi)
    denominator = max(unit_weight_knm3 * z * math.sin(beta) * math.cos(beta), 1e-6)
    fos_static = _clamp(numerator / denominator, 0.05, 10.0)

    kh = max(pga_g * 0.5, 0.0)
    pseudo_denominator = denominator + kh * unit_weight_knm3 * z * (math.cos(beta) ** 2)
    fos_pseudostatic = _clamp(numerator / max(pseudo_denominator, 1e-6), 0.05, 10.0)

    critical_acceleration_g = _clamp((fos_static - 1.0) * math.sin(beta), 0.0, 2.0)
    exceedance = max(pga_g - critical_acceleration_g, 0.0)
    newmark_displacement_cm = 100.0 * exceedance * exceedance

    dry_factor = 1.0 - m
    dry_soil_shear_failure_probability = _clamp(
        0.55 * exceedance + 0.25 * dry_factor + 0.20 * max(1.0 - fos_pseudostatic, 0.0),
        0.0,
        1.0,
    )

    return StabilityResult(
        fos_static=fos_static,
        fos_pseudostatic=fos_pseudostatic,
        critical_acceleration_g=critical_acceleration_g,
        newmark_displacement_cm=newmark_displacement_cm,
        dry_soil_shear_failure_probability=dry_soil_shear_failure_probability,
    )
