import json, sys, os

sys.stdout.reconfigure(encoding='utf-8')

nb_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase9_NE_FullCoverage_(11).ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Insert a new cell AFTER Cell 5 (ENABLE_DRIVE_CHECKPOINTS) and BEFORE Cell 6 (DEM export)
# This cell purges old cached WhiteboxTools rasters + old vector checkpoints
# so that the new parameters (1200 threshold, 1.5 deg slope, etc.) actually take effect.

purge_cell = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": [
        "# ── ⚠️ FORCE RECOMPUTE: Delete old cached WhiteboxTools + vector checkpoints ──\n",
        "# The previous run cached results with STREAM_THRESHOLD=5000 and min_slope=8.\n",
        "# These old checkpoints MUST be deleted so WhiteboxTools re-runs with the new\n",
        "# high-density parameters (threshold=1200, min_slope=1.5).\n",
        "# Without this step, the code silently restores old sparse data.\n",
        "import shutil, os\n",
        "\n",
        "FORCE_RECOMPUTE = True  # Set to False after first successful dense run\n",
        "\n",
        "if FORCE_RECOMPUTE:\n",
        "    dirs_to_purge = [\n",
        "        '/content/drive/MyDrive/LITHOS/Phase9_data/checkpoints/wbt_rasters',\n",
        "        '/content/drive/MyDrive/LITHOS/Phase9_data/checkpoints/vectors',\n",
        "        'lithos_data/vector_checkpoints',\n",
        "    ]\n",
        "    for d in dirs_to_purge:\n",
        "        if os.path.exists(d):\n",
        "            count = len(os.listdir(d))\n",
        "            shutil.rmtree(d)\n",
        "            os.makedirs(d, exist_ok=True)\n",
        "            print(f'  🗑️ Purged {d} ({count} old files deleted)')\n",
        "        else:\n",
        "            print(f'  ✅ {d} (not present, nothing to purge)')\n",
        "    \n",
        "    # Also delete local hillslope rasters so WhiteboxTools re-runs\n",
        "    dem_dir = 'lithos_data/dem_ne'\n",
        "    if os.path.exists(dem_dir):\n",
        "        purged = 0\n",
        "        for fname in os.listdir(dem_dir):\n",
        "            if any(tag in fname for tag in ['_hillslopes.tif', '_filled.tif', '_slope.tif',\n",
        "                                             '_d8ptr.tif', '_accum.tif', '_streams.tif']):\n",
        "                os.remove(os.path.join(dem_dir, fname))\n",
        "                purged += 1\n",
        "        print(f'  🗑️ Purged {purged} local WhiteboxTools intermediate rasters')\n",
        "    \n",
        "    print('\\n✅ All old checkpoints purged. WhiteboxTools will recompute with new parameters.')\n",
        "    print('   STREAM_THRESHOLD_CELLS = 1200 (was 5000)')\n",
        "    print('   min_slope_deg = 1.5 (was 8)')\n",
        "    print('   min_pixels = 2 (was 4)')\n",
        "else:\n",
        "    print('ℹ️ FORCE_RECOMPUTE is False — using existing checkpoints.')\n",
    ]
}

# Insert after cell 5 (index 5)
nb['cells'].insert(6, purge_cell)

# Save
with open(nb_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

# Also save the HighRes copy
out_path = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase9_NE_FullCoverage_HighRes_Dense.ipynb'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("✅ Added FORCE_RECOMPUTE cell to both Phase 9 notebooks.")
print("   This will purge old cached rasters so the new density parameters take effect.")
