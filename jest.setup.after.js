/**
 * Jest setup that runs after the test framework is installed.
 *
 * `@testing-library/react-native` v13+ registers its Jest matchers
 * (`toBeVisible`, `toHaveTextContent`, ...) automatically when imported —
 * there is no separate `/extend-expect` entry point to require anymore.
 */

// MR-18 forbids `console` in product code. Fail loudly if a test surfaces one,
// so a stray log never reaches a release bundle unnoticed.
const failOnConsole = method => {
  const original = console[method];
  console[method] = (...args) => {
    original(...args);
    throw new Error(
      `console.${method} was called during a test. Use the injected Logger instead.\n${args.join(' ')}`,
    );
  };
};

beforeAll(() => {
  failOnConsole('error');
  failOnConsole('warn');
});

afterEach(() => {
  jest.clearAllMocks();
});
