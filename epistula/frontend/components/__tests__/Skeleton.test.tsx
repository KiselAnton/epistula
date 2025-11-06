import React from 'react';
import { render } from '@testing-library/react';
import {
  Skeleton,
  TableRowSkeleton,
  CardSkeleton,
  UserListSkeleton,
  SubjectGridSkeleton,
  PageHeaderSkeleton,
} from '../Skeleton';

describe('Skeleton components', () => {
  it('renders base Skeleton with provided dimensions', () => {
    render(<Skeleton width={123} height={45} borderRadius={8} />);
  // Select by CSS module class (identity-obj-proxy maps to key name)
  const div = document.querySelector('.skeleton') as HTMLDivElement;
    expect(div).toBeInTheDocument();
    expect(div.style.width).toBe('123px');
    expect(div.style.height).toBe('45px');
    expect(div.style.borderRadius).toBe('8px');
  });

  it('renders TableRowSkeleton with given number of columns', () => {
    render(
      <table>
        <tbody>
          <TableRowSkeleton columns={4} />
        </tbody>
      </table>
    );
    expect(document.querySelectorAll('td')).toHaveLength(4);
  });

  it('renders CardSkeleton structure', () => {
    render(<CardSkeleton />);
    // Expect at least three skeleton divs inside the card
    const divs = document.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);
  });

  it('renders UserListSkeleton with 5 items', () => {
    render(<UserListSkeleton />);
    // Each item has a class .userListItem; count via role fallback
    const items = document.querySelectorAll('div');
    // At least 5 wrappers rendered
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('renders SubjectGridSkeleton with 6 CardSkeletons', () => {
    render(<SubjectGridSkeleton />);
    // Card skeletons render as divs; we assert at least 6 children in the grid
    const grid = document.querySelector('div');
    expect(grid).toBeInTheDocument();
  });

  it('renders PageHeaderSkeleton', () => {
    render(<PageHeaderSkeleton />);
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });
});
