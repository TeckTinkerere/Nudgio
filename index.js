/**
 * React Native entry point.
 *
 * Nothing but registration belongs here. All bootstrap sequencing lives in
 * `src/app/bootstrap` so it is testable without the AppRegistry.
 */
import {AppRegistry} from 'react-native';

import {App} from './src/app/App';
import {appConfig} from './src/core/config/appConfig';

AppRegistry.registerComponent(appConfig.registeredAppName, () => App);
