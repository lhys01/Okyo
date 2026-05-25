import { Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultGroceryList } from '../mocks';

export function GroceryListScreen() {
  return (
    <ScreenScaffold
      title="Grocery list"
      body={defaultGroceryList.title}
    >
      <View>
        {defaultGroceryList.items.map((item) => (
          <Text key={`${item.category}-${item.name}`}>
            {item.category}: {item.quantity} {item.name}
          </Text>
        ))}
      </View>
    </ScreenScaffold>
  );
}
