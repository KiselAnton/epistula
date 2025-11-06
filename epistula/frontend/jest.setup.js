// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Silence console warnings/errors during tests to keep output clean.
// Individual tests can spy/assert explicitly when needed.
let __errorSpy__;
let __warnSpy__;
beforeAll(() => {
  __errorSpy__ = jest.spyOn(console, 'error').mockImplementation(() => {});
  __warnSpy__ = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  __errorSpy__ && __errorSpy__.mockRestore();
  __warnSpy__ && __warnSpy__.mockRestore();
});
