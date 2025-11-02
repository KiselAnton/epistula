import type { NextApiRequest, NextApiResponse } from 'next'

// Simple inline SVG favicon (letter E)
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" ry="12" fill="#0d6efd"/>
  <path d="M20 18h24v8H28v6h14v8H28v6h16v8H20V18z" fill="#ffffff"/>
</svg>`;

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'image/svg+xml');
  // Cache for a week
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.status(200).send(svg);
}
