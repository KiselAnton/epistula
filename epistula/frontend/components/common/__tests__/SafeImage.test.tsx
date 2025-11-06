import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SafeImage from '../SafeImage';

// Mock next/image to a passthrough img so we can trigger onError
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe('SafeImage', () => {
  it('renders underlying image when no error', () => {
    render(<SafeImage src="/logo.png" alt="Logo" width={60} height={60} />);
    const img = screen.getByAltText('Logo');
    expect(img.tagName).toBe('IMG');
  });

  it('renders fallback container and icon on error', async () => {
    render(<SafeImage src="/broken.png" alt="Faculty Logo" width={60} height={60} className="thumb" fallbackIcon={<span>FALL</span>} />);
    const img = screen.getByAltText('Faculty Logo');
    // Trigger error on the mocked img to flip into fallback mode
    fireEvent.error(img);

    // Fallback should appear with aria-label and contain our icon
    await waitFor(() => expect(screen.getByLabelText('Faculty Logo')).toBeInTheDocument());
    const fallback = screen.getByLabelText('Faculty Logo');
    expect(fallback).toHaveTextContent('FALL');
    // className should be forwarded to the fallback container
    expect(fallback).toHaveClass('thumb');
  });
});
