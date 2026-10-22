#!/usr/bin/env python3
"""
SmartAttendance AI - Render Keep-Alive Script
--------------------------------------------
Keeps your Render.com hosted web services active 24/7 by sending
scheduled health check requests every 10-14 minutes, preventing Render's
free tier instance from going to sleep (15-minute inactivity limit).

Usage:
    python render_keep_alive.py
    python render_keep_alive.py --urls https://my-backend.onrender.com/healthz https://my-frontend.onrender.com --interval 10
"""

import sys
import time
import os
import argparse
from datetime import datetime
import urllib.request
import urllib.error

# Default target URLs (can be overridden via environment variables or CLI arguments)
DEFAULT_URLS = [
    url.strip() for url in os.environ.get("RENDER_URLS", "http://localhost:3000,http://127.0.0.1:5000/healthz").split(",") if url.strip()
]
DEFAULT_INTERVAL_MINUTES = int(os.environ.get("PING_INTERVAL_MINUTES", "10"))


def log_message(prefix, message, color_code=None):
    """Outputs a timestamped status log."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if color_code and sys.stdout.isatty():
        print(f"\033[{color_code}m[{now}] [{prefix}] {message}\033[0m")
    else:
        print(f"[{now}] [{prefix}] {message}")


def ping_url(url, timeout=30):
    """
    Sends an HTTP GET request to target URL.
    Returns: (success: bool, status_code: int, duration_ms: float, error_msg: str)
    """
    headers = {
        "User-Agent": "SmartAttendanceAI-KeepAlive/2.0 (+https://render.com)"
    }
    req = urllib.request.Request(url, headers=headers, method="GET")

    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            duration_ms = (time.time() - start_time) * 1000
            return True, response.status, duration_ms, None
    except urllib.error.HTTPError as e:
        duration_ms = (time.time() - start_time) * 1000
        # 2xx or 3xx or even 401/403 still wakes up the Render container
        is_awake = e.code < 500
        return is_awake, e.code, duration_ms, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        duration_ms = (time.time() - start_time) * 1000
        return False, None, duration_ms, f"Connection Error: {e.reason}"
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        return False, None, duration_ms, str(e)


def run_keep_alive_loop(urls, interval_minutes):
    """Runs the continuous ping loop."""
    interval_seconds = interval_minutes * 60

    print("=" * 65)
    print("  SMART ATTENDANCE AI - RENDER 24/7 KEEP-ALIVE DAEMON")
    print("=" * 65)
    print(f"Target URLs to keep alive ({len(urls)}):")
    for u in urls:
        print(f"  • {u}")
    print(f"Ping Interval: Every {interval_minutes} minutes ({interval_seconds}s)")
    print("Preventing Render free instance spin-down...")
    print("Press Ctrl+C to stop.\n")

    iteration = 1

    try:
        while True:
            log_message("CYCLE", f"--- Starting Ping Cycle #{iteration} ---", "1;34")

            for target_url in urls:
                success, status_code, elapsed_ms, err = ping_url(target_url)

                if success:
                    log_message(
                        "AWAKE",
                        f"SUCCESS ({status_code}) -> {target_url} in {elapsed_ms:.1f}ms",
                        "32" # Green
                    )
                else:
                    log_message(
                        "WARN",
                        f"FAILED ({err}) -> {target_url} in {elapsed_ms:.1f}ms",
                        "31" # Red
                    )

            next_run = datetime.fromtimestamp(time.time() + interval_seconds).strftime("%H:%M:%S")
            log_message("WAIT", f"Cycle complete. Next ping scheduled for {next_run}...\n", "90")

            iteration += 1
            time.sleep(interval_seconds)

    except KeyboardInterrupt:
        print("\n")
        log_message("EXIT", "Keep-alive service stopped by user. Goodbye!", "33")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Pings your Render hosted website periodically to keep it from going to sleep."
    )
    parser.add_argument(
        "--urls",
        nargs="+",
        default=DEFAULT_URLS,
        help="One or more full URLs to ping (e.g. https://my-backend.onrender.com/healthz https://my-frontend.onrender.com)"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL_MINUTES,
        help=f"Interval between pings in minutes (default: {DEFAULT_INTERVAL_MINUTES})"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_keep_alive_loop(args.urls, args.interval)
