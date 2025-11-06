import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityCard from '../EntityCard';

// Mock next/image to render a simple img element
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));
/* eslint-enable @next/next/no-img-element, jsx-a11y/alt-text */

// Mock MarkdownDisplay to render plain content without dynamic import
jest.mock('../MarkdownDisplay', () => ({
  __esModule: true,
  default: ({ content }: any) => <div>{content}</div>,
}));

// Mock backend URL helper used inside EntityCard
jest.mock('../../../utils/api', () => ({
  getBackendUrl: () => 'http://localhost:8000',
}));

describe('EntityCard', () => {
  it('renders title, subtitle and icon fallback when no logo', () => {
    render(<EntityCard title="Document" subtitle="Sub" icon="🎓" />);
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
    // Fallback icon should be visible
    expect(screen.getByText('🎓')).toBeInTheDocument();
  });

  it('renders image when logoUrl provided', () => {
    render(<EntityCard title="With Logo" logoUrl="/files/logo.png" />);
    const img = screen.getByAltText('With Logo') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('http://localhost:8000/files/logo.png');
  });

  it('renders badge, description and footer; click triggers handler', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <EntityCard
        title="T"
        subtitle="S"
        description="**Bold** description"
        footer={<div>Footer Content</div>}
        badge={{ text: 'NEW', color: '#0f0' }}
        onClick={onClick}
      />
    );

    // Badge text
    expect(screen.getByText('NEW')).toBeInTheDocument();
    // Subtitle
    expect(screen.getByText('S')).toBeInTheDocument();
    // Footer
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  // Description is rendered by MarkdownDisplay mock - assert content presence
  expect(screen.getByText(/description/)).toBeInTheDocument();

    // Clicking the title should bubble to the card onClick
    await user.click(screen.getByText('T'));
    expect(onClick).toHaveBeenCalled();
  });
});
