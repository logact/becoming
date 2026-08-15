// UI tests render screens without a real device safe area; mock the
// safe-area context so insets are zero and no provider is required.
// The library's v5 mock is an ESM module whose exports land on `.default`.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
