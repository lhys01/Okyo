import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { captureAppError } from './sentry';
export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error: Error) { captureAppError(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{flex:1,justifyContent:'center',padding:24}}>
      <Text>Okyo couldn’t open this screen.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Try opening Okyo again" style={{paddingVertical:20}}
        onPress={()=>this.setState({failed:false})}><Text>Try again</Text></Pressable>
    </View>;
  }
}
