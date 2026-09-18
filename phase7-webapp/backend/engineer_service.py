import math

def verify_engineer_auth(email, password, mode, access_code=None):
    email = email.strip() if email else email
    password = password.strip() if password else password
    
    if mode == 'signup':
        if access_code != 'LITHOS-ENG-26':
            return {"success": False, "error": "Invalid Engineering Access Code."}
        return {"success": True, "token": "mock-jwt-token-7382"}
    else:
        if email == 'engineer@lithos.gov' and password == 'admin':
            return {"success": True, "token": "mock-jwt-token-7382"}
        else:
            return {"success": False, "error": "Invalid credentials. Hint: use engineer@lithos.gov / admin"}

def simulate_earthquake(fos_static: float, slope_mean: float, magnitude: float):
    kh_sim = 0.05 * math.pow(10, 0.5 * (magnitude - 5))
    simulated_fos = fos_static * (1 - kh_sim * math.tan(slope_mean * math.pi / 180))
    return {
        "kh_sim": kh_sim,
        "simulated_fos": max(0.1, simulated_fos)
    }

def post_disaster_assessment(deformation_proxy: float, slope_mean: float):
    # Realistic active failure detachment volume along critical slip scarp (IS 14458 / MoRTH Guidelines)
    # Roadside slope failures detach along active shear zone: ~600 to 3,500 m³ (not millions)
    scarp_area_m2 = 900.0 + 1200.0 * min(1.0, max(0.1, deformation_proxy * 10))
    eff_depth_m = max(1.2, min(3.0, 1.4 + (slope_mean / 45.0) * 0.8))
    volume_m3 = round(scarp_area_m2 * eff_depth_m * math.cos(math.radians(min(55.0, slope_mean))), 0)
    volume_m3 = max(350.0, min(4200.0, volume_m3))

    # Standard MoRTH / NHAI 10-wheeler tipper capacity (10 m³ struck/heaped)
    tipper_capacity_m3 = 10.0
    tipper_loads = math.ceil(volume_m3 / tipper_capacity_m3)
    
    # Hydraulic excavator loading rate (~500 m³/day per 20-ton excavator)
    jcb_required = max(1, min(3, math.ceil(volume_m3 / 1200.0)))
    daily_clearance_capacity = jcb_required * 500.0
    clearance_days = max(1, math.ceil(volume_m3 / daily_clearance_capacity))
    
    # Active tipper shuttle fleet (each truck completes 8-10 round trips per shift to dump site)
    trips_per_truck_day = 8
    daily_loads = tipper_loads / clearance_days
    tipper_trucks = max(2, min(14, math.ceil(daily_loads / trips_per_truck_day)))
    est_cost = volume_m3 * 450.0  # INR 450/m³ for excavation, loading & disposal

    return {
        "volume_m3": round(volume_m3, 0),
        "clearance_days": clearance_days,
        "jcb_required": jcb_required,
        "tipper_loads": round(tipper_loads, 0),
        "tipper_trucks": tipper_trucks,
        "est_cost_inr": round(est_cost, 2)
    }

def calculate_cost_benefit(slope_mean: float, road_class: str):
    treatment_cost = 3200000 if slope_mean > 45 else 900000
    
    ROAD_CLASS_COSTS = {
        'NH': {'closure': 50000, 'repair': 2500000, 'events': 3, 'days': 5},
        'SH': {'closure': 20000, 'repair': 800000, 'events': 2, 'days': 4},
        'MDR': {'closure': 5000, 'repair': 200000, 'events': 1, 'days': 2}
    }
    
    rc = ROAD_CLASS_COSTS.get(road_class.upper(), ROAD_CLASS_COSTS['NH'])
    annual_inaction_loss = (rc['closure'] * rc['days']) + (rc['repair'] * rc['events'])
    
    if annual_inaction_loss == 0:
        payback = 0
    else:
        payback = treatment_cost / annual_inaction_loss
        
    npv_10yr = sum(annual_inaction_loss / math.pow(1.07, i + 1) for i in range(10)) - treatment_cost
    
    return {
        "treatment_cost": treatment_cost,
        "annual_inaction_loss": annual_inaction_loss,
        "payback_years": round(payback, 2),
        "npv_10yr": round(npv_10yr, 2)
    }
