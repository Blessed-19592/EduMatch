const AVATAR_COLORS = ['#7A4E2D', '#1E3A8A', '#6B3FA0', '#006B67'];

export const getAvatarColor = (identity) => {
  const value = String(identity ?? '').trim();
  if (!value) return AVATAR_COLORS[0];

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
