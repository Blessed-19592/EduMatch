export const createPasswordResetUrl = (token, clientUrl) => {
    const resetUrl = new URL('/reset-password', clientUrl);
    resetUrl.searchParams.set('token', token);
    return resetUrl.toString();
};
