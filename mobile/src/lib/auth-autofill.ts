import { Platform, type TextInputProps } from 'react-native';

/** Tizim (iOS Keychain / Android Autofill) login va parolni eslab qolishi uchun */
export const loginFieldAutofill: TextInputProps = {
  textContentType: 'username',
  autoComplete: 'username',
  autoCorrect: false,
  spellCheck: false,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'yes' } : {}),
};

export const passwordFieldAutofill: TextInputProps = {
  textContentType: 'password',
  autoComplete: 'password',
  autoCorrect: false,
  spellCheck: false,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'yes' } : {}),
};

export const newPasswordFieldAutofill: TextInputProps = {
  textContentType: 'newPassword',
  autoComplete: 'password-new',
  autoCorrect: false,
  spellCheck: false,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'yes' } : {}),
};
