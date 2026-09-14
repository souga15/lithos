/**
 * NE_POPULAR_PLACES.js
 * Curated cities, towns, hill stations and key landslide-prone localities for all 8 Northeast states.
 * Used for instant, zero-latency local search & camera flight in Cesium 3D view.
 */

export const NE_POPULAR_PLACES = {
  sikkim: [
    { name: 'Gangtok', district: 'East Sikkim (Capital)', lat: 27.3389, lon: 88.6065, alt: 1650, desc: 'Capital city & NH10 lifeline corridor' },
    { name: 'Namchi', district: 'South Sikkim', lat: 27.1666, lon: 88.3666, alt: 1315, desc: 'South district headquarters, high slope scarp' },
    { name: 'Pelling', district: 'West Sikkim', lat: 27.3166, lon: 88.2333, alt: 2150, desc: 'High-altitude ridge settlement with steep flanks' },
    { name: 'Mangan', district: 'North Sikkim', lat: 27.5166, lon: 88.5333, alt: 1350, desc: 'North district hub, active glacial moraine hazard zone' },
    { name: 'Lachung', district: 'North Sikkim', lat: 27.6891, lon: 88.7430, alt: 2700, desc: 'High Himalayan river gorge and debris flow corridor' },
    { name: 'Ravangla', district: 'South Sikkim', lat: 27.3075, lon: 88.3630, alt: 2000, desc: 'Transit node between Gangtok and Pelling' },
    { name: 'Singtam', district: 'East Sikkim', lat: 27.2344, lon: 88.4975, alt: 350, desc: 'Teesta river junction and flood/landslide risk node' },
    { name: 'Rangpo', district: 'Pakyong District', lat: 27.1764, lon: 88.5303, alt: 300, desc: 'State entry gateway, Teesta valley fault scarp' },
    { name: 'Yuksom', district: 'West Sikkim', lat: 27.3719, lon: 88.2217, alt: 1780, desc: 'Historic base of Mt. Kanchenjunga trek' },
    { name: 'Geyzing', district: 'West Sikkim', lat: 27.2833, lon: 88.2500, alt: 1900, desc: 'West Sikkim administrative hub' },
    { name: 'Chungthang', district: 'North Sikkim', lat: 27.6039, lon: 88.6472, alt: 1790, desc: 'Confluence of Lachen and Lachung rivers' },
  ],

  cherrapunji: [
    { name: 'Shillong', district: 'East Khasi Hills (Capital)', lat: 25.5788, lon: 91.8933, alt: 1525, desc: 'State capital, high seismic and urban slope zone' },
    { name: 'Cherrapunji (Sohra)', district: 'East Khasi Hills', lat: 25.2986, lon: 91.7378, alt: 1430, desc: 'Extreme precipitation & plateau edge escarpment' },
    { name: 'Mawsynram', district: 'East Khasi Hills', lat: 25.2975, lon: 91.5828, alt: 1400, desc: 'World peak rainfall record zone' },
    { name: 'Tura', district: 'West Garo Hills', lat: 25.5144, lon: 90.2032, alt: 350, desc: 'Garo Hills administrative and commercial center' },
    { name: 'Jowai', district: 'West Jaintia Hills', lat: 25.4455, lon: 92.2030, alt: 1380, desc: 'Jaintia plateau center, coal basin cut slopes' },
    { name: 'Dawki', district: 'West Jaintia Hills', lat: 25.1837, lon: 92.0195, alt: 60, desc: 'Southern border river canyon crossing' },
    { name: 'Nongstoin', district: 'West Khasi Hills', lat: 25.5200, lon: 91.2700, alt: 1400, desc: 'Central plateau dissected terrain' },
    { name: 'Mairang', district: 'Eastern West Khasi Hills', lat: 25.5600, lon: 91.6400, alt: 1560, desc: 'Khyrim granite dome ridge zone' },
  ],

  arunachal_w: [
    { name: 'Itanagar', district: 'Papum Pare (Capital)', lat: 27.0844, lon: 93.6053, alt: 320, desc: 'State capital, Sub-Himalayan Siwalik belt' },
    { name: 'Tawang', district: 'Tawang District', lat: 27.5861, lon: 91.8594, alt: 3048, desc: 'High alpine gorge, Sela Pass approach corridor' },
    { name: 'Bomdila', district: 'West Kameng', lat: 27.2644, lon: 92.4222, alt: 2217, desc: 'Kameng river basin ridge town' },
    { name: 'Pasighat', district: 'East Siang', lat: 28.0667, lon: 95.3333, alt: 155, desc: 'Siang river debouchment zone into plains' },
    { name: 'Ziro', district: 'Lower Subansiri', lat: 27.5950, lon: 93.8310, alt: 1572, desc: 'Apatani plateau surrounded by pine-covered hills' },
    { name: 'Naharlagun', district: 'Papum Pare', lat: 27.1056, lon: 93.6933, alt: 290, desc: 'Twin capital commercial transit hub' },
    { name: 'Bhalukpong', district: 'West Kameng', lat: 27.0100, lon: 92.6500, alt: 213, desc: 'Foothill entry gateway into Kameng valley' },
    { name: 'Along (Aalo)', district: 'West Siang', lat: 28.1667, lon: 94.8000, alt: 619, desc: 'Yomgo river confluence valley' },
  ],

  manipur_nh2: [
    { name: 'Imphal', district: 'Imphal West (Capital)', lat: 24.8170, lon: 93.9368, alt: 786, desc: 'Central alluvial valley surrounded by fault lines' },
    { name: 'Senapati', district: 'Senapati District', lat: 25.2678, lon: 94.0200, alt: 1060, desc: 'NH2 critical hill transport and blockage corridor' },
    { name: 'Kangpokpi', district: 'Kangpokpi District', lat: 25.1500, lon: 93.9667, alt: 1000, desc: 'High vulnerability tectonic shearing zone along NH2' },
    { name: 'Churachandpur', district: 'Churachandpur', lat: 24.3333, lon: 93.6833, alt: 914, desc: 'Southern hill district center' },
    { name: 'Ukhrul', district: 'Ukhrul District', lat: 25.1167, lon: 94.3667, alt: 1662, desc: 'Eastern frontier ridge system near Myanmar border' },
    { name: 'Thoubal', district: 'Thoubal District', lat: 24.6333, lon: 93.9833, alt: 765, desc: 'Eastern valley agricultural and transit hub' },
    { name: 'Tamenglong', district: 'Tamenglong', lat: 24.9833, lon: 93.5000, alt: 1260, desc: 'Rugged western Barail mountain ridge' },
  ],

  nagaland: [
    { name: 'Kohima', district: 'Kohima (Capital)', lat: 25.6751, lon: 94.1086, alt: 1444, desc: 'State capital on steep ridge crest, active creep zone' },
    { name: 'Dimapur', district: 'Dimapur', lat: 25.9060, lon: 93.7270, alt: 145, desc: 'Commercial plains gateway to Nagaland hills' },
    { name: 'Mokokchung', district: 'Mokokchung', lat: 26.3253, lon: 94.5200, alt: 1325, desc: 'Cultural center of Ao Nagas on anticlinal ridge' },
    { name: 'Wokha', district: 'Wokha', lat: 26.1000, lon: 94.2667, alt: 1313, desc: 'Mount Tiyi ridge flank, landslide prone slope' },
    { name: 'Mon', district: 'Mon District', lat: 26.7500, lon: 95.0333, alt: 655, desc: 'Northern border hill district' },
    { name: 'Tuensang', district: 'Tuensang', lat: 26.2800, lon: 94.8300, alt: 1370, desc: 'Eastern mountain boundary with Saramati massif' },
    { name: 'Phek', district: 'Phek District', lat: 25.6800, lon: 94.5000, alt: 1520, desc: 'Terrace agriculture slopes in southern Nagaland' },
  ],

  assam_hills: [
    { name: 'Guwahati', district: 'Kamrup Metro', lat: 26.1445, lon: 91.7362, alt: 55, desc: 'Principal metropolis, hill encroachment scarp zones' },
    { name: 'Haflong', district: 'Dima Hasao (North Cachar)', lat: 25.1764, lon: 93.0200, alt: 966, desc: 'Only hill station of Assam, frequent monsoon rail blockages' },
    { name: 'Diphu', district: 'Karbi Anglong', lat: 25.8450, lon: 93.4300, alt: 186, desc: 'Karbi plateau dissected hill ranges' },
    { name: 'Silchar', district: 'Cachar (Barak Valley)', lat: 24.8333, lon: 92.7789, alt: 25, desc: 'Southern Barak valley commercial hub' },
    { name: 'Tezpur', district: 'Sonitpur', lat: 26.6333, lon: 92.8000, alt: 48, desc: 'Brahmaputra north bank gateway to Arunachal Kameng' },
    { name: 'Jorhat', district: 'Jorhat', lat: 26.7500, lon: 94.2200, alt: 116, desc: 'Upper Assam tea valley hub' },
    { name: 'Dibrugarh', district: 'Dibrugarh', lat: 27.4728, lon: 94.9120, alt: 108, desc: 'Major Brahmaputra riverbank terminal' },
  ],

  mizoram: [
    { name: 'Aizawl', district: 'Aizawl (Capital)', lat: 23.7271, lon: 92.7176, alt: 1132, desc: 'Linear ridge city, extreme slope vulnerability' },
    { name: 'Lunglei', district: 'Lunglei District', lat: 22.8833, lon: 92.7333, alt: 722, desc: 'Southern Mizoram central hill town' },
    { name: 'Champhai', district: 'Champhai', lat: 23.4756, lon: 93.3278, alt: 1678, desc: 'Eastern border town with Myanmar' },
    { name: 'Serchhip', district: 'Serchhip', lat: 23.3100, lon: 92.8300, alt: 885, desc: 'Between Mat and Tuichang river gorges' },
    { name: 'Kolasib', district: 'Kolasib', lat: 24.2300, lon: 92.6800, alt: 615, desc: 'Northern highway entry into Mizoram from Silchar' },
    { name: 'Mamit', district: 'Mamit District', lat: 23.9300, lon: 92.4900, alt: 718, desc: 'Western border district with Tripura & Bangladesh' },
  ],

  tripura: [
    { name: 'Agartala', district: 'West Tripura (Capital)', lat: 23.8315, lon: 91.2868, alt: 15, desc: 'State capital, Howrah river flood plain' },
    { name: 'Dharmanagar', district: 'North Tripura', lat: 24.3767, lon: 92.1667, alt: 21, desc: 'Northern commercial hub on Juri river valley' },
    { name: 'Udaipur', district: 'Gomati District', lat: 23.5333, lon: 91.4833, alt: 22, desc: 'Historic temple city on Gomati river' },
    { name: 'Kailashahar', district: 'Unakoti', lat: 24.3300, lon: 92.0000, alt: 29, desc: 'Unakoti rock carvings hillside region' },
    { name: 'Ambassa', district: 'Dhalai', lat: 23.9200, lon: 91.8500, alt: 65, desc: 'Central ridge district, heavy monsoon runoff' },
    { name: 'Belonia', district: 'South Tripura', lat: 23.2500, lon: 91.4500, alt: 23, desc: 'Southern international border point' },
  ]
};
