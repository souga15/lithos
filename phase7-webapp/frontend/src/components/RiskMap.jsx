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
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    }
  };

  const riskColors = {
    RED: '#FF3B30',
    ORANGE: '#FF9500',
    GREEN: '#30D158',
    YELLOW: '#FFD60A'
  };

  const mapCenter = region?.center || [27.33, 88.61];

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        key={region?.key || 'risk-map-2d'}
        center={mapCenter} 
        zoom={12} 
        preferCanvas={true}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url={getTileLayer()}
        />
        
        <MapAutoZoom center={mapCenter} />

        {showGrid && riskData && (
          <GeoJSON 
            key={`${region?.key || 'risk'}-${riskData?.features?.length || 0}`}
            data={riskData}
            style={(feature) => {
              const level = feature?.properties?.risk_level;
              const cellId = feature?.properties?.cell_id;
              
              // Highlight selected failing cell
              const isSelected = activeRunout && activeRunout.source_cell_id === cellId;
              
              // Highlight affected cells (chain risk / road risk)
              const isAffectedChain = activeRunout?.impacts?.chain_slope_cells?.some(c => c.cell_id === cellId);
              const isAffectedRoad = activeRunout?.impacts?.road_risk_cells?.some(c => c.cell_id === cellId);
              
              return {
                color: isSelected ? '#FFFFFF' : (isAffectedChain || isAffectedRoad) ? '#FF9500' : level === 'RED' ? '#FF3B30' : 'rgba(255,255,255,0.08)',
                fillColor: riskColors[level] || '#30D158',
                fillOpacity: level === 'RED' ? 0.55 : level === 'ORANGE' ? 0.35 : 0.08,
                weight: isSelected ? 3 : (isAffectedChain || isAffectedRoad) ? 2 : level === 'RED' ? 1.5 : 0.2,
                dashArray: isAffectedChain ? '5, 5' : '',
                interactive: true,
              };
            }}
            onEachFeature={(feature, layer) => {
              layer.on({
                click: (e) => {
                  e.originalEvent._handledByFeature = true;
                  L.DomEvent.stopPropagation(e);
                  if (onCellClick && feature?.properties) onCellClick(feature.properties);
                }
              });
            }}
          />
        )}

        <MapEvents onMapClick={onMapClick} />

        {/* --- GLOBAL RUNOUT OVERLAY (Active debris runout fans across region) --- */}
        {!activeRunout && globalRunouts && globalRunouts.map(fan => {
          const coords = fan?.fan_polygon?.coordinates?.[0];
          if (!coords || !Array.isArray(coords) || coords.length < 3) return null;
          return (
            <React.Fragment key={`global-fan-${fan.cell_id}`}>
              <Polygon 
                positions={coords.map(c => [c[1], c[0]])}
                pathOptions={{
                  fillColor: '#FF3B30',
                  fillOpacity: 0.3,
                  color: '#FF3B30',
                  weight: 2,
                  dashArray: '5, 3',
                  interactive: true
                }}
              >
                <Popup className="glass-popup">
                  <div className="p-2 text-white min-w-[180px]">
                    <div className="flex items-center gap-1.5 text-xs font-black text-red-400 mb-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      ACTIVE DEBRIS RUNOUT FAN
                    </div>
                    <div className="text-[11px] text-white/80 space-y-0.5">
                      <p><strong>Slope ID:</strong> {fan.cell_id}</p>
                      <p><strong>FoS (Seismic):</strong> <span className="text-red-400 font-bold">{fan.fos_seismic ? Number(fan.fos_seismic).toFixed(2) : '< 1.0'}</span></p>
                      <p><strong>Runout Reach:</strong> {fan.runout_m ? `${Math.round(fan.runout_m)} m` : 'N/A'}</p>
                      {fan.debris_volume_m3 && <p><strong>Volume:</strong> {Math.round(fan.debris_volume_m3).toLocaleString()} m³</p>}
                    </div>
                  </div>
                </Popup>
              </Polygon>
              {fan.center_lat && fan.center_lon && (
                <Circle
                  center={[fan.center_lat, fan.center_lon]}
                  radius={70}
                  pathOptions={{
                    fillColor: '#FF3B30',
                    fillOpacity: 0.9,
                    color: '#FFFFFF',
                    weight: 2
                  }}
                >
                  <Popup>
                    <div className="text-xs font-bold text-red-400">
                      Rupture Source: {fan.cell_id}
                    </div>
                  </Popup>
                </Circle>
              )}
            </React.Fragment>
          );
        })}

        {/* --- HIGH FIDELITY RUNOUT VISUALIZATION (Option B - Selected Cell) --- */}
        {activeRunout && activeRunout.fan_polygon?.coordinates?.[0] && (
          <>
            {activeRunout.aspect_known ? (
              // Option A+B: Heatmap Fan
              [1.0, 0.75, 0.5, 0.25].map((scale, idx) => {
                const colors = ['#FFFF00', '#FF9500', '#FF3B30', '#8B0000'];
                const opacities = [0.2, 0.35, 0.5, 0.7];
                
                // Scale the fan coordinates for gradient effect
                const baseCoords = activeRunout.fan_polygon.coordinates[0];
                if (!baseCoords || baseCoords.length < 3) return null;
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
                      color: idx === 0 ? '#FF3B30' : 'transparent',
                      weight: idx === 0 ? 2 : 0,
                      interactive: false
                    }}
                  />
                );
              })
            ) : (
              // Circle Fallback for unknown aspect
              [1.0, 0.75, 0.5, 0.25].map((scale, idx) => {
                const colors = ['#FFFF00', '#FF9500', '#FF3B30', '#8B0000'];
                const centerPt = [
                  activeRunout.center_lat || activeRunout.fan_polygon.coordinates[0][0][1], 
                  activeRunout.center_lon || activeRunout.fan_polygon.coordinates[0][0][0]
                ];
                return (
                  <Circle
                    key={`circle-${idx}`}
                    center={centerPt}
                    radius={(activeRunout.runout_distance_m || 500) * scale}
                    pathOptions={{
                      fillColor: colors[idx],
                      fillOpacity: 0.25,
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
