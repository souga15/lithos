# Contributing to LITHOS

Thank you for your interest in contributing to **LITHOS** (Landslide Intelligence using Temporal & Hyperlocal Observation System)!

Whether you are a geotechnical engineer, data scientist, or frontend/backend developer, your contributions are valuable for improving terrain intelligence and life-safety early warning systems.

---

## Code of Conduct

Please maintain an inclusive, collaborative, and professional environment. Focus on clear scientific communication, code readability, and reproducible geomechanical results.

---

## How to Contribute

### 1. Reporting Bugs & Proposing Features
- Search existing [GitHub Issues](https://github.com/souga15/lithos/issues) before opening a new one.
- When filing a bug, include:
  - Operating system & Python / Node.js version.
  - Clear steps to reproduce the issue.
  - Expected vs actual behavior with relevant console or terminal tracebacks.

### 2. Development Workflow
1. **Fork the Repository:** Create a personal fork on GitHub.
2. **Clone Your Fork:**
   ```bash
   git clone https://github.com/<your-username>/lithos.git
   cd lithos
   ```
3. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make Your Changes:**
   - Adhere to **PEP 8** standards for Python backend & ML code.
   - Use clean, modular React component architecture for the frontend.
   - Ensure that any physical equations preserve dimensional consistency (e.g. kPa for cohesion, degrees for slope/friction, m/s² or g for acceleration).
5. **Verify Locally:**
   - Ensure the FastAPI server boots cleanly (`python run_backend.py`).
   - Ensure the Vite frontend builds with zero syntax errors (`npm run build`).
6. **Commit with Clear Messages:**
   ```bash
   git commit -m "feat(pinn): add adaptive learning rate schedule for physics loss"
   ```
7. **Push to Your Fork:**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Submit a Pull Request:** Open a PR against the `main` (or `master`) branch of `souga15/lithos`. Describe the changes, motivation, and any testing performed.

---

## Guidelines for Machine Learning & Geotechnical Modules

- **No Synthetic Label Leakage:** Ground-truth evaluations must be validated against real empirical inventory points (NASA GLC, GSI).
- **Physical Bounds:** Factor of Safety ($FS$) calculations must account for positive effective normal stress ($\sigma'_n > 0$) and handle dry vs saturated conditions gracefully.
- **Large Files:** Do not commit raw GeoPackages or GeoTIFFs larger than 50MB directly into git. Use external object storage (Google Drive / S3 / Zenodo) and document the fetch script.

---

Thank you for helping make mountainous infrastructure safer!
