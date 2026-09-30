import {Image, StyleSheet} from 'react-native';

/** Approved artwork; never tint it or replace its gradients with theme colours. */
export function BrandLogo() {
  return (
    <Image
      source={require('../../../assets/brand/nudgio-logo.jpg')}
      style={styles.logo}
      resizeMode="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  logo: {width: 128, height: 128, borderRadius: 24},
});
