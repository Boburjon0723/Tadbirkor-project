import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme, type ThemeColors } from '../../theme';

const LOGO = require('../../../assets/icon.png');

type AuthBrandHeaderProps = {
  size?: number;
  compact?: boolean;
};

export function AuthBrandHeader({ size, compact = false }: AuthBrandHeaderProps) {
  const { colors, isDark } = useTheme();
  const logoSize = size ?? (compact ? 44 : 56);
  const styles = getStyles(colors, isDark, logoSize, compact);

  return (
    <View style={styles.wrap}>
      <View style={styles.logoShell}>
        <Image source={LOGO} style={styles.logo} resizeMode="cover" accessibilityLabel="Axis ERP logotipi" />
      </View>
      <Text style={styles.brandName}>
        Axis <Text style={styles.brandAccent}>ERP</Text>
      </Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean, size: number, compact: boolean) =>
  StyleSheet.create({
    wrap: {
      flexDirection: compact ? 'row' : 'column',
      alignItems: 'center',
      gap: compact ? 10 : 8,
      marginBottom: compact ? 0 : 16,
      flexShrink: 1,
    },
    logoShell: {
      width: size,
      height: size,
      borderRadius: size * 0.22,
      overflow: 'hidden',
      backgroundColor: isDark ? '#0a1628' : '#eef2ff',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
      shadowColor: '#3b82f6',
      shadowOffset: { width: 0, height: compact ? 4 : 6 },
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: compact ? 8 : 12,
      elevation: compact ? 4 : 6,
    },
    logo: {
      width: '100%',
      height: '100%',
    },
    brandName: {
      fontSize: compact ? 20 : 22,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 0.4,
    },
    brandAccent: {
      color: '#3b82f6',
    },
  });
