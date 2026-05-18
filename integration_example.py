#!/usr/bin/env python3
"""
Lamix SMS / Hyder SMS — Public API Integration Example

Shows how to authenticate with an API key, fetch leaderboard data,
and retrieve client stats.  Includes retry logic and error handling.

Requirements: Python 3.8+ (no external packages needed)
"""

import json
import time
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, List, Optional

# ── Configuration ──────────────────────────────────────────────
BASE_URL = "http://your-domain.com"   # ← Change to your actual domain
API_KEY  = "your-api-key-here"        # ← Replace with a valid API key

MAX_RETRIES     = 3
RETRY_BACKOFF   = 2   # seconds, multiplied by attempt number
REQUEST_TIMEOUT = 15  # seconds


class LamixAPIError(Exception):
    """Raised when the API returns a non-2xx response."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(f"[{status_code}] {code}: {message}")


class LamixClient:
    """Lightweight client for the Lamix SMS public API."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, str]] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Make an HTTP request with retry logic."""
        url = f"{self.base_url}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)

        headers = {
            "X-API-Key": self.api_key,
            "Accept": "application/json",
        }

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                    return json.loads(resp.read().decode("utf-8"))

            except urllib.error.HTTPError as e:
                # Don't retry client errors (4xx) except 429
                if e.code == 429:
                    retry_after = int(e.headers.get("Retry-After", RETRY_BACKOFF * attempt))
                    print(f"  ⏳ Rate limited. Retrying after {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                if 400 <= e.code < 500:
                    error_body = {}
                    try:
                        error_body = json.loads(e.read().decode("utf-8"))
                    except Exception:
                        pass
                    raise LamixAPIError(
                        e.code,
                        error_body.get("code", "UNKNOWN"),
                        error_body.get("error", str(e)),
                    )

                # 5xx — retry
                last_error = e
                print(f"  ⚠️  Server error {e.code}. Attempt {attempt}/{MAX_RETRIES}...")
                time.sleep(RETRY_BACKOFF * attempt)

            except urllib.error.URLError as e:
                last_error = e
                print(f"  ⚠️  Connection error: {e.reason}. Attempt {attempt}/{MAX_RETRIES}...")
                time.sleep(RETRY_BACKOFF * attempt)

            except Exception as e:
                last_error = e
                print(f"  ⚠️  Unexpected error: {e}. Attempt {attempt}/{MAX_RETRIES}...")
                time.sleep(RETRY_BACKOFF * attempt)

        raise LamixAPIError(0, "MAX_RETRIES", f"All {MAX_RETRIES} attempts failed. Last error: {last_error}")

    # ── Public Endpoints ──

    def get_leaderboard(self, period: str = "today", limit: int = 10) -> Dict:
        """Fetch the SMS leaderboard."""
        return self._request("GET", "/api/v1/leaderboard", params={"period": period, "limit": str(limit)})

    def get_clients(self) -> Dict:
        """List all clients with SMS counts."""
        return self._request("GET", "/api/v1/clients")

    def get_client_stats(self, username: str) -> Dict:
        """Get detailed stats for a specific client."""
        return self._request("GET", f"/api/v1/clients/{urllib.parse.quote(username)}/stats")


# ── Demo ───────────────────────────────────────────────────────

def main():
    client = LamixClient(BASE_URL, API_KEY)

    print("=" * 60)
    print("  Lamix SMS — API Integration Demo")
    print("=" * 60)

    # 1. Fetch today's leaderboard
    print("\n📊 Today's Leaderboard:")
    print("-" * 40)
    try:
        leaderboard = client.get_leaderboard(period="today", limit=10)
        print(f"  Generated at: {leaderboard.get('generatedAt', 'N/A')}")
        for entry in leaderboard.get("rankings", []):
            trend_icon = {"up": "↑", "down": "↓", "same": "→"}.get(entry.get("trend", "same"), "→")
            medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(entry.get("rank"), "  ")
            print(f"  {medal} #{entry['rank']:>2}  {entry['username']:<20}  "
                  f"Today: {entry.get('todaySms', 0):>6}  Week: {entry.get('weekSms', 0):>6}  {trend_icon}")
    except LamixAPIError as e:
        print(f"  ❌ Error: {e}")

    # 2. Fetch weekly leaderboard
    print("\n📊 This Week's Leaderboard:")
    print("-" * 40)
    try:
        leaderboard = client.get_leaderboard(period="week", limit=5)
        for entry in leaderboard.get("rankings", []):
            trend_icon = {"up": "↑", "down": "↓", "same": "→"}.get(entry.get("trend", "same"), "→")
            print(f"  #{entry['rank']:>2}  {entry['username']:<20}  Week SMS: {entry.get('weekSms', 0):>6}  {trend_icon}")
    except LamixAPIError as e:
        print(f"  ❌ Error: {e}")

    # 3. List all clients
    print("\n👥 All Clients:")
    print("-" * 40)
    try:
        clients_data = client.get_clients()
        clients = clients_data.get("clients", [])
        print(f"  Total: {clients_data.get('total', 0)}")
        for c in clients[:10]:  # Show first 10
            print(f"  • {c['username']:<20}  Today: {c.get('todaySms', 0):>5}  Week: {c.get('weekSms', 0):>5}")
        if len(clients) > 10:
            print(f"  ... and {len(clients) - 10} more")
    except LamixAPIError as e:
        print(f"  ❌ Error: {e}")

    # 4. Get stats for a specific client
    if clients_data and clients_data.get("clients"):
        sample_username = clients_data["clients"][0]["username"]
        print(f"\n📈 Stats for '{sample_username}':")
        print("-" * 40)
        try:
            stats = client.get_client_stats(sample_username)
            print(f"  Today SMS:  {stats.get('todaySms', 0)}")
            print(f"  Week SMS:   {stats.get('weekSms', 0)}")
            print(f"  Numbers:    {', '.join(stats.get('numbers', [])) or 'None'}")
            print(f"  Last updated: {stats.get('lastUpdated', 'N/A')}")
        except LamixAPIError as e:
            print(f"  ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("  Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
