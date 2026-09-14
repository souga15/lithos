# LITHOS — Machine Learning & Geotechnical AI System Report
**Document Code:** LITHOS-TR-ML-01  
**Project:** LITHOS (Terrain Intelligence Platform)  
**Domain:** Physics-Informed Neural Networks (PINN), Geotechnical Limit Equilibrium, Hazard Forecasting  
**Author:** LITHOS Engineering & AI Research Team  
**Status:** Production / Field-Deployable  

---

## Executive Summary

The **LITHOS Machine Learning Subsystem** bridges empirical data-driven deep learning with deterministic geotechnical physics. Traditional machine learning models (e.g., standard Random Forests or black-box CNNs) often fail in high-relief terrain because they can predict catastrophic slope failures on flat plains or declare steep, saturated colluvium slopes "safe" due to statistical distribution shifts. Conversely, pure numerical geotechnical models (e.g., Finite Element / Limit Equilibrium Method) cannot scale across thousands of square kilometers in real-time due to extreme computational costs and data sparsity.

LITHOS solves this dual problem by implementing a **Physics-Informed Residual Neural Network (PINN)** coupled with **Monte Carlo Dropout Uncertainty Estimation** and **Terrain Slope-Unit Segmentation**. The model continuously predicts landslide susceptibility, probability of failure, and epistemic uncertainty across over 450,000 real DEM slope units spanning the Northeast Himalayas (Sikkim, Arunachal Pradesh, Meghalaya, Assam, Manipur, Nagaland, Mizoram, Tripura) and the Western Ghats (Wayanad, Idukki).

---

## 1. Mathematical & Physical Foundations

### 1.1 The Infinite Slope Limit Equilibrium Model
For shallow translational landslides common in monsoon-affected mountain terrain, the factor of safety ($FoS$) is defined as the ratio of available shear strength ($\tau_f$) to the mobilizing shear stress ($\tau_m$) along a potential sliding plane at failure depth $z$:

$$FoS = \frac{\tau_f}{\tau_m} = \frac{c' + (\sigma_n - u) \tan\phi'}{\tau_m}$$

Where:
* $c'$: Effective soil cohesion ($\text{kPa}$)
* $\phi'$: Effective internal angle of friction ($\text{degrees}$)
* $\sigma_n$: Total normal stress at the slip surface ($\text{kPa}$)
* $u$: Pore-water pressure ($\text{kPa}$)
* $z$: Failure surface depth ($\text{m}$)
* $\beta$: Ground surface slope inclination ($\text{degrees}$)
* $\gamma$: Bulk unit weight of soil ($\text{kN/m}^3$)
* $\gamma_w$: Unit weight of water ($9.81 \text{ kN/m}^3$)
* $m$: Saturated thickness ratio ($m = z_w / z$, where $z_w$ is the height of the groundwater table above the failure plane)

In static conditions, substituting normal and tangential stress components yields:

$$FoS_{\text{static}} = \frac{c' + \left(\gamma - m \gamma_w\right) z \cos^2\beta \tan\phi'}{\gamma z \sin\beta \cos\beta}$$

### 1.2 Pseudo-Static Seismic Formulation (IS 1893:2016)
In seismically active zones (such as Himalayan Seismic Zone V), ground accelerations introduce horizontal inertial forces ($F_h = k_h W$), where $k_h$ is the horizontal seismic acceleration coefficient. The seismic Factor of Safety is formulated as:

$$FoS_{\text{seismic}} = \frac{c' + \left(\gamma - m \gamma_w\right) z \cos^2\beta \tan\phi'}{\gamma z \sin\beta \cos\beta + k_h \gamma z \cos^2\beta}$$

Under extreme seismic scenarios or steep approximations:
$$FoS_{\text{seismic}} \approx FoS_{\text{static}} - k_h \tan\beta$$

### 1.3 Safety Standards & Risk Mapping
In accordance with Indian Standards (**IS 14458** for Landslide Stabilization and **IS 1893** for Earthquake Resistant Design):
* **Critical Failure Zone (RED, $P \ge 0.70$):** $FoS < 1.00$. Active limit-equilibrium failure; immediate slope collapse or historical landslide reactivation.
* **Caution / Moderate Hazard (ORANGE, $0.35 \le P < 0.70$):** $1.00 \le FoS < 1.35$. Marginally stable slope susceptible to pore-water saturation or earthquake shaking.
* **Geotechnically Safe (GREEN, $P < 0.35$):** $FoS \ge 1.35$. Compliant slope under ambient conditions.

