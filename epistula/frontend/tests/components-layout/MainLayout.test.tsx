/**
 * Tests for MainLayout with university switcher
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('MainLayout - University Switcher', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    pathname: '/dashboard',
    query: {},
    asPath: '/dashboard',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    localStorage.clear();
  });

  describe('Switch University Button Visibility', () => {
    it('should not show switcher button if no user data', () => {
      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
    });

    it('should not show switcher button for single university user', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Single Uni User',
        email: 'single@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Only Uni', university_code: 'ONLY', role: 'professor', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
    });

    it('should show switcher button for multi-university user', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Multi Uni User',
        email: 'multi@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.getByText(/Switch University/i)).toBeInTheDocument();
    });

    it('should not show switcher button for root user', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Root User',
        email: 'root@example.com',
        role: 'root',
        university_access: []
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
    });

    it('should not show switcher button if university_access is undefined', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Legacy User',
        email: 'legacy@example.com',
        role: 'professor',
        universities: [1, 2] // Old format without university_access
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
    });
  });

  describe('Switch University Button Interaction', () => {
    it('should navigate to select-university page when clicked', async () => {
      const user = userEvent.setup();

      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true },
          { university_id: 3, university_name: 'Uni 3', university_code: 'U3', role: 'uni_admin', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      const switchButton = screen.getByText(/Switch University/i);
      await user.click(switchButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/select-university');
      });
    });

    it('should navigate to select-university when switching', async () => {
      const user = userEvent.setup();

      localStorage.setItem('selected_university_id', '1');
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      const switchButton = screen.getByText(/Switch University/i);
      await user.click(switchButton);

      await waitFor(() => {
        // The button should navigate to /select-university
        // (that page will clear selected_university_id on load)
        expect(mockPush).toHaveBeenCalledWith('/select-university');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed user data gracefully', () => {
      localStorage.setItem('user', 'invalid-json');

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should handle empty university_access array', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'No Access User',
        email: 'nouni@example.com',
        role: 'student',
        university_access: []
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByText(/Switch University/i)).not.toBeInTheDocument();
    });

    it('should render children regardless of switcher visibility', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div data-testid="child-content">Child Component</div>
        </MainLayout>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Component')).toBeInTheDocument();
    });
  });

  describe('Multiple Universities Count', () => {
    it('should show switcher for exactly 2 universities', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Two Unis',
        email: 'two@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.getByText(/Switch University/i)).toBeInTheDocument();
    });

    it('should show switcher for more than 2 universities', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'Many Unis',
        email: 'many@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true },
          { university_id: 3, university_name: 'Uni 3', university_code: 'U3', role: 'uni_admin', is_active: true },
          { university_id: 4, university_name: 'Uni 4', university_code: 'U4', role: 'student', is_active: true }
        ]
      }));

      render(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );

      expect(screen.getByText(/Switch University/i)).toBeInTheDocument();
    });
  });
});
