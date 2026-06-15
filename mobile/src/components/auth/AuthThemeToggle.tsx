import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../../theme';

export function AuthThemeToggle() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.option, isDark && styles.optionActive]}
        onPress={() => { if (!isDark) toggleTheme(); }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Qora mavzu"
      >
        <Moon size={16} color={isDark ? '#fff' : colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, !isDark && styles.optionActiveLight]}
        onPress={() => { if (isDark) toggleTheme(); }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Oq mavzu"
      >
        <Sun size={16} color={!isDark ? '#fff' : colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      gap: 4,
    },
    option: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionActive: {
      backgroundColor: '#1e293b',
    },
    optionActiveLight: {
      backgroundColor: '#3b82f6',
    },
  });
