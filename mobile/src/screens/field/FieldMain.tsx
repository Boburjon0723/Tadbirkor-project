import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Box, LogOut } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { confirmLogout } from '../../auth/session';

import MyTasksScreen from './MyTasksScreen';
import MyStockScreen from './MyStockScreen';

const Tab = createBottomTabNavigator();

export default function FieldMain({ navigation }: any) {
  const handleLogout = () => {
    confirmLogout(navigation);
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#080808',
          borderTopWidth: 1,
          borderTopColor: '#222',
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen 
        name="MyTasks" 
        component={MyTasksScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          tabBarLabel: 'Vazifalar',
          headerShown: true,
          headerTitle: 'Dala xodimi',
          headerStyle: { backgroundColor: '#050505', shadowOpacity: 0, elevation: 0 },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
              <LogOut color="#ff4444" size={24} />
            </TouchableOpacity>
          )
        }}
      />
      <Tab.Screen 
        name="MyStock" 
        component={MyStockScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Box color={color} size={size} />,
          tabBarLabel: 'Omborim',
          headerShown: true,
          headerTitle: 'Dala xodimi',
          headerStyle: { backgroundColor: '#050505', shadowOpacity: 0, elevation: 0 },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
              <LogOut color="#ff4444" size={24} />
            </TouchableOpacity>
          )
        }}
      />
    </Tab.Navigator>
  );
}
