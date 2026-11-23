import { AppError } from './AppError.js';

export const MAX_CHAT_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5;

const fileTypes = {
    '.jpg': {
        mimeType: 'image/jpeg',
        matches: buffer => buffer.length >= 3 &&
            buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    },
    '.jpeg': {
        mimeType: 'image/jpeg',
        matches: buffer => buffer.length >= 3 &&
            buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    },
    '.png': {
        mimeType: 'image/png',
        matches: buffer => buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
    },
    '.webp': {
        mimeType: 'image/webp',
        matches: buffer => buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP'
    },
    '.pdf': {
        mimeType: 'application/pdf',
        matches: buffer => buffer.length >= 5 &&
            buffer.toString('ascii', 0, 5) === '%PDF-'
    },
    '.docx': {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        matches: buffer => buffer.length >= 4 &&
            buffer.toString('binary', 0, 4) === 'PK\u0003\u0004'
    },
    '.xlsx': {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        matches: buffer => buffer.length >= 4 &&
            buffer.toString('binary', 0, 4) === 'PK\u0003\u0004'
    },
    '.pptx': {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        matches: buffer => buffer.length >= 4 &&
            buffer.toString('binary', 0, 4) === 'PK\u0003\u0004'
    }
};

export const validateChatAttachment = ({
    buffer,
    fileName,
    mimeType
}) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AppError('Select a non-empty file to upload.', 400);
    }

    if (buffer.length > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
        throw new AppError('Each attachment must be 10 MB or smaller.', 413);
    }

    const normalizedName = String(fileName || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        .normalize('NFC')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[<>:"|?*]/g, '_')
        .trim()
        .replace(/[. ]+$/g, '');

    if (!normalizedName || normalizedName.length > 255) {
        throw new AppError('The file name is invalid or too long.', 400);
    }

    const extension = normalizedName.slice(normalizedName.lastIndexOf('.')).toLowerCase();
    const fileType = fileTypes[extension];

    if (!fileType) {
        throw new AppError('This file type is not supported.', 400);
    }

    if (
        mimeType &&
        mimeType !== fileType.mimeType &&
        mimeType !== 'application/octet-stream'
    ) {
        throw new AppError('The file type does not match its extension.', 400);
    }

    if (!fileType.matches(buffer)) {
        throw new AppError('The file contents do not match the selected file type.', 400);
    }

    return {
        originalFilename: normalizedName,
        mimeType: fileType.mimeType,
        sizeBytes: buffer.length
    };
};
