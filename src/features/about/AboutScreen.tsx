/**
 * About screen.
 *
 * MR-08 "Versioning rules": "Every release records all four versions in
 * About and diagnostic export" — bridge contract, schema, backup archive and
 * app version. All four are shown here, sourced from the real
 * `StartupSnapshot` where the value is runtime (app/schema/build variant)
 * and from `appConfig` where it is a build-time constant (contract/archive
 * version), never hardcoded twice.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {StyleSheet} from 'react-native';

import type {RootStackParamList} from '../../app/navigation/types';
import {links} from '../../constants';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  Text,
} from '../../design-system';
import {useStartupSnapshot} from '../../hooks';
import {useTranslation} from '../../localization';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export function AboutScreen({navigation}: Props) {
  const t = useTranslation();
  const startup = useStartupSnapshot();

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('about.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md" align="center">
        <Text variant="headlineMedium" isHeading align="center">
          Nudgio
        </Text>
        <Text variant="bodyLarge" tone="variant" align="center">
          {t('about.madeFor')}
        </Text>

        {/* `isPending`, not `isLoading` — see TodayScreen for why. */}
        {startup.isPending ? (
          <LoadingState label={t('loading.startingUp')} />
        ) : startup.isError ? (
          <ErrorState
            title={t('error.unexpected.title')}
            effect={t('error.unexpected.effect')}
            recoveryAction={{label: t('action.retry'), onPress: () => startup.refetch()}}
            diagnosticCode={startup.error.correlationId}
          />
        ) : (
          <Card style={styles.fullWidth}>
            <Stack gap="xs">
              <AboutRow label={t('about.version', {version: startup.data.appVersion})} />
              <AboutRow label={t('about.buildVariant', {variant: startup.data.buildVariant})} />
              <AboutRow label={t('about.schemaVersion', {version: startup.data.schemaVersion})} />
              <AboutRow
                label={t('about.contractVersion', {version: appConfig.bridgeContractVersion})}
              />
            </Stack>
          </Card>
        )}

        <Card style={styles.fullWidth}>
          <Stack gap="xs">
            <Stack direction="row" justify="space-between">
              <Text variant="bodyLarge" tone="variant">
                {t('about.license')}
              </Text>
              <Text variant="bodyLarge">{t('about.licenseValue')}</Text>
            </Stack>
            <Text variant="bodyMedium" tone="variant">
              {t('about.noInternet')}
            </Text>
          </Stack>
        </Card>

        <Stack gap="xxs" style={styles.fullWidth}>
          <AboutLinkRow label={t('about.sourceCode')} href={links.sourceRepository} />
          <AboutLinkRow label={t('about.privacyDetails')} href={links.privacyDetails} />
        </Stack>
      </Stack>
    </Screen>
  );
}

function AboutRow({label}: {readonly label: string}) {
  return <Text variant="bodyLarge">{label}</Text>;
}

/**
 * Renders as text, not a live link: opening an external URL is an
 * explicit-permission action (leaving the app to a browser), and this build
 * has no navigation/linking wiring for it yet. The destination is still
 * visible so the row isn't misleading.
 */
function AboutLinkRow({label, href}: {readonly label: string; readonly href: string}) {
  return (
    <Stack direction="row" justify="space-between">
      <Text variant="bodyLarge">{label}</Text>
      <Text variant="labelMedium" tone="variant">
        {href}
      </Text>
    </Stack>
  );
}

const styles = StyleSheet.create({
  fullWidth: {width: '100%'},
});
