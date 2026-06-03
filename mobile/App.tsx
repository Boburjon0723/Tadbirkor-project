import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/theme';
import LoginScreen from './src/screens/auth/LoginScreen';
import OwnerMain from './src/screens/owner/OwnerMain';
import FieldMain from './src/screens/field/FieldMain';
import ProductVariantsScreen from './src/screens/owner/ProductVariantsScreen';
import POSScreen from './src/screens/owner/POSScreen';
import PosCenterScreen from './src/screens/owner/PosCenterScreen';
import POSCartScreen from './src/screens/owner/POSCartScreen';
import NotificationsScreen from './src/screens/owner/NotificationsScreen';
import ProfileScreen from './src/screens/owner/ProfileScreen';
import ReportsScreen from './src/screens/owner/ReportsScreen';
import OrdersListScreen from './src/screens/orders/OrdersListScreen';
import OrderDetailScreen from './src/screens/orders/OrderDetailScreen';
import CreateOrderScreen from './src/screens/orders/CreateOrderScreen';
import DebtsListScreen from './src/screens/debts/DebtsListScreen';
import DebtDetailScreen from './src/screens/debts/DebtDetailScreen';
import PosCustomersScreen from './src/screens/pos/PosCustomersScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isDark } = useTheme();
  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OwnerMain" component={OwnerMain} />
        <Stack.Screen name="SalesMain" component={PosCenterScreen} />
        <Stack.Screen name="POSTerminal" component={POSScreen} />
        <Stack.Screen name="FieldMain" component={FieldMain} />
        <Stack.Screen name="ProductVariants" component={ProductVariantsScreen} />
        <Stack.Screen name="POSCart" component={POSCartScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="OrdersList" component={OrdersListScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="CreateOrder" component={CreateOrderScreen} />
        <Stack.Screen name="DebtsList" component={DebtsListScreen} />
        <Stack.Screen name="DebtDetail" component={DebtDetailScreen} />
        <Stack.Screen name="PosCustomers" component={PosCustomersScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
