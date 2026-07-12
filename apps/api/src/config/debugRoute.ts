export function isAiDebugRouteAvailable(nodeEnvironment: string | undefined) {
  return nodeEnvironment !== 'production';
}
