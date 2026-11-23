export const getProfilePictureUrl = (userId, storageKey, externalUrl) =>
    storageKey
        ? `/api/students/${encodeURIComponent(userId)}/profile-picture`
        : externalUrl || null;