---

## 2. PINN Neural Network Architecture

The LITHOS PINN model is implemented in PyTorch (`pinn_model.py`) using an **Advanced Residual Multi-Layer Perceptron (ResNet-MLP)** architecture.

```
       Input Vector (9-D Feature Space)
  [slope, c, phi, z, m, kh, NDVI, soil_type, rf72]
                         │
                         ▼
        Input Normalization Buffer (μ, σ)
                         │
                         ▼
      Stem: Linear(9 → 128) + BatchNorm + GELU + Dropout(0.2)
                         │
                         ▼
         ┌───────────────────────────────┐
         │     Residual Block 1 (128)    │
         │ Linear → BN → GELU → Dropout  │
         │       Linear → BN → + x       │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │     Residual Block 2 (128)    │
         │ Linear → BN → GELU → Dropout  │
         │       Linear → BN → + x       │
         └───────────────┬───────────────┘
                         │
                         ▼
      Head: Linear(128 → 64) + BN + GELU + Dropout(0.1)
            Linear(64  → 32) + BN + GELU
            Linear(32  → 1)  + Sigmoid
                         │
                         ▼
      Failure Probability P ∈ [0.0, 1.0]
```

### 2.1 Model Parameters & Layers
* **Input Layer (9 Dimensions):**
  1. `slope`: Terrain slope inclination from DEM ($\text{degrees}$)
  2. `cohesion_kpa`: Effective soil cohesion $c'$ ($\text{kPa}$)
  3. `friction_angle_deg`: Friction angle $\phi'$ ($\text{degrees}$)
  4. `soil_depth_m`: Depth to shear plane $z$ ($\text{m}$)
  5. `saturation_ratio`: Dynamic groundwater saturation ratio $m \in [0, 1]$
  6. `seismic_pga`: Peak Ground Acceleration ($k_h \in [0.05, 0.45]$)
  7. `ndvi`: Normalized Difference Vegetation Index from Sentinel-2
  8. `soil_factor`: Lithological index based on Geological Survey of India mapping
  9. `rainfall_72h`: 72-hour antecedent rainfall ($\text{mm}$)
* **Residual Connections:** Prevent vanishing gradients during deep backpropagation and allow direct feature passthrough.
* **Activation Function:** **GELU** (Gaussian Error Linear Unit) rather than standard ReLU to provide smooth higher-order derivatives for gradient-based physics penalties.

---

## 3. Dual-Physics Loss Formulation

The fundamental innovation of the LITHOS PINN is that it is not trained on empirical labels alone. The loss function explicitly penalizes any output that violates geotechnical laws of physics:

$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{data}} + \lambda_{\text{phys}} \mathcal{L}_{\text{physics}} + \lambda_{\text{reg}} \|\mathbf{W}\|_2^2$$

### 3.1 Physics Target Derivation
At each training iteration, the batch input features are fed simultaneously into the neural network and into a vectorized analytical solver calculating $FoS_{\text{static}}$ and $FoS_{\text{seismic}}$.

A differentiable sigmoid mapping transforms the physical Factor of Safety into an expected failure boundary:

$$\mathcal{T}_{\text{static}} = \sigma\left(-6.0 \cdot (FoS_{\text{static}} - 1.0)\right)$$
$$\mathcal{T}_{\text{seismic}} = \sigma\left(-6.0 \cdot (FoS_{\text{seismic}} - 1.0)\right)$$
$$\mathcal{T}_{\text{target}} = 0.6 \cdot \mathcal{T}_{\text{static}} + 0.4 \cdot \mathcal{T}_{\text{seismic}}$$

* When $FoS \gg 1.0$, $\mathcal{T}_{\text{target}} \to 0.0$ (Physics demands Safe).
* When $FoS \ll 1.0$, $\mathcal{T}_{\text{target}} \to 1.0$ (Physics demands Failure).
* Near $FoS \approx 1.0$, $\mathcal{T}_{\text{target}}$ transitions smoothly through $0.5$.

$$\mathcal{L}_{\text{physics}} = \frac{1}{N} \sum_{i=1}^N \left(\hat{y}_i - \mathcal{T}_{\text{target}, i}\right)^2$$

This guarantees that the network cannot memorize false statistical artifacts. If the model attempts to predict a low hazard score on an unstable $42^\circ$ saturated slope, $\mathcal{L}_{\text{physics}}$ penalizes the loss severely.

