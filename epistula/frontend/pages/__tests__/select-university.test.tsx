/**
 * Tests for University Selector page
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import SelectUniversity from '../select-university';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe('SelectUniversity Page', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    pathname: '/select-university',
    query: {},
    asPath: '/select-university',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    localStorage.clear();
  });

  describe('No authentication', () => {
    it('should redirect to login if no token', async () => {
      render(<SelectUniversity />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should redirect to login if no user data', async () => {
      localStorage.setItem('token', 'fake-token');

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Root user', () => {
    it('should redirect root user to dashboard', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        role: 'root',
        email: 'root@example.com',
        university_access: []
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Single university', () => {
    it('should redirect directly if user has only one university', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        role: 'professor',
        email: 'prof@example.com',
        university_access: [
          {
            university_id: 1,
            university_name: 'Test University',
            university_code: 'TEST',
            role: 'professor',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/university/1');
        expect(localStorage.getItem('selected_university_id')).toBe('1');
      });
    });
  });

  describe('Multiple universities', () => {
    it('should display university selector for multiple universities', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'professor',
        university_access: [
          {
            university_id: 1,
            university_name: 'Harvard University',
            university_code: 'HARV',
            role: 'professor',
            is_active: true
          },
          {
            university_id: 2,
            university_name: 'MIT',
            university_code: 'MIT',
            role: 'student',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome, John Doe!/i)).toBeInTheDocument();
        expect(screen.getByText(/You have access to 2 universities/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Harvard University')).toBeInTheDocument();
      expect(screen.getByText('MIT')).toBeInTheDocument();
      expect(screen.getByText('Code: HARV')).toBeInTheDocument();
      expect(screen.getByText('Code: MIT')).toBeInTheDocument();
    });

    it('should show correct role badges', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'uni_admin',
        university_access: [
          {
            university_id: 1,
            university_name: 'University A',
            university_code: 'UNI_A',
            role: 'uni_admin',
            is_active: true
          },
          {
            university_id: 2,
            university_name: 'University B',
            university_code: 'UNI_B',
            role: 'professor',
            is_active: true
          },
          {
            university_id: 3,
            university_name: 'University C',
            university_code: 'UNI_C',
            role: 'student',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText('University A')).toBeInTheDocument();
      });

      // Check role badges
      expect(screen.getByText('uni admin')).toBeInTheDocument();
      expect(screen.getByText('professor')).toBeInTheDocument();
      expect(screen.getByText('student')).toBeInTheDocument();
    });

    it('should navigate to selected university', async () => {
      const user = userEvent.setup();
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          {
            university_id: 1,
            university_name: 'University 1',
            university_code: 'UNI1',
            role: 'professor',
            is_active: true
          },
          {
            university_id: 2,
            university_name: 'University 2',
            university_code: 'UNI2',
            role: 'student',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText('University 1')).toBeInTheDocument();
      });

      const uni2Button = screen.getByText('University 2').closest('button');
      expect(uni2Button).toBeInTheDocument();

      if (uni2Button) {
        await user.click(uni2Button);

        await waitFor(() => {
          expect(localStorage.getItem('selected_university_id')).toBe('2');
          expect(mockPush).toHaveBeenCalledWith('/university/2');
        });
      }
    });

    it('should handle logout', async () => {
      const user = userEvent.setup();
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          {
            university_id: 1,
            university_name: 'University 1',
            university_code: 'UNI1',
            role: 'professor',
            is_active: true
          },
          {
            university_id: 2,
            university_name: 'University 2',
            university_code: 'UNI2',
            role: 'student',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText('University 1')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText(/logout/i);
      await user.click(logoutButton);

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(localStorage.getItem('selected_university_id')).toBeNull();
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('No university access', () => {
    it('should show error and logout if user has no universities', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        role: 'student',
        email: 'nouni@example.com',
        university_access: []
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('do not have access')
        );
        expect(localStorage.getItem('token')).toBeNull();
        expect(mockPush).toHaveBeenCalledWith('/');
      });

      alertSpy.mockRestore();
    });
  });

  describe('Display with logos', () => {
    it('should display university logos when available', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          {
            university_id: 1,
            university_name: 'University with Logo',
            university_code: 'UWL',
            role: 'professor',
            is_active: true,
            logo_url: '/storage/logos/uni1.png'
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/university/1');
      });
    });

    it('should show placeholder emoji when no logo', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        role: 'professor',
        university_access: [
          {
            university_id: 1,
            university_name: 'University 1',
            university_code: 'UNI1',
            role: 'professor',
            is_active: true
          },
          {
            university_id: 2,
            university_name: 'University 2',
            university_code: 'UNI2',
            role: 'student',
            is_active: true
          }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText('University 1')).toBeInTheDocument();
      });

      // Should show placeholder emojis
      const placeholders = screen.getAllByText('🎓');
      expect(placeholders.length).toBe(2);
    });
  });

  describe('User name display', () => {
    it('should display user name if available', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome, Alice Johnson!/i)).toBeInTheDocument();
      });
    });

    it('should fallback to email if name not available', async () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        email: 'bob@example.com',
        role: 'professor',
        university_access: [
          { university_id: 1, university_name: 'Uni 1', university_code: 'U1', role: 'professor', is_active: true },
          { university_id: 2, university_name: 'Uni 2', university_code: 'U2', role: 'student', is_active: true }
        ]
      }));

      render(<SelectUniversity />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome, bob@example.com!/i)).toBeInTheDocument();
      });
    });
  });
});
