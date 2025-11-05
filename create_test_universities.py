#!/usr/bin/env python3
"""
Script to create two fully populated test universities:
- University 1: Complete with all entities
- University 2: Complete with all entities + a temporary university from backup

This version uses shared helpers from test_university_helpers.py to reduce
code duplication and improve maintainability.
"""

import sys
from test_university_helpers import (
    ROOT_EMAIL, ROOT_PASSWORD,
    FACULTIES, SUBJECTS_PER_FACULTY, PROFESSORS_PER_FACULTY, STUDENTS_PER_FACULTY,
    DEFAULT_ADMIN_PASSWORD, DEFAULT_PROFESSOR_PASSWORD, DEFAULT_STUDENT_PASSWORD,
    login, find_university_by_code, create_university, create_faculty,
    create_subject, create_user, assign_professor_to_faculty, assign_professor_to_subject,
    assign_student_to_faculty, assign_student_to_subject, create_lecture,
    update_lecture, create_lecture_note, create_backup, restore_as_temp
)


def populate_university(token, uni_num):
    """Populate a university with all entities"""
    print(f"\n{'='*60}")
    print(f"Creating University {uni_num}")
    print(f"{'='*60}")

    code = f"UNI{uni_num}"
    uni = find_university_by_code(token, code)
    if uni:
        print(f" Using existing university: {uni['name']} ({code})")
    else:
        uni = create_university(
            token,
            name=f"Test University {uni_num}",
            code=code,
            description=f"Complete test university number {uni_num}"
        )
    if not uni:
        return None

    uni_id = uni["id"]

    faculty_data = []
    for idx, fac_template in enumerate(FACULTIES):
        faculty = create_faculty(
            token, uni_id, fac_template["name"],
            fac_template["short_name"], f"{fac_template['short_name']}{uni_num}"
        )
        if faculty:
            faculty_data.append(faculty)

    for idx, faculty in enumerate(faculty_data):
        faculty_id = faculty["id"]
        faculty_name = faculty["name"]
        faculty_short = faculty["short_name"]

        subject_data = []
        for subj_idx in range(SUBJECTS_PER_FACULTY):
            subject = create_subject(
                token, uni_id, faculty_id,
                f"Introduction to {faculty_short}" if subj_idx == 0 else f"Advanced {faculty_short}",
                f"INTRO{uni_num}{idx}" if subj_idx == 0 else f"ADV{uni_num}{idx}"
            )
            if subject:
                subject_data.append(subject)

        _admin = create_user(
            token, uni_id,
            email=f"admin.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
            name=f"{faculty_name} Admin",
            password=DEFAULT_ADMIN_PASSWORD, role="uni_admin", faculty_id=faculty_id
        )

        professors = []
        for i in range(PROFESSORS_PER_FACULTY):
            prof = create_user(
                token, uni_id,
                email=f"prof{i+1}.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_name} Professor {i+1}",
                password=DEFAULT_PROFESSOR_PASSWORD, role="professor", faculty_id=faculty_id
            )
            if prof:
                professors.append(prof)
                assign_professor_to_faculty(token, uni_id, faculty_id, prof["id"])

        students = []
        for i in range(STUDENTS_PER_FACULTY):
            student = create_user(
                token, uni_id,
                email=f"student{i+1}.{faculty_short.lower()}{uni_num}@uni{uni_num}.edu",
                name=f"{faculty_name} Student {i+1}",
                password=DEFAULT_STUDENT_PASSWORD, role="student", faculty_id=faculty_id
            )
            if student:
                students.append(student)
                assign_student_to_faculty(token, uni_id, faculty_id, student["id"])

        for subj_idx, subject in enumerate(subject_data):
            subject_id = subject["id"]

            if professors:
                prof = professors[subj_idx % len(professors)]
                assign_professor_to_subject(token, uni_id, faculty_id, subject_id, prof["id"])

            for student in students:
                assign_student_to_subject(token, uni_id, faculty_id, subject_id, student["id"])

            lecture_specs = [
                {"title": "Week 1: Introduction", "description": f"Overview and goals for {faculty_short} - {subject['name']}", "content": "# Week 1: Introduction\n\n- Course overview\n- Expectations\n- Tools and setup\n\n> Remember: practice makes perfect.", "publish": True},
                {"title": "Week 2: Fundamentals", "description": "Core concepts and foundational knowledge", "content": "## Fundamentals\n\n1. Core principles\n2. Key patterns\n3. Common pitfalls\n\n`code samples` will be provided.", "publish": True},
                {"title": "Week 3: Advanced Topics", "description": "Exploring advanced patterns and performance", "content": "### Advanced Topics\n\n- Optimization strategies\n- Scaling considerations\n- Case studies", "publish": False}
            ]

            created_lectures = []
            for spec in lecture_specs:
                lec_obj = create_lecture(token, uni_id, faculty_id, subject_id, title=spec["title"], description=spec["description"], content=spec["content"])
                if not lec_obj:
                    continue
                if spec["publish"]:
                    update_lecture(token, uni_id, faculty_id, subject_id, lecture_id=lec_obj["id"], is_active=True)
                created_lectures.append(lec_obj)

            for student in students:
                s_token = login(student["email"], DEFAULT_STUDENT_PASSWORD)
                if not s_token:
                    continue
                for lect in created_lectures[:2]:
                    note = f"Notes by {student['name']} for {lect['title']}\n\nKey takeaways:\n- {lect['title']} overview covered.\n\nPersonal action items:\n- Review examples from the lecture content."
                    create_lecture_note(s_token, uni_id, faculty_id, subject_id, lect["id"], content=note)

    return uni


def main():
    print("Starting test university creation...")
    print("Authenticating as root...")

    token = login(ROOT_EMAIL, ROOT_PASSWORD)
    if not token:
        print("Failed to authenticate. Check backend is running and credentials match docker-compose.")
        sys.exit(1)

    uni1 = populate_university(token, 1)
    if not uni1:
        print("Failed to setup UNI1")

    uni2 = populate_university(token, 2)
    if not uni2:
        print("Failed to setup UNI2")

    try:
        if uni2:
            backup = create_backup(token, uni2["id"], "Seed backup for UNI2")
            filename = backup.get("filename") if backup else None
            if filename:
                restore_as_temp(token, uni2["id"], filename, "Temporary UNI2 from backup")
    except Exception as e:
        print(f"Skipping backup/restore: {e}")

    print("\nDone. You can verify with: python scripts/show_test_universities.py")


if __name__ == "__main__":
    main()