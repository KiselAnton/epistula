"""
Display the two test universities (UNI1 and UNI2) created for testing.

This version talks to the running backend via HTTP using root credentials,
so it works without importing backend code or installing dependencies.
"""
import os
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
ROOT_EMAIL = os.getenv("ROOT_EMAIL", "root@localhost.localdomain")
ROOT_PASSWORD = os.getenv("ROOT_PASSWORD", "changeme123")


def login(email: str, password: str) -> str | None:
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if r.status_code == 200:
            return r.json().get("access_token")
        print(f"Login failed: {r.status_code} {r.text}")
    except Exception as e:
        print(f"Login error: {e}")
    return None


def get(url: str, token: str):
    return requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)


def main():
    token = login(ROOT_EMAIL, ROOT_PASSWORD)
    if not token:
        print("Cannot proceed without token. Is backend running at", BASE_URL, "?")
        return

    # Get all universities
    resp = get(f"{BASE_URL}/universities/", token)
    resp.raise_for_status()
    universities = resp.json()

    # Filter for UNI1 and UNI2
    test_unis = [u for u in universities if u.get('code') in ['UNI1', 'UNI2', 'UNI2_TEMP']]

    print("\n" + "=" * 70)
    print(" Test Universities Created")
    print("=" * 70)

    for uni in sorted(test_unis, key=lambda x: x['code']):
        status = "🔴 INACTIVE (TEMP)" if not uni.get('is_active', True) else "🟢 ACTIVE"
        print(f"\n{status}")
        print(f"  ID: {uni['id']}")
        print(f"  Name: {uni['name']}")
        print(f"  Code: {uni['code']}")
        print(f"  Schema: {uni['schema_name']}")

        # Get detailed info for active universities
        if uni.get('is_active', True):
            uni_id = uni['id']

            # Get faculties
            faculties_resp = get(f"{BASE_URL}/faculties/{uni_id}", token)
            faculties = faculties_resp.json() if faculties_resp.status_code == 200 else []

            # Get subjects
            subjects_count = 0
            for faculty in faculties:
                subjects_resp = get(f"{BASE_URL}/subjects/{uni_id}/{faculty['id']}", token)
                if subjects_resp.status_code == 200:
                    subjects_count += len(subjects_resp.json())

            print(f"\n  📚 Data Summary:")
            print(f"     Faculties: {len(faculties)}")
            print(f"     Subjects: {subjects_count}")
            print(f"     Lectures: ~{subjects_count * 3} (estimated)")

            if faculties:
                print(f"\n  📂 Faculties:")
                for fac in faculties:
                    print(f"     - {fac['name']} ({fac['code']})")

    # Check for backup and temp schema for UNI2
    uni2 = next((u for u in test_unis if u['code'] == 'UNI2'), None)
    if uni2:
        print("\n" + "=" * 70)
        print(" University 2 Backup & Temp Schema Status")
        print("=" * 70)

        # Check temp status
        temp_status_resp = get(f"{BASE_URL}/backups/{uni2['id']}/temp-status", token)
        if temp_status_resp.status_code == 200:
            temp_status = temp_status_resp.json()
            if temp_status.get('has_temp_schema'):
                print(f"\n✅ Temporary schema exists: {temp_status['temp_schema_name']}")
                print(f"   Created from backup restore")
                print(f"   Registered as university ID: {temp_status.get('temp_university_id', 'N/A')}")
                print(f"\n   To promote temp to production:")
                print(f"   POST /api/v1/backups/{uni2['id']}/promote-temp")
            else:
                print("\n❌ No temporary schema found")

    print("\n" + "=" * 70)
    print(" Test User Credentials")
    print("=" * 70)
    print("\nFor University 1 (UNI1) and University 2 (UNI2):")
    print("\n  Admin users:")
    print("    admin.cs1@uni[1|2].edu / Admin123!")
    print("    admin.math1@uni[1|2].edu / Admin123!")
    print("    admin.eng1@uni[1|2].edu / Admin123!")
    print("\n  Professor users:")
    print("    prof1.cs1@uni[1|2].edu / Prof123!")
    print("    prof2.cs1@uni[1|2].edu / Prof123!")
    print("    (similar for math1, eng1)")
    print("\n  Student users:")
    print("    student1.cs1@uni[1|2].edu / Student123!")
    print("    student2.cs1@uni[1|2].edu / Student123!")
    print("    student3.cs1@uni[1|2].edu / Student123!")
    print("    (similar for math1, eng1)")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    main()
