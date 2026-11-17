"""
Configuration settings for YM to SoundCloud Transfer Service.
Supports Dual-Routing proxy architecture for cloud SaaS deployment.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
PUBLIC_DOMAIN = os.getenv("PUBLIC_DOMAIN", "")

# Dual-Routing Proxies (Optional, for geo-routing between Russia and Global)
# - YM_PROXY: Used for Yandex Music if server is hosted outside Russia / CIS
YM_PROXY = os.getenv("YM_PROXY", "").strip() or None

# - SC_PROXY: Used for SoundCloud API if server is hosted inside Russia and ISP blocks SC
SC_PROXY = os.getenv("SC_PROXY", "").strip() or None

# Cache
JOBS_CACHE_FILE = BASE_DIR / ".jobs_cache.json"
