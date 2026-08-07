/**
 * Jest setup that must run before the module registry is populated.
 *
 * Native side effects are stubbed here so that no unit test can accidentally
 * reach a real TurboModule. The typed in-memory fake used by feature tests
 * lives in `src/native-client/mockNativeModule.ts`.
 */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-safe-area-context', () => {
  const inset = {top: 24, right: 0, bottom: 16, left: 0};
  const frame = {x: 0, y: 0, width: 412, height: 915};
  return {
    SafeAreaProvider: ({children}) => children,
    SafeAreaConsumer: ({children}) => children(inset),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: {insets: inset, frame},
  };
});

// The native module is not mocked here. `TurboModuleRegistry.get` already
// returns null under Jest, which is exactly the "bridge unavailable" path the
// client is designed to handle. Tests that need real data install a typed fake
// with `installMockNativeModule()` from '@/native-client'.
