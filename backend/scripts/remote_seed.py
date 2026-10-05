"""
Remote seed script - calls the live backend register API to create demo accounts.
Run this ONCE after Render deploys successfully.
Usage: python scripts/remote_seed.py https://foodrescue-ai-91hr.onrender.com
"""
import urllib.request, json, sys

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "https://foodrescue-ai-91hr.onrender.com"

def reg(name, email, pw, role):
    data = json.dumps({"name": name, "email": email, "password": pw, "role": role}).encode()
    req = urllib.request.Request(BASE + "/api/auth/register", data=data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        r = urllib.request.urlopen(req, timeout=20)
        print(f"  Created {role}: {email}")
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        if "already registered" in str(body).lower():
            print(f"  Exists {role}: {email}")
        else:
            print(f"  Error {role}: {email} -> {e.code} {body}")
    except Exception as ex:
        print(f"  Failed {role}: {email} -> {ex}")

print("Seeding demo accounts on", BASE)
reg("Admin User",                "admin@foodrescue.ai",      "Admin@1234",  "ADMIN")  # Note: ADMIN role may not be registerable
reg("Spice Garden Restaurant",   "spicegarden@demo.com",     "Donor@1234",  "DONOR")
reg("Grand Wedding Hall",        "grandwedding@demo.com",    "Donor@1234",  "DONOR")
reg("City College Cafeteria",    "citycollege@demo.com",     "Donor@1234",  "DONOR")
reg("Raj Kumar",                 "raj@demo.com",             "Vol@1234",    "VOLUNTEER")
reg("Priya S",                   "priya@demo.com",           "Vol@1234",    "VOLUNTEER")
reg("Annapoorna Trust",          "annapoorna@demo.com",      "NGO@1234",    "NGO")
reg("Hope Foundation",           "hope@demo.com",            "NGO@1234",    "NGO")
print("Done.")