# Epistula Frontend Setup Guide

## Overview

The Epistula frontend is built with Next.js (React) and TypeScript, providing a modern web interface for the application. The first version runs locally and is accessible via IP address.

## Technology Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: CSS Modules
- **API Communication**: Fetch API

## Project Structure

```
frontend/
├── pages/
│   ├── _app.tsx          # Next.js app wrapper
│   └── index.tsx         # Login page (default route)
├── styles/
│   ├── globals.css       # Global styles
│   └── Login.module.css  # Login page styles
├── next.config.js        # Next.js configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript configuration
```

## Installation

1. **Navigate to the frontend directory**:
   ```bash
   cd epistula/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional):
   The frontend is configured to connect to `http://localhost:8000` by default.
   To change this, set the `BACKEND_URL` environment variable:
   ```bash
   export BACKEND_URL=http://your-server-ip:8000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

5. **Build for production** (optional):
   ```bash
   npm run build
   npm start
   ```

## Login Page

The login page (`pages/index.tsx`) is the entry point of the application. It provides a clean, modern interface for user authentication.

### Features:

- **Username/Password Authentication**: Users log in with their username and password
- **Error Handling**: Clear error messages for failed login attempts
- **Loading States**: Visual feedback during authentication
- **Responsive Design**: Works on desktop and mobile devices

### First-Time Admin Login

On the first launch of Epistula, the system requires an administrator to set up the application:

- **Username**: `Administrator`
- **Password**: The server password (the same password used to access the server)

This admin account has full access to manage the application and create other user accounts.

### API Integration

The login page connects to the backend API at:
```
POST /api/v1/users/login
```

**Request Body**:
```json
{
  "email": "username",
  "password": "password"
}
```

**Response**:
```json
{
  "access_token": "jwt-token-here",
  "token_type": "bearer"
}
```

The access token is stored in localStorage and used for subsequent API requests.

## Network Access

By default, the Next.js development server only listens on localhost. To make it accessible from other devices on your network:

### Development Mode:
```bash
npm run dev -- -H 0.0.0.0
```

Or modify `package.json`:
```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0"
  }
}
```

Then access the application at:
- Local: `http://localhost:3000`
- Network: `http://your-ip-address:3000`

### Production Mode:
```bash
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

## Styling

The application uses CSS Modules for component-scoped styling:

- **Global Styles** (`styles/globals.css`): CSS reset, base typography, and global styles
- **Login Styles** (`styles/Login.module.css`): Login page specific styles with modern gradient design

## Configuration

The `next.config.js` file contains:

- **React Strict Mode**: Enabled for better development experience
- **Environment Variables**: Backend URL configuration

## Common Issues

### Cannot Connect to Backend

**Problem**: Login fails with "Unable to connect to server"

**Solutions**:
1. Ensure the backend is running on `http://localhost:8000`
2. Check that CORS is configured on the backend to allow frontend origin
3. Verify the BACKEND_URL environment variable

### Port Already in Use

**Problem**: "Port 3000 is already in use"

**Solution**: Use a different port
```bash
npm run dev -- -p 3001
```

## Development Workflow

1. **Start the backend** (in separate terminal):
   ```bash
   cd epistula/backend
   python -m uvicorn main:app --reload
   ```

2. **Start the frontend**:
   ```bash
   cd epistula/frontend
   npm run dev
   ```

3. **Access the application**:
   - Open browser to `http://localhost:3000`
   - Log in with Administrator credentials

## Next Steps

After setting up the frontend:

1. Test the login functionality with the Administrator account
2. Explore the backend API endpoints
3. Add additional pages and components as needed
4. Configure for production deployment

## Support

For issues or questions:
- Check the main [README.md](README.md)
- Review the [USER_GUIDE.md](USER_GUIDE.md)
- Open an issue on GitHub
