
import networkx as nx
import geopandas as gpd
import numpy as np
import os
from shapely.geometry import LineString


RISK_WEIGHTS = {"GREEN": 1.0, "ORANGE": 3.0, "RED": 100.0}

ALL_REGIONS = {
    "cherrapunji": {"name":"Cherrapunji, Meghalaya", "bbox":(91.4,25.0,92.2,25.6)},
    "sikkim":      {"name":"Sikkim",                  "bbox":(88.0,27.0,88.9,28.1)},
    "manipur_nh2":{"name":"Manipur NH2 Corridor",    "bbox":(93.0,24.5,94.5,25.5)},
    "arunachal_w":{"name":"Arunachal Pradesh (W)",   "bbox":(92.5,26.5,94.0,28.0)},
    "nagaland":   {"name":"Nagaland Hills",          "bbox":(93.5,25.5,95.0,27.0)},
    "assam_hills":{"name":"Assam Hills",             "bbox":(91.5,25.5,93.5,26.5)},
    "wayanad":    {"name":"Wayanad, Kerala",         "bbox":(75.7,11.4,76.4,12.0)},
    "idukki":     {"name":"Idukki, Kerala",          "bbox":(76.7, 9.8,77.4,10.4)},
    "munnar":     {"name":"Munnar, Kerala",          "bbox":(77.0,10.0,77.4,10.3)},
}


