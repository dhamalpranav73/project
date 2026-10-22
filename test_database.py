
from app.database import test_connection

try:
    if test_connection():
        print("SUCCESS: Flask database helper is connected!")
except Exception as error:
    print("Connection test failed:", type(error).__name__)
