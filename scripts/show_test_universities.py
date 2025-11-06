"""
Display the two test universities (UNI1 and UNI2) created for testing.

This version uses shared helpers from test_university_helpers.py to reduce
code duplication and improve maintainability.
"""
from test_university_helpers import (
    # Constants
    ROOT_EMAIL, ROOT_PASSWORD, TEST_UNIVERSITY_CODES, DEFAULT_ADMIN_PASSWORD,
    DEFAULT_PROFESSOR_PASSWORD, DEFAULT_STUDENT_PASSWORD,
    # Functions
    login, get_universities, get_faculties, get_subjects, get_temp_status
)


def main():
    token = login(ROOT_EMAIL, ROOT_PASSWORD)
    if not token:
        print("Cannot proceed without token. Is backend running?")
        return

    # Get all universities
    universities = get_universities(token)

    # Filter for test universities
    test_unis = [u for u in universities if u.get('code') in TEST_UNIVERSITY_CODES + ['UNI2_TEMP']]

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
            faculties = get_faculties(token, uni_id)

            # Get subjects count
            subjects_count = 0
            for faculty in faculties:
                subjects = get_subjects(token, uni_id, faculty['id'])
                subjects_count += len(subjects)

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
        temp_status = get_temp_status(token, uni2['id'])
        if temp_status and temp_status.get('has_temp_schema'):
            print(f"\n✅ Temporary schema exists: {temp_status['temp_schema']}")
            print(f"   Created from backup restore")
            print(f"   Registered as university ID: {temp_status.get('temp_university_id', 'N/A')}")
            
            # Show temp schema stats if available
            temp_info = temp_status.get('temp_info')
            if temp_info and isinstance(temp_info, dict) and 'error' not in temp_info:
                print(f"   Faculties in temp: {temp_info.get('faculty_count', 0)}")
                print(f"   Users in temp: {temp_info.get('user_count', 0)}")
            
            print(f"\n   To promote temp to production:")
            print(f"   POST /api/v1/backups/{uni2['id']}/promote-temp")
        else:
            print("\n❌ No temporary schema found")

    print("\n" + "=" * 70)
    print(" Test User Credentials")
    print("=" * 70)
    print("\nFor University 1 (UNI1) and University 2 (UNI2):")
    print("\n  Admin users:")
    print(f"    admin.cs1@uni[1|2].edu / {DEFAULT_ADMIN_PASSWORD}")
    print(f"    admin.math1@uni[1|2].edu / {DEFAULT_ADMIN_PASSWORD}")
    print(f"    admin.eng1@uni[1|2].edu / {DEFAULT_ADMIN_PASSWORD}")
    print("\n  Professor users:")
    print(f"    prof1.cs1@uni[1|2].edu / {DEFAULT_PROFESSOR_PASSWORD}")
    print(f"    prof2.cs1@uni[1|2].edu / {DEFAULT_PROFESSOR_PASSWORD}")
    print("    (similar for math1, eng1)")
    print("\n  Student users:")
    print(f"    student1.cs1@uni[1|2].edu / {DEFAULT_STUDENT_PASSWORD}")
    print(f"    student2.cs1@uni[1|2].edu / {DEFAULT_STUDENT_PASSWORD}")
    print(f"    student3.cs1@uni[1|2].edu / {DEFAULT_STUDENT_PASSWORD}")
    print("    (similar for math1, eng1)")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    main()
