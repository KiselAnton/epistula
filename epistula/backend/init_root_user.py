"""Initialize root user on application startup.

This script:
- Checks if root user exists in the database
- Creates root user from environment variables if not found
- Should be called during FastAPI application startup
"""

import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UserDB
from auth_utils import hash_password


def init_root_user() -> None:
    """
    Initialize root user from environment variables if not exists.
    
    Environment variables required:
    - ROOT_EMAIL: Email address for root user
    - ROOT_PASSWORD: Password for root user (will be hashed)
    
    The root user will have:
    - is_root = True
    - is_active = True
    - name = "Root Administrator"
    """
    root_email = os.getenv("ROOT_EMAIL")
    root_password = os.getenv("ROOT_PASSWORD")
    
    if not root_email or not root_password:
        print("WARNING: ROOT_EMAIL or ROOT_PASSWORD not set. Skipping root user initialization.")
        return
    
    db: Session = SessionLocal()
    
    try:
        # Check if root user already exists
        existing_root = db.query(UserDB).filter(UserDB.is_root == True).first()
        
        if existing_root:
            print(f"Root user already exists: {existing_root.email}")
            return
        
        # Check if a user with the root email exists
        existing_user = db.query(UserDB).filter(UserDB.email == root_email).first()
        
        if existing_user:
            print(f"User with email {root_email} already exists but is not root. Skipping.")
            return
        
        # Create root user
        root_user = UserDB(
            email=root_email,
            password_hash=hash_password(root_password),
            name="Root Administrator",
            is_root=True,
            is_active=True,
        )
        
        db.add(root_user)
        db.commit()
        db.refresh(root_user)
        
        print(f"✓ Root user created successfully: {root_user.email} (ID: {root_user.id})")
        
    except Exception as e:
        db.rollback()
        print(f"ERROR creating root user: {str(e)}")
        raise
    
    finally:
        db.close()


if __name__ == "__main__":
    # Allow running this script directly for testing
    init_root_user()
