// Remove console calls from production bundles, including their arguments.
// Reporting through the explicitly sanitized Sentry transport is unaffected.
module.exports = function stripReleaseConsole({ types }) {
  return {
    visitor: {
      CallExpression(path) {
        if (!types.isMemberExpression(path.node.callee) ||
            !types.isIdentifier(path.node.callee.object, { name: 'console' }) ||
            path.scope.hasBinding('console')) return;
        path.replaceWith(types.unaryExpression('void', types.numericLiteral(0)));
      },
    },
  };
};
