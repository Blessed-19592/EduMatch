import { AppError } from './AppError.js';
import { validateChatAttachment } from './chatAttachmentValidation.js';

export const MAX_PICTURE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const validatePictureUpload = ({ buffer, fileName, mimeType }) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AppError('Select a non-empty image to upload.', 400);
    }

    if (buffer.length > MAX_PICTURE_UPLOAD_SIZE_BYTES) {
        throw new AppError('Images must be 5 MB or smaller.', 413);
    }

    const validatedFile = validateChatAttachment({
        buffer,
        fileName,
        mimeType
    });

    if (!validatedFile.mimeType.startsWith('image/')) {
        throw new AppError('Upload a JPG, PNG, or WebP image.', 400);
    }

    return {
        mimeType: validatedFile.mimeType,
        extension: validatedFile.originalFilename
            .slice(validatedFile.originalFilename.lastIndexOf('.'))
            .toLowerCase(),
        sizeBytes: validatedFile.sizeBytes
    };
};