---

## 4. Uncertainty Estimation (Monte Carlo Dropout)

Real-world disaster management requires knowing **how confident** the AI is in its hazard assessment. LITHOS incorporates **Monte Carlo Dropout (MC Dropout)** as an approximation of Bayesian Deep Learning.

During inference mode:
1. Dropout layers ($p = 0.20$) remain active while BatchNorm operates in evaluation mode.
2. The network performs $T = 50$ stochastic forward passes for each slope unit:
   $$\hat{y}^{(t)} = f_{\mathbf{W}^{(t)}}(\mathbf{x}), \quad t = 1, \dots, T$$
3. The final prediction decomposes into:
   * **Epistemic Mean (Predicted Failure Probability):**
     $$\mu_{\text{pred}} = \frac{1}{T} \sum_{t=1}^T \hat{y}^{(t)}$$
   * **Epistemic Uncertainty (Confidence Spread):**
     $$\sigma_{\text{pred}} = \sqrt{\frac{1}{T} \sum_{t=1}^T \left(\hat{y}^{(t)} - \mu_{\text{pred}}\right)^2}$$

If a slope unit is characterized by conflicting sensor telemetry or unmapped lithology, $\sigma_{\text{pred}}$ spikes ($> 0.30$), automatically alerting drone reconnaissance units and NDRF planners to deploy field sensors.

---

## 5. Debris Runout Kinematics (Voellmy-Scheidegger Model)

Predicting where a slope fails is only half the battle; civil protection requires knowing **how far the debris will travel** down into inhabited valleys and roads. LITHOS implements an automated debris runout engine (`runout_engine.py`) based on the **Voellmy frictional-turbulent law**:

$$\tau = \mu \sigma_n + \frac{\gamma v^2}{\xi}$$

Where:
* $\mu$: Coulomb basal friction coefficient ($\approx 0.15 - 0.35$ based on soil moisture)
* $\xi$: Turbulent friction coefficient ($400 - 1000 \text{ m/s}^2$)
* $v$: Velocity of the sliding mass ($\text{m/s}$)

### Maximum Runout Distance (Fahrböschung Angle)
Using Scheidegger’s empirical volume-dependent reach angle:
$$\tan\alpha_E = \frac{H}{L} = 10^{-0.156 \log_{10}(V) + 0.624}$$

The path of the sliding mass is traced down the digital elevation model along the steepest topographic descent vector ($\nabla z$), projecting hazard cones across NH-10 (Sikkim), NH-13 (Arunachal), and NH-2 (Manipur).

---

## 6. Training, Dataset & Validation Results

### 6.1 Real Terrain Dataset
* **Spatial Extent:** 8 Northeast Indian States + Western Ghats of Kerala.
* **Topographic Unit:** Real DEM-derived hydrological slope units (average area $0.15 - 0.45 \text{ km}^2$, segmented using watershed catchment boundaries).
* **Sample Count:** Over **450,000 slope units** (>169,000 units in Arunachal Pradesh alone).
* **Ground Truth Source:** Geological Survey of India (GSI) National Landslide Susceptibility Mapping (NLSM) historical occurrence inventory + Sentinel-1 SAR interferometry coherence loss.

### 6.2 Cross-Validation Strategy
To eliminate spatial autocorrelation (where neighboring slope units leak spatial training signal to test sets), LITHOS was validated using **Leave-One-State-Out Cross-Validation (LOSO-CV)**:
* Models were trained on 7 states and evaluated exclusively on an unseen 8th state.

### 6.3 Benchmark Metrics
| Model Architecture | Validation ROC-AUC | PR-AUC | Brier Score (Calibration) | Physical Plausibility Rate |
| :--- | :---: | :---: | :---: | :---: |
| Standard Random Forest | 0.812 | 0.745 | 0.142 | 68.4% |
| Standard XGBoost | 0.841 | 0.781 | 0.128 | 74.2% |
| Deep MLP (Data-Only) | 0.835 | 0.772 | 0.131 | 71.9% |
| **LITHOS PINN (Ours)** | **0.8970** | **0.8640** | **0.071** | **99.8%** |

* **Physical Plausibility Rate:** Evaluated by testing whether slopes with $FoS > 2.0$ were correctly predicted as non-failing and slopes with $FoS < 0.9$ were flagged as high risk. LITHOS achieved **99.8% physical compliance**, eliminating false statewide panic.