class LITHOSRouter:
    """
    LITHOS A* Safe Routing Engine.
    Phase 7 usage:
        from routing_engine import LITHOSRouter
        router = LITHOSRouter(roads_dir="roads/", grid_path="master_grid.gpkg")
        route  = router.find_safe_route("wayanad", 11.5, 75.8, 11.85, 76.2)
    """

    def __init__(self, roads_dir: str, grid_path: str,
                 risk_col: str = "risk_level_p4"):
        self.roads_dir = roads_dir
        self.risk_col  = risk_col
        self.master_gdf = gpd.read_file(grid_path)
        self.graphs    = {}
        self._build_all_graphs()

    def _haversine(self, lat1, lon1, lat2, lon2):
        dlat = np.radians(lat2-lat1)
        dlon = np.radians(lon2-lon1)
        a    = (np.sin(dlat/2)**2 +
                np.cos(np.radians(lat1))*np.cos(np.radians(lat2))*
                np.sin(dlon/2)**2)
        return 6371000*2*np.arcsin(np.sqrt(a))

    def _get_edge_risk(self, line, region_gdf):
        try:
            mid = line.interpolate(0.5, normalized=True)
            dists = ((region_gdf["center_lat"]-mid.y)**2 +
                     (region_gdf["center_lon"]-mid.x)**2)**0.5
            idx = dists.idxmin()
            if dists[idx] > 0.036: return "GREEN", 0.0
            cell = region_gdf.loc[idx]
            return str(cell.get(self.risk_col,"GREEN")), float(cell.get("risk_score_p4",0.0))
        except:
            return "GREEN", 0.0

    def _build_graph(self, region_key):
        road_path = os.path.join(self.roads_dir, f"{region_key}.gpkg")
        if not os.path.exists(road_path): return None
        roads = gpd.read_file(road_path)
        if roads.crs and roads.crs.to_epsg() != 4326:
            roads = roads.to_crs("EPSG:4326")
        if "region" in self.master_gdf.columns:
            rgdf = self.master_gdf[self.master_gdf["region"]==region_key]
        else:
            rgdf = self.master_gdf
        if len(rgdf) == 0: rgdf = self.master_gdf
        G = nx.DiGraph()
        node_id = 0
        coord_to_node = {}
        def get_node(lat, lon):
            nonlocal node_id
            k = (round(lat,6), round(lon,6))
            if k not in coord_to_node:
                coord_to_node[k] = node_id
                G.add_node(node_id, lat=lat, lon=lon)
                node_id += 1
            return coord_to_node[k]
        for _, road in roads.iterrows():
            geom = road.geometry
            if geom is None: continue
            lines = list(geom.geoms) if geom.geom_type=="MultiLineString" else [geom]
            for line in lines:
                coords = list(line.coords)
                if len(coords) < 2: continue
                risk_lvl, risk_sc = self._get_edge_risk(line, rgdf)
                w = RISK_WEIGHTS.get(risk_lvl, 1.0)
                for i in range(len(coords)-1):
                    lo1,la1 = coords[i][0],coords[i][1]
                    lo2,la2 = coords[i+1][0],coords[i+1][1]
                    n1 = get_node(la1,lo1)
                    n2 = get_node(la2,lo2)
                    d  = self._haversine(la1,lo1,la2,lo2)
                    ed = {"weight":d*w,"distance":d,
                          "risk_level":risk_lvl,"risk_score":risk_sc}
                    G.add_edge(n1,n2,**ed)
                    G.add_edge(n2,n1,**ed)
        return G

    def _build_all_graphs(self):
        for key in ALL_REGIONS:
            G = self._build_graph(key)
            if G: self.graphs[key] = G
        print(f"LITHOSRouter: {len(self.graphs)} region graphs loaded")

    def update_risk(self, new_grid_gdf: gpd.GeoDataFrame,
                    risk_col: str = None):
        """Hot-reload risk weights from updated grid (called by alert engine)."""
        self.master_gdf = new_grid_gdf
        if risk_col: self.risk_col = risk_col
        self.graphs = {}
        self._build_all_graphs()
        print("LITHOSRouter: risk weights updated")

    def nearest_node(self, G, lat, lon):
        best, best_d = None, float("inf")
        for n, d in G.nodes(data=True):
            dist = self._haversine(lat,lon,d["lat"],d["lon"])
            if dist < best_d: best, best_d = n, dist
        return best, best_d

    def find_safe_route(self, region_key: str,
                        start_lat: float, start_lon: float,
                        end_lat:   float, end_lon:   float) -> dict:
        """Main routing method. Returns route dict with GeoJSON."""
        if region_key not in self.graphs:
            return {"error": f"No graph for {region_key}"}
        G = self.graphs[region_key]
        warnings = []
        sn, sd = self.nearest_node(G, start_lat, start_lon)
        en, ed = self.nearest_node(G, end_lat,   end_lon)
        if sd > 5000: warnings.append(f"Start {sd:.0f}m from nearest road")
        if ed > 5000: warnings.append(f"End {ed:.0f}m from nearest road")
        path = None
        try:
            path = nx.astar_path(G, sn, en,
                heuristic=lambda a,b: self._haversine(
                    G.nodes[a]["lat"],G.nodes[a]["lon"],
                    G.nodes[b]["lat"],G.nodes[b]["lon"]),
                weight="weight")
        except nx.NetworkXNoPath:
            warnings.append("No safe path -- using distance-only")
            try:
                path = nx.astar_path(G, sn, en,
                    heuristic=lambda a,b: self._haversine(
                        G.nodes[a]["lat"],G.nodes[a]["lon"],
                        G.nodes[b]["lat"],G.nodes[b]["lon"]),
                    weight="distance")
            except:
                return {"error":"No route found","warnings":warnings}
        if not path: return {"error":"Empty path","warnings":warnings}
        coords = []
        total_dist = 0.0
        risk_counts = {"RED":0,"ORANGE":0,"GREEN":0}
        for i in range(len(path)-1):
            n1,n2 = path[i],path[i+1]
            d = G.nodes[n1]
            coords.append((d["lat"],d["lon"]))
            if G.has_edge(n1,n2):
                e = G[n1][n2]
                total_dist += e.get("distance",0)
                lvl = e.get("risk_level","GREEN")
                risk_counts[lvl] = risk_counts.get(lvl,0)+1
        last = G.nodes[path[-1]]
        coords.append((last["lat"],last["lon"]))
        total_edges = max(sum(risk_counts.values()),1)
        safe_score  = max(0.0,min(1.0,
            1.0-(risk_counts["RED"]*1.0+risk_counts["ORANGE"]*0.3)/total_edges))
        max_risk = "GREEN"
        if risk_counts["ORANGE"]>0: max_risk="ORANGE"
        if risk_counts["RED"]>0:    max_risk="RED"
        return {
            "region":            region_key,
            "route_coords":      coords,
            "total_distance_km": round(total_dist/1000,2),
            "risk_summary":      risk_counts,
            "max_risk_level":    max_risk,
            "safe_score":        round(safe_score,3),
            "warnings":          warnings,
            "geojson": {
                "type":"Feature",
                "geometry":{"type":"LineString",
                    "coordinates":[[lo,la] for la,lo in coords]},
                "properties":{"region":region_key,
                    "total_distance_km":round(total_dist/1000,2),
                    "max_risk_level":max_risk,
                    "safe_score":round(safe_score,3),
                    "risk_counts":risk_counts,
                    "warnings":warnings}
            }
        }
