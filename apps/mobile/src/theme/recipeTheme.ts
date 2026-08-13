export const recipeColors = {
  background: '#fffdfe',
  card: '#FFFFFF',
  orange: '#FF7A00',
  orangeDeep: '#E84F1A',
  orangeSoft: '#FFE3D2',
  charcoal: '#111111',
  text: '#1A1A1A',
  muted: '#746D64',
  border: '#E8DCCB',
  cream: '#fffdfe',
  creamDeep: '#F0DFC8',
  green: '#187A44',
  greenSoft: '#E6F6EA',
  yellowSoft: '#FFF2C7',
  blue: '#1F6AA0',
  blueSoft: '#E8F1FD',
};

export const recipeShadows = {
  card: {
    // Match the supplied reference: a pale edge catches the light at the top
    // while a crisp shallow shadow gives the card its lower lift.
    borderColor: '#E4E1E0',
    borderWidth: 1,
    shadowColor: '#6D6966',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 1.5,
    elevation: 3,
  },
  hero: {
    shadowColor: '#5a3924',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 5,
  },
};
