// Okyo design tokens. Most screens consume these through the
// re-exports in components/OkyoUI.tsx, so importing from either place is fine.

export const colors = {
  background: '#fff8ef',
  card: '#ffffff',
  cream: '#fff1df',
  creamDeep: '#f4dcc2',
  coral: '#e9552f',
  coralDark: '#bd3f24',
  green: '#167247',
  greenSoft: '#e8f6ec',
  charcoal: '#211d19',
  body: '#5f574d',
  muted: '#8b8175',
  border: '#eadcc9',
  danger: '#9f3324',
};

export const spacing = {
  screen: 20,
  section: 24,
  card: 18,
};

export const radius = {
  hero: 28,
  card: 22,
  panel: 18,
  button: 18,
  pill: 999,
};

export const fontSizes = {
  hero: 34,
  title: 22,
  body: 15,
  caption: 12,
};

export const shadows = {
  card: {
    shadowColor: '#7b5a38',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
};
