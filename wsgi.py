"""WSGI entry point for PythonAnywhere / cloud deployment"""
import sys
import os

project_home = os.path.dirname(os.path.abspath(__file__))
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from app import app as application
from modules.database import init_db, seed_initial_data
from modules.pipeline import init_pipeline_for_product
from modules.database import get_db

# Initialize on first load
init_db()
seed_initial_data()
conn = get_db()
products = conn.execute("SELECT id FROM products").fetchall()
conn.close()
for p in products:
    init_pipeline_for_product(p["id"])
