import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function ResultSummaryScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Result summary"
      body="Placeholder result summary with estimated costs and confidence coming next."
      primaryActionLabel="View Recipe"
      onPrimaryAction={() => navigation.navigate('RecipeDetailScreen' as never)}
      secondaryActionLabel="Share Preview"
      onSecondaryAction={() => navigation.navigate('ShareCardPreviewScreen' as never)}
    />
  );
}
