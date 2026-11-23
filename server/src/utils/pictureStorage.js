import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './AppError.js';

const STORAGE_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../storage'
);

const PICTURE_DIRECTORIES = {
    profile: resolve(STORAGE_ROOT, 'profile-pictures'),
    group: resolve(STORAGE_ROOT, 'group-pictures')
};

const PICTURE_KEY_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

const getPicturePath = (category, storageKey) => {
    const directory = PICTURE_DIRECTORIES[category];

    if (!directory || !PICTURE_KEY_PATTERN.test(storageKey || '')) {
        throw new AppError('Picture not found.', 404);
    }

    return resolve(directory, storageKey);
};

export const storePicture = async (category, buffer, extension) => {
    const directory = PICTURE_DIRECTORIES[category];
    const mimeType = MIME_TYPES[extension];

    if (!directory || !mimeType) {
        throw new Error('Unsupported picture storage configuration.');
    }

    const storageKey = `${randomUUID()}${extension}`;
    const filePath = getPicturePath(category, storageKey);

    await mkdir(dirname(filePath), { recursive: true });

    try {
        await writeFile(filePath, buffer, { flag: 'wx' });
        return storageKey;
    } catch (error) {
        await rm(filePath, { force: true }).catch((cleanupError) => {
            console.error('Unable to clean up a failed picture upload:', cleanupError);
        });
        throw error;
    }
};

export const resolvePicturePath = (category, storageKey) =>
    getPicturePath(category, storageKey);

export const getPictureMimeType = (storageKey) => {
    const extension = storageKey?.slice(storageKey.lastIndexOf('.')).toLowerCase();
    const mimeType = MIME_TYPES[extension];

    if (!mimeType || !PICTURE_KEY_PATTERN.test(storageKey)) {
        throw new AppError('Picture not found.', 404);
    }

    return mimeType;
};

export const deleteStoredPicture = async (category, storageKey) => {
    if (!storageKey) return;
    await rm(getPicturePath(category, storageKey), { force: true });
};
