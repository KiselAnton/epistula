# Hosting Epistula Under a Custom Domain

## Overview

Epistula's frontend uses Next.js rewrites to proxy API calls to the backend, ensuring seamless operation whether running locally or hosted under a custom domain like `epistula.com`.

## How It Works

### Local Development (localhost:3000)

- **Frontend**: Runs on `http://localhost:3000`
- **Backend**: Runs on `http://localhost:8000`
- **API Calls**: Frontend makes relative requests to `/api/v1/*`
- **Proxy**: Next.js rewrites `/api/v1/*` → `http://localhost:8000/api/v1/*`
- **No CORS Issues**: All requests appear same-origin to the browser

### Production (epistula.com)

- **Frontend**: Serves from `https://epistula.com`
- **Backend**: Runs on internal service or separate server
- **API Calls**: Frontend still uses relative `/api/v1/*`
- **Proxy**: Next.js rewrites `/api/v1/*` → backend URL
- **No CORS Issues**: Requests are proxied server-side

## Configuration

### Environment Variables

Set these environment variables for deployment:

```bash
# Backend URL (used by Next.js server-side rewrites)
INTERNAL_BACKEND_URL=http://backend-service:8000
# or for external backend:
INTERNAL_BACKEND_URL=https://api.epistula.com

# Frontend public URL (for client-side fallbacks)
NEXT_PUBLIC_BACKEND_URL=https://api.epistula.com

# Root user email
NEXT_PUBLIC_ROOT_EMAIL=admin@epistula.com
```

### Next.js Rewrites (next.config.js)

The following rewrites are configured:

```javascript
async rewrites() {
  const internalBackendUrl = process.env.INTERNAL_BACKEND_URL 
    || process.env.NEXT_PUBLIC_BACKEND_URL 
    || 'http://localhost:8000';
  
  return [
    {
      source: '/api/v1/:path*',
      destination: `${internalBackendUrl}/api/v1/:path*`,
    },
    {
      source: '/storage/:path*',
      destination: `${internalBackendUrl}/storage/:path*`,
    },
  ];
}
```

## Deployment Scenarios

### Scenario 1: Same Host (Recommended)

Deploy frontend and backend on the same server with reverse proxy:

```nginx
# Nginx example
server {
  server_name epistula.com;
  
  # Frontend (Next.js)
  location / {
    proxy_pass http://localhost:3000;
  }
  
  # Backend (FastAPI) - optional direct access
  location /api {
    proxy_pass http://localhost:8000/api;
  }
  
  location /storage {
    proxy_pass http://localhost:8000/storage;
  }
}
```

**Environment:**
```bash
INTERNAL_BACKEND_URL=http://localhost:8000
```

### Scenario 2: Separate Hosts

Frontend on one server, backend on another:

**Frontend Server:**
```bash
INTERNAL_BACKEND_URL=https://api.epistula.com
NEXT_PUBLIC_BACKEND_URL=https://api.epistula.com
```

**Backend Server:**
Configure CORS to allow frontend domain:
```python
# backend/main.py
origins = [
    "https://epistula.com",
    "https://www.epistula.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Scenario 3: Docker Compose

Use Docker network for internal communication:

```yaml
version: '3.8'
services:
  backend:
    image: epistula/backend
    networks:
      - epistula-net
  
  frontend:
    image: epistula/frontend
    environment:
      - INTERNAL_BACKEND_URL=http://backend:8000
      - NEXT_PUBLIC_BACKEND_URL=https://api.epistula.com
    networks:
      - epistula-net
    ports:
      - "3000:3000"

networks:
  epistula-net:
```

## API Call Flow

### Client-Side Request
```typescript
// Frontend code
const response = await fetch('/api/v1/subjects/1/2/3/lectures', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Request Path
1. Browser → `https://epistula.com/api/v1/subjects/1/2/3/lectures`
2. Next.js server receives request
3. Next.js rewrites to `${INTERNAL_BACKEND_URL}/api/v1/subjects/1/2/3/lectures`
4. Backend processes and returns response
5. Next.js forwards response to browser
6. No CORS needed (same-origin for browser)

## Benefits

✅ **No CORS Issues**: All requests appear same-origin  
✅ **Single Domain**: Users only see `epistula.com`  
✅ **Flexible Backend**: Backend can be anywhere  
✅ **Secure**: Backend URL hidden from client  
✅ **Simple Migration**: Change backend location without frontend code changes

## Testing Domain Setup Locally

Simulate production by editing your hosts file:

### Windows (`C:\Windows\System32\drivers\etc\hosts`)
```
127.0.0.1 epistula.local
127.0.0.1 api.epistula.local
```

### Linux/macOS (`/etc/hosts`)
```
127.0.0.1 epistula.local
127.0.0.1 api.epistula.local
```

Then access `http://epistula.local:3000` in your browser.

## Troubleshooting

### Issue: 404 on API calls

**Symptom**: API requests return 404  
**Cause**: Next.js rewrites not configured or wrong URL  
**Fix**: Verify `INTERNAL_BACKEND_URL` and check `next.config.js`

### Issue: CORS errors

**Symptom**: CORS policy blocks requests  
**Cause**: Frontend making direct requests to backend (bypassing Next.js)  
**Fix**: Use relative URLs (`/api/v1/*`) instead of absolute (`http://backend:8000/api/v1/*`)

### Issue: 502 Bad Gateway

**Symptom**: Proxy errors from Next.js  
**Cause**: Backend not reachable from Next.js server  
**Fix**: Check `INTERNAL_BACKEND_URL` points to accessible backend

## Summary

The key principle: **Frontend always uses relative URLs**, Next.js handles the proxying. This architecture:

- Simplifies deployment
- Eliminates CORS complexity
- Allows flexible backend placement
- Works identically in development and production
