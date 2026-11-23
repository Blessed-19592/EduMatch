export const getClientOrigins = (clientUrl, isProduction) => {
    const primaryOrigin = new URL(clientUrl).origin;
    const allowedOrigins = new Set([primaryOrigin]);

    if (!isProduction) {
        const localhostOrigin = new URL(primaryOrigin);
        localhostOrigin.hostname = 'localhost';
        allowedOrigins.add(localhostOrigin.origin);
    }

    return allowedOrigins;
};
