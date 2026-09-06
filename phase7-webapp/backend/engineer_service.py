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
    volume_m3 = 4000000 * deformation_proxy * math.cos(slope_mean * math.pi / 180)
    jcb_days = volume_m3 / 200
    clearance_days = max(1, round(jcb_days))
    jcb_required = max(1, round(jcb_days / 5))
    tipper_loads = volume_m3 / 8
    tipper_trucks = max(2, round(tipper_loads / (15 * clearance_days)))
    est_cost = volume_m3 * 450

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
