declare module 'react-native/Libraries/Core/ExceptionsManager' {
  export function handleException(err: Error, isFatal: boolean): void;
}

declare module 'react-native-web-refresh-control';

declare module '@anythingai/app/screens/launcher-menu' {
  import type { ComponentType } from 'react';
  const LauncherMenuContainer: ComponentType<Record<string, never>>;
  export default LauncherMenuContainer;
}

declare module '@anythingai/app/utils';
