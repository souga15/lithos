import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Rectangle, Marker, Popup, useMap, useMapEvents, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import RiskBadge from './RiskBadge';

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      // Only dismiss if the click was NOT on a GeoJSON feature polygon
      if (e.originalEvent._handledByFeature) return;
      if (onMapClick) onMapClick();
    }
  });
  return null;
};

const MapAutoZoom = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 12, { animate: true });
  }, [center ? center[0] : null, center ? center[1] : null, map]);
  return null;
};

const RiskMap = ({ region, riskData, reports, onCellClick, activeRunout, globalRunouts = [], layerType = 'street', showGrid = true, showReports = true, onMapClick }) => {
  const getTileLayer = () => {
    switch (layerType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'sar':
        // Placeholder for SAR WMS or different tile
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; 
      default:
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
  };

  const riskColors = {
    RED: '#FF3B30',
    ORANGE: '#FF9500',
    GREEN: '#30D158',
    YELLOW: '#FFD60A'
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={region.center} 
        zoom={12} 
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url={getTileLayer()}
        />
        
        <MapAutoZoom center={region.center} />

        {showGrid && riskData && (
          <GeoJSON 
            key={riskData.region} // Force re-render on region change
            data={riskData}
            style={(feature) => {
              const level = feature.properties.risk_level;
              const cellId = feature.properties.cell_id;
              
              // Highlight selected failing cell
              const isSelected = activeRunout && activeRunout.source_cell_id === cellId;
              
              // Highlight affected cells (chain risk / road risk)
              const isAffectedChain = activeRunout?.impacts?.chain_slope_cells?.some(c => c.cell_id === cellId);
              const isAffectedRoad = activeRunout?.impacts?.road_risk_cells?.some(c => c.cell_id === cellId);
              
              return {
                color: isSelected ? '#FFFFFF' : (isAffectedChain || isAffectedRoad) ? '#FF9500' : 'transparent',
                fillColor: riskColors[level] || '#30D158',
                fillOpacity: level === 'RED' ? 0.35 : level === 'ORANGE' ? 0.2 : 0.05,
                weight: isSelected ? 3 : (isAffectedChain || isAffectedRoad) ? 2 : 0,
                dashArray: isAffectedChain ? '5, 5' : '',
                interactive: true,
              };
            }}
            onEachFeature={(feature, layer) => {
              layer.on({
                click: (e) => {
                  e.originalEvent._handledByFeature = true;
                  L.DomEvent.stopPropagation(e);
                  onCellClick(feature.properties);
                }
              });
            }}
          />
        )}

        <MapEvents onMapClick={onMapClick} />

        {/* --- GLOBAL RUNOUT OVERLAY (Influence areas for all failing slopes) --- */}
        {!activeRunout && globalRunouts && globalRunouts.map(fan => (
          <Polygon 
            key={`global-fan-${fan.cell_id}`}
            positions={fan.fan_polygon.coordinates[0].map(c => [c[1], c[0]])}
            pathOptions={{
              fillColor: '#FF3B30',
              fillOpacity: 0.0,
              color: '#FF3B30',
              weight: 0.5,
              dashArray: '2, 2',
              interactive: false
            }}
          />
        ))}

        {/* --- HIGH FIDELITY RUNOUT VISUALIZATION (Option B - Selected Cell) --- */}
        {activeRunout && (
          <>
            {activeRunout.aspect_known ? (
              // Option A+B: Heatmap Fan
              [1.0, 0.75, 0.5, 0.25].map((scale, idx) => {
                const colors = ['#FFFF00', '#FF9500', '#FF3B30', '#8B0000'];
                const opacities = [0.15, 0.25, 0.4, 0.6];
                
                // Scale the fan coordinates for gradient effect
                const baseCoords = activeRunout.fan_polygon.coordinates[0];
                const apex = baseCoords[0];
                const scaledCoords = baseCoords.map(pt => {
                  const dx = pt[0] - apex[0];
                  const dy = pt[1] - apex[1];
                  return [apex[0] + dx * scale, apex[1] + dy * scale];
                });

                return (
                  <Polygon 
                    key={`fan-${idx}`}
                    positions={scaledCoords.map(c => [c[1], c[0]])}
                    pathOptions={{
                      fillColor: colors[idx],
                      fillOpacity: opacities[idx],
                      color: 'transparent',
                      weight: 0,
                      interactive: false
                    }}
                  />
                );
              })
            ) : (
              // Circle Fallback for unknown aspect
              [1.0, 0.75, 0.5, 0.25].map((scale, idx) => {
                const colors = ['#FFFF00', '#FF9500', '#FF3B30', '#8B0000'];
                return (
                  <Circle
                    key={`circle-${idx}`}
                    center={[activeRunout.center_lat || activeRunout.fan_polygon.coordinates[0][0][1], activeRunout.center_lon || activeRunout.fan_polygon.coordinates[0][0][0]]}
                    radius={activeRunout.runout_distance_m * scale}
                    pathOptions={{
                      fillColor: colors[idx],
                      fillOpacity: 0.2,
                      color: 'transparent',
                      weight: 0,
                      interactive: false
                    }}
                  />
                );
              })
            )}
          </>
        )}

        {showReports && reports && reports.map(report => (
          <Marker 
            key={report.report_id} 
            position={[report.lat, report.lon]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow-lg ${
                report.verified ? 'bg-risk-red animate-pulse' : 'bg-risk-yellow'
              }"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup className="glass-popup">
              <div className="p-2 min-w-[200px]">
                <div className="flex justify-between items-start mb-2">
                  <RiskBadge level={report.verified ? 'RED' : 'YELLOW'} className="!text-[8px]" />
                  <span className="text-[10px] opacity-60">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <h4 className="text-xs font-bold mb-1 uppercase tracking-tight">{report.description}</h4>
                <p className="text-[10px] opacity-70 mb-3 leading-relaxed">
                  Located near {report.region_name}. Reported by {report.user_id}. {report.confirm_count} confirmations.
                </p>
                <div className="flex flex-col gap-1.5">
                  <button className="w-full bg-accent/20 hover:bg-accent/40 text-accent text-[8px] font-black py-1 rounded transition-all">
                    CONFIRM REPORT
                  </button>
                  <button className="w-full bg-white/5 hover:bg-white/10 text-white/60 text-[8px] font-black py-1 rounded transition-all">
                    ROAD IS CLEAR
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default RiskMap;
