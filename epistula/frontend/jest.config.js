const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // Exclude E2E tests (Playwright), setup files, and utility files from Jest
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/tests-e2e/', 
    '/__tests__/setup/',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(prosemirror-[^/]+|@blocknote/[^/]+)/)',
  ],
  // Use native V8 coverage to avoid babel-plugin-istanbul/test-exclude incompatibilities
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'utils/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
