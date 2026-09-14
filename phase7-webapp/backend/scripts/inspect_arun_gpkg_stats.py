import pyogrio

path_curr = r'c:\Users\souga\OneDrive\Desktop\LITHOS\phase7-webapp\backend\lithos_all_slope_units_final.gpkg'
df = pyogrio.read_dataframe(path_curr, columns=['region', 'unit_id', 'fos', 'risk_level', 'slope_degrees'])
arun = df[df['region'] == 'arunachal_w']
print('Arunachal units in GPKG:', len(arun))
print('Colab risk_level counts in GPKG:\n', arun['risk_level'].value_counts())
print('Colab fos stats in GPKG:\n', arun['fos'].describe())
