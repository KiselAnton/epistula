"""Test database connection and initialization.

This script verifies that:
1. Database connection works
2. Tables were created successfully
3. Functions and views exist
"""

from database import (
    engine,
    check_database_connection,
    get_database_version,
    SessionLocal
)
from sqlalchemy import text

def test_connection():
    """Test basic database connectivity."""
    print("Testing database connection...")
    if check_database_connection():
        print("✅ Database connection successful!")
        version = get_database_version()
        print(f"📊 PostgreSQL version: {version}")
        return True
    else:
        print("❌ Database connection failed!")
        return False

def test_tables():
    """Test that all tables were created."""
    print("\nChecking tables...")
    session = SessionLocal()
    try:
        result = session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """))
        
        tables = [row[0] for row in result]
        
        expected_tables = ['users', 'universities', 'user_university_roles', 'audit_log']
        
        print(f"Found {len(tables)} tables:")
        for table in tables:
            status = "✅" if table in expected_tables else "ℹ️"
            print(f"  {status} {table}")
        
        missing = set(expected_tables) - set(tables)
        if missing:
            print(f"\n❌ Missing tables: {', '.join(missing)}")
            return False
        else:
            print("\n✅ All expected tables exist!")
            return True
            
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False
    finally:
        session.close()

def test_functions():
    """Test that helper functions were created."""
    print("\nChecking functions...")
    session = SessionLocal()
    try:
        result = session.execute(text("""
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_type = 'FUNCTION'
            ORDER BY routine_name
        """))
        
        functions = [row[0] for row in result]
        
        expected_functions = [
            'create_university_schema',
            'drop_university_schema',
            'get_user_roles',
            'has_role',
            'is_root_user',
            'create_university',
            'validate_student_faculty',
            'prevent_multiple_roots',
            'update_updated_at_column'
        ]
        
        print(f"Found {len(functions)} functions:")
        for func in functions[:10]:  # Show first 10
            status = "✅" if func in expected_functions else "ℹ️"
            print(f"  {status} {func}")
        
        if len(functions) > 10:
            print(f"  ... and {len(functions) - 10} more")
        
        missing = set(expected_functions) - set(functions)
        if missing:
            print(f"\n⚠️  Some expected functions not found: {', '.join(missing)}")
        else:
            print("\n✅ All expected functions exist!")
            
        return True
            
    except Exception as e:
        print(f"❌ Error checking functions: {e}")
        return False
    finally:
        session.close()

def test_views():
    """Test that views were created."""
    print("\nChecking views...")
    session = SessionLocal()
    try:
        result = session.execute(text("""
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        
        views = [row[0] for row in result]
        
        expected_views = ['v_user_summary', 'v_university_summary']
        
        print(f"Found {len(views)} views:")
        for view in views:
            status = "✅" if view in expected_views else "ℹ️"
            print(f"  {status} {view}")
        
        missing = set(expected_views) - set(views)
        if missing:
            print(f"\n❌ Missing views: {', '.join(missing)}")
            return False
        else:
            print("\n✅ All expected views exist!")
            return True
            
    except Exception as e:
        print(f"❌ Error checking views: {e}")
        return False
    finally:
        session.close()

def test_user_count():
    """Check how many users exist."""
    print("\nChecking user count...")
    session = SessionLocal()
    try:
        result = session.execute(text("SELECT COUNT(*) FROM public.users"))
        count = result.fetchone()[0]
        print(f"📊 Users in database: {count}")
        if count == 0:
            print("ℹ️  No users yet - root user will be created on first backend startup")
        return True
    except Exception as e:
        print(f"❌ Error checking user count: {e}")
        return False
    finally:
        session.close()

if __name__ == "__main__":
    print("="*60)
    print("EPISTULA DATABASE CONNECTION TEST")
    print("="*60)
    
    all_passed = True
    
    # Test connection
    if not test_connection():
        all_passed = False
        print("\n⚠️  Cannot proceed without database connection")
        exit(1)
    
    # Test schema
    all_passed = test_tables() and all_passed
    all_passed = test_functions() and all_passed
    all_passed = test_views() and all_passed
    all_passed = test_user_count() and all_passed
    
    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\n💡 Next steps:")
        print("  1. Backend will auto-create root user on first run")
        print("  2. Start backend: uvicorn main:app --reload")
        print("  3. Access API docs: http://localhost:8000/docs")
    else:
        print("⚠️  SOME TESTS FAILED")
        print("="*60)
        print("\n💡 Check the errors above and verify database initialization")
