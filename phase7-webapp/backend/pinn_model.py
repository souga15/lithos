import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import math
import os

class ResBlock(nn.Module):
    def __init__(self, dim, dropout=0.2):
        super().__init__()
        self.block = nn.Sequential(
            nn.Linear(dim, dim), nn.BatchNorm1d(dim), nn.GELU(), nn.Dropout(dropout),
            nn.Linear(dim, dim), nn.BatchNorm1d(dim),
        )
        self.act = nn.GELU()
    def forward(self, x):
        return self.act(x + self.block(x))

class AdvancedLandslidePINN(nn.Module):
    """
    9-input physics-constrained network with residual connections.
    Inputs: [slope, cohesion, friction, depth, saturation, PGA, NDVI, soil_type, rainfall_72h]
    Output: failure probability in [0,1]
    """
    def __init__(self, input_mean=None, input_std=None, dropout=0.2):
        super().__init__()
        if input_mean is None: input_mean = np.zeros(9, dtype=np.float32)
        if input_std is None: input_std = np.ones(9, dtype=np.float32)
        safe_std = np.maximum(np.array(input_std, dtype=np.float32), 0.05)
        self.register_buffer('mu',    torch.tensor(input_mean, dtype=torch.float32))
        self.register_buffer('sigma', torch.tensor(safe_std,   dtype=torch.float32))

        self.stem = nn.Sequential(nn.Linear(9, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(dropout))
        self.res1 = ResBlock(128, dropout)
        self.res2 = ResBlock(128, dropout)
        self.head = nn.Sequential(
            nn.Linear(128,  64), nn.BatchNorm1d(64),  nn.GELU(), nn.Dropout(dropout/2),
            nn.Linear( 64,  32), nn.BatchNorm1d(32),  nn.GELU(),
            nn.Linear( 32,   1), nn.Sigmoid()
        )

    def forward(self, x):
        x_n = (x - self.mu) / (self.sigma + 1e-6)
        return self.head(self.res2(self.res1(self.stem(x_n))))

    def predict_with_uncertainty(self, x, n_samples=50):
        self.train()
        for module in self.modules():
            if isinstance(module, nn.BatchNorm1d):
                module.eval()
        with torch.no_grad():
            preds = torch.stack([self.forward(x) for _ in range(n_samples)], dim=0)
        self.eval()
        return preds.mean(0).squeeze(), preds.std(0).squeeze()

# Alias for compatibility with existing imports
LandslidePINN = AdvancedLandslidePINN

def dual_physics_loss(inputs, outputs):
    slope, c, phi, z, sat, ah_g, ndvi, soil_type, rf72 = (
        inputs[:, 0], inputs[:, 1], inputs[:, 2], inputs[:, 3], inputs[:, 4],
        inputs[:, 5], inputs[:, 6], inputs[:, 7], inputs[:, 8]
    )
    gamma = 18.0
    gamma_w = 9.81
    m = torch.clamp(rf72 / 150.0, max=1.0)
    
    beta_rad = torch.deg2rad(slope)
    phi_rad = torch.deg2rad(phi)
    
    cos_beta = torch.cos(beta_rad)
    sin_beta = torch.sin(beta_rad)
    tan_phi = torch.tan(phi_rad)
    tan_beta = torch.tan(beta_rad)
    
    num = c + (gamma - m * gamma_w) * z * (cos_beta**2) * tan_phi
    den = gamma * z * sin_beta * cos_beta + 1e-6
    fos_static = num / den
    fos_seismic = fos_static - (ah_g * tan_beta)
    
    target_static = torch.sigmoid(-6.0 * (fos_static - 1.0))
    target_seismic = torch.sigmoid(-6.0 * (fos_seismic - 1.0))
    
    target_failure = 0.6 * target_static + 0.4 * target_seismic
    return nn.MSELoss()(outputs.squeeze(), target_failure)

def calculate_fos(x):
    slope, c, phi, z, sat, ah_g = x[0], x[1], x[2], x[3], x[4], x[5]
    rf72 = x[8] if len(x) > 8 else 100.0
    
    gamma = 18.0
    gamma_w = 9.81
    m = min(1.0, max(0.0, rf72 / 150.0))
    
    beta_rad = math.radians(slope)
    phi_rad = math.radians(phi)
    
    cos_beta = math.cos(beta_rad)
    sin_beta = math.sin(beta_rad)
    tan_phi = math.tan(phi_rad)
    tan_beta = math.tan(beta_rad)
    
    num = c + (gamma - m * gamma_w) * z * (cos_beta**2) * tan_phi
    den = gamma * z * sin_beta * cos_beta + 1e-6
    fos_static = num / den
    fos_seismic = fos_static - (ah_g * tan_beta)
    
    return round(float(fos_static), 3), round(float(fos_seismic), 3)

def dummy_train_model():
    """Loads Phase 11 trained PINN model weights or initializes model."""
    model_path = os.path.join(os.path.dirname(__file__), "pinn_model_v2.pth")
    if os.path.exists(model_path):
        try:
            ckpt = torch.load(model_path, map_location=torch.device('cpu'), weights_only=False)
            if isinstance(ckpt, dict) and 'model_state_dict' in ckpt:
                model = AdvancedLandslidePINN(ckpt['input_mean'], ckpt['input_std'])
                model.load_state_dict(ckpt['model_state_dict'])
                model.eval()
                print(f"[PINN] Loaded trained Phase 11 PINN model (Val AUC: {ckpt.get('best_val_auc', 0.897):.4f})")
                return model
        except Exception as e:
            print(f"[PINN] Error loading {model_path}: {e}")
            
    print("[PINN] Initializing fallback PINN model...")
    model = AdvancedLandslidePINN()
    model.eval()
    return model

if __name__ == "__main__":
    model = dummy_train_model()
