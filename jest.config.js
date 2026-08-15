module.exports = {
  preset: 'jest-expo',
  // Domain and persistence tests run in Node: they exercise the real SQLite
  // engine through the node:sqlite test adapter and need no UI runtime.
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
