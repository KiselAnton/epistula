"""Authentication and user management module for Epistula ISO.

This module provides user authentication, role-based access control,
and user management endpoints for the Epistula ISO application.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.orm import Session
import os
import ipaddress
import socket

from utils.models import UserLogin, User, TokenResponse, UserDB
from utils.database import get_db
from middleware.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    db_user_to_pydantic,
)

# Create router
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
) -> TokenResponse:
    """
    Authenticate user and generate JWT token.
    
    Args:
        credentials: User login credentials (email and password)
        db: Database session
        
    Returns:
        TokenResponse with access token and user data
        
    Raises:
        HTTPException: If credentials are invalid
    """
    # Authenticate user
    db_user = authenticate_user(db, credentials.email, credentials.password)
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Enforce root login local-only policy if enabled
    try:
        if db_user.is_root and os.getenv("EPISTULA_ROOT_LOCAL_ONLY", "true").lower() not in ("false", "0", "no"):  # default on
            # Determine client IP (optionally trusting proxy headers)
            trust_proxy = os.getenv("EPISTULA_TRUST_PROXY", "false").lower() in ("true", "1", "yes")
            client_ip = None
            if trust_proxy:
                xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
                if xff:
                    # Use the left-most IP (original client)
                    client_ip = xff.split(",")[0].strip()
            if not client_ip:
                client = request.client
                client_ip = client.host if client else None

            # Build allowed IP networks
            allowed_networks: list[ipaddress._BaseNetwork] = []
            # Loopback IPv4 and IPv6
            allowed_networks.append(ipaddress.ip_network("127.0.0.0/8", strict=False))
            try:
                allowed_networks.append(ipaddress.ip_network("::1/128", strict=False))
            except ValueError:
                pass
            # host.docker.internal (if resolvable) to support Docker on Mac/Windows/Linux
            try:
                host_docker_ip = socket.gethostbyname("host.docker.internal")
                # If resolution differs from localhost, include exact IP
                if host_docker_ip and host_docker_ip != "127.0.0.1":
                    allowed_networks.append(ipaddress.ip_network(f"{host_docker_ip}/32", strict=False))
            except Exception:
                pass
            # Optional extra allowed IPs/CIDRs via env (comma-separated)
            extra = os.getenv("EPISTULA_ROOT_ALLOWED_IPS", "").strip()
            if extra:
                for part in extra.split(","):
                    p = part.strip()
                    if not p:
                        continue
                    try:
                        # Accept single IPs or CIDRs
                        if "/" in p:
                            allowed_networks.append(ipaddress.ip_network(p, strict=False))
                        else:
                            allowed_networks.append(ipaddress.ip_network(f"{p}/32", strict=False))
                    except ValueError:
                        # Ignore invalid entries
                        pass

            # Check client IP against allowed networks
            allowed = False
            try:
                if client_ip:
                    ip_obj = ipaddress.ip_address(client_ip)
                    allowed = any(ip_obj in net for net in allowed_networks)
            except ValueError:
                # Allow special testing hosts and common local hostnames
                lowered = (client_ip or "").lower()
                if lowered in ("testclient", "localhost"):
                    allowed = True
                else:
                    allowed = False

            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Root login is allowed only from the local host",
                )
    except HTTPException:
        # re-raise explicit denials
        raise
    except Exception:
        # On unexpected errors determining client locality, deny by default for safety
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Root login is allowed only from the local host",
        )

    # Create JWT token with user ID as subject (must be string per JWT spec)
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    # Convert DB user to Pydantic model (pass db session to get universities)
    user = db_user_to_pydantic(db_user, db)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.get("/me", response_model=User)
async def get_me(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user information.
    
    Args:
        current_user: Current authenticated user from JWT token
        db: Database session
        
    Returns:
        Current user data
    """
    return db_user_to_pydantic(current_user, db)


@router.post("/logout")
async def logout(
    current_user: UserDB = Depends(get_current_user)
) -> dict:
    """
    Logout current user.
    
    Note: Since we're using stateless JWT tokens, this endpoint primarily
    serves as a confirmation. The client should discard the token.
    In a production system with token blacklisting, we would add the
    token to a blacklist here.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    return {"message": "Successfully logged out"}
