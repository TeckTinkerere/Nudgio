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
import {Linking, StyleSheet} from 'react-native';

import type {RootStackParamList} from '../../app/navigation/types';
import {links} from '../../constants';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Card,
  ErrorState,
  Icon,
  ListRow,
  LoadingState,
  Screen,
  Stack,
  Text,
  useFloatingAppBar,
  useTheme,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useStartupSnapshot} from '../../hooks';
import {useTranslation} from '../../localization';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export function AboutScreen({navigation}: Props) {
  const t = useTranslation();
  const theme = useTheme();
  const startup = useStartupSnapshot();
  const appBar = useFloatingAppBar();

  const heroStyles = StyleSheet.create({
    circle: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.primaryContainer,
    },
  });

  return (
    <Screen
      hasAppBar
      scrollable
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={t('about.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      <Stack gap="lg" paddingVertical="md" align="center">
        <Stack style={heroStyles.circle} align="center" justify="center">
          <Text variant="headlineMedium" isHeading style={{color: theme.color.onPrimaryContainer}}>
            N
          </Text>
        </Stack>
        <Stack gap={2} align="center">
          <Text variant="headlineMedium" isHeading align="center">
            Nudgio
          </Text>
          <Text variant="bodyLarge" tone="variant" align="center">
            {t('about.madeFor')}
          </Text>
        </Stack>

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
            <Stack direction="row" align="center" gap="xxs">
              <Icon name="lock" size="xs" color={theme.color.onSurfaceVariant} />
              <Text variant="bodyMedium" tone="variant">
                {t('about.noInternet')}
              </Text>
            </Stack>
          </Stack>
        </Card>

        <Stack gap={2} style={styles.fullWidth}>
          <AboutLinkRow icon="share" label={t('about.sourceCode')} href={links.sourceRepository} />
          <AboutLinkRow icon="lock" label={t('about.privacyDetails')} href={links.privacyDetails} />
        </Stack>
      </Stack>
    </Screen>
  );
}

function AboutRow({label}: {readonly label: string}) {
  return <Text variant="bodyLarge">{label}</Text>;
}

/**
 * A real tappable row (`Linking.openURL`) — previously rendered as plain
 * text with the raw URL beside it because no linking was wired up at all.
 * Opening the OS browser needs no permission from this app (the browser,
 * not Nudgio, makes the request), so it does not touch MR-06's "no network
 * access" invariant — that rule is about Nudgio's own manifest/runtime, not
 * about a link a user chose to follow out of it.
 */
function AboutLinkRow({icon, label, href}: {readonly icon: IconName; readonly label: string; readonly href: string}) {
  const theme = useTheme();
  return (
    <ListRow
      title={label}
      leading={<Icon name={icon} color={theme.color.onSurfaceVariant} />}
      trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
      onPress={() => {
        // eslint-disable-next-line no-void
        void Linking.openURL(href);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fullWidth: {width: '100%'},
});
