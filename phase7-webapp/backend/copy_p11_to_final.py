import shutil, os

src = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\LITHOS_Phase11_PINN_NoSynthetic_v9_priority_export_FIXED (1).ipynb'
dst = r'c:\Users\souga\OneDrive\Desktop\LITHOS\colab files\SIH_NEW_INTRIGATION\r2\final r2\LITHOS_Phase11_FIXED_Fast_Dense.ipynb'

shutil.copyfile(src, dst)
print(f"Copied fixed notebook to: {dst}")
