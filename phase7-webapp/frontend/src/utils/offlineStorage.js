import localforage from 'localforage';
import API_BASE_URL from '../apiConfig';

// Configure localforage to use IndexedDB
localforage.config({
  name: 'LITHOS_PWA',
  storeName: 'offline_terrain_models', 
  description: 'Stores massive GeoJSON map payloads for offline and instant access'
});

export const CACHE_KEYS = {
  RISK_GRID_CHERRAPUNJI: 'risk_grid_cherrapunji',
  RISK_GRID_ARUNACHAL: 'risk_grid_arunachal_w',
  RISK_GRID_SIKKIM: 'risk_grid_sikkim'
};

/**
 * Checks if a specific region's grid is cached
 */
export async function isRegionCached(regionKey) {
  try {
    const data = await localforage.getItem(`risk_grid_${regionKey}`);
    return data !== null;
  } catch (err) {
    return false;
  }
}

/**
 * Gets cached data, returns null if not found
 */
export async function getCachedRegion(regionKey) {
  try {
    return await localforage.getItem(`risk_grid_${regionKey}`);
  } catch (err) {
    console.error(`Failed to get cache for ${regionKey}`, err);
    return null;
  }
}

/**
 * Downloads the massive GeoJSON in chunks to provide download progress
 */
export async function downloadAndCacheRegion(regionKey, onProgress) {
  try {
    const url = `${API_BASE_URL}/api/risk-grid?region=${regionKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${regionKey}`);
    }

    const contentLength = response.headers.get('content-length');
    // If chunked transfer encoding, length might be missing. We estimate ~5MB per region for the fake progress bar if missing.
    const total = contentLength ? parseInt(contentLength, 10) : 5000000; 

    let loaded = 0;
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      let progress = Math.round((loaded / total) * 100);
      if (progress > 99) progress = 99; // Cap at 99 until fully parsed
      if (onProgress) onProgress(progress);
    }

    // Processing phase
    if (onProgress) onProgress(100);

    const blob = new Blob(chunks);
    const text = await blob.text();
    const data = JSON.parse(text);

    // Save to IndexedDB
    await localforage.setItem(`risk_grid_${regionKey}`, data);
    return true;

  } catch (err) {
    console.error(`Download failed for ${regionKey}`, err);
    return false;
  }
}
