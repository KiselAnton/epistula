import time, random
from .test_utils import DummyUser

def test_student_sees_only_enrolled_subjects_and_faculties(client, set_user):
    # Create as root
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    unique = f"STU{int(time.time()*1000)%1000000}{random.randint(0,999)}"

    # Create university
    uni_resp = client.post("/api/v1/universities/", json={
        "name": f"Student Test U {unique}",
        "code": unique,
        "description": "For student access testing"
    })
    assert uni_resp.status_code == 201
    uni_id = uni_resp.json()["id"]

    # Create two faculties
    f1 = client.post(f"/api/v1/faculties/{uni_id}", json={"name": "F1", "short_name": "F1", "code": f"F1{random.randint(0,999)}"})
    assert f1.status_code == 201
    fid1 = f1.json()["id"]
    f2 = client.post(f"/api/v1/faculties/{uni_id}", json={"name": "F2", "short_name": "F2", "code": f"F2{random.randint(0,999)}"})
    assert f2.status_code == 201
    fid2 = f2.json()["id"]

    # Create subjects in both faculties
    s1 = client.post(f"/api/v1/subjects/{uni_id}/{fid1}", json={"name": "S1", "code": f"S1{random.randint(0,999)}"})
    assert s1.status_code == 201
    sid1 = s1.json()["id"]
    s2 = client.post(f"/api/v1/subjects/{uni_id}/{fid2}", json={"name": "S2", "code": f"S2{random.randint(0,999)}"})
    assert s2.status_code == 201
    sid2 = s2.json()["id"]

    # Create a student user
    stu_resp = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"stud_{unique}@test.edu",
        "name": "Test Student",
        "password": "password123",
        "role": "student",
        "faculty_id": fid1
    })
    assert stu_resp.status_code == 201
    student_id = stu_resp.json()["id"]

    # Enroll student only in S1 (faculty 1)
    enr = client.post(f"/api/v1/subjects/{uni_id}/{fid1}/{sid1}/students", json={"student_id": student_id})
    assert enr.status_code == 201

    # Act as student
    set_user(DummyUser(id=student_id, email=f"stud_{unique}@test.edu", is_root=False))

    # Faculties list should include only fid1
    lf = client.get(f"/api/v1/faculties/{uni_id}")
    assert lf.status_code == 200
    f_ids = {f["id"] for f in lf.json()}
    assert fid1 in f_ids and fid2 not in f_ids

    # Subjects list in faculty 1 should include S1
    ls1 = client.get(f"/api/v1/subjects/{uni_id}/{fid1}")
    assert ls1.status_code == 200
    s1_ids = {s["id"] for s in ls1.json()}
    assert sid1 in s1_ids

    # Subjects list in faculty 2 should be empty for student
    ls2 = client.get(f"/api/v1/subjects/{uni_id}/{fid2}")
    assert ls2.status_code == 200
    assert ls2.json() == []


def test_student_cannot_manage_faculties_or_subjects(client, set_user):
    set_user(DummyUser(id=1, email="root@epistula.edu", is_root=True))
    code = f"STUMGMT{int(time.time()*1000)%1000000}{random.randint(0,999)}"
    uni_resp = client.post("/api/v1/universities/", json={"name": "Mgmt U", "code": code})
    assert uni_resp.status_code == 201
    uni_id = uni_resp.json()["id"]

    f = client.post(f"/api/v1/faculties/{uni_id}", json={"name": "F1", "short_name": "F1", "code": f"MGF{random.randint(0,999)}"})
    assert f.status_code == 201
    fid = f.json()["id"]

    stu_resp = client.post(f"/api/v1/universities/{uni_id}/users", json={
        "email": f"stud_{code}@test.edu",
        "name": "Student",
        "password": "password123",
        "role": "student",
        "faculty_id": fid
    })
    assert stu_resp.status_code == 201
    sid = stu_resp.json()["id"]

    # As student
    set_user(DummyUser(id=sid, email=f"stud_{code}@test.edu", is_root=False))

    # Attempt to create faculty -> 403
    r1 = client.post(f"/api/v1/faculties/{uni_id}", json={"name": "X", "short_name": "X", "code": "X"})
    assert r1.status_code == 403

    # Attempt to create subject -> 403
    r2 = client.post(f"/api/v1/subjects/{uni_id}/{fid}", json={"name": "SS", "code": "SS"})
    assert r2.status_code == 403
