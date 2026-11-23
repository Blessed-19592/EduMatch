import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { validatePictureUpload } from '../utils/imageUploadValidation.js';
import {
    deleteStoredPicture,
    getPictureMimeType,
    resolvePicturePath,
    storePicture
} from '../utils/pictureStorage.js';

const groupPictureUrl = (groupId) =>
    `/api/groups/${encodeURIComponent(groupId)}/picture`;

const cleanUpOldPicture = async (storageKey) => {
    if (!storageKey) return;

    try {
        await deleteStoredPicture('group', storageKey);
    } catch (error) {
        console.error('Unable to remove a replaced group picture:', error);
    }
};

export const uploadGroupPicture = async (
    groupId,
    ownerId,
    buffer,
    fileName,
    mimeType
) => {
    const image = validatePictureUpload({ buffer, fileName, mimeType });
    const client = await pool.connect();
    let transactionStarted = false;
    let storageKey;
    let oldStorageKey;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const groupResult = await client.query(
            `SELECT created_by, group_picture_storage_key
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [groupId]
        );

        if (groupResult.rows.length === 0) {
            throw new AppError('Group not found.', 404);
        }

        if (String(groupResult.rows[0].created_by) !== String(ownerId)) {
            throw new AppError('Only the group owner can change its picture.', 403);
        }

        const ownerMembership = await client.query(
            `SELECT 1
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_role = 'owner'
               AND membership_status = 'active'
             FOR UPDATE`,
            [groupId, ownerId]
        );

        if (ownerMembership.rows.length === 0) {
            throw new AppError('Only an active group owner can change its picture.', 403);
        }

        oldStorageKey = groupResult.rows[0].group_picture_storage_key;
        storageKey = await storePicture('group', buffer, image.extension);

        await client.query(
            `UPDATE student_groups
             SET group_picture_storage_key = $2,
                 updated_at = NOW()
             WHERE group_id = $1`,
            [groupId, storageKey]
        );

        await client.query('COMMIT');
        transactionStarted = false;
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Unable to roll back a group picture upload:', rollbackError);
            });
        }

        if (storageKey) {
            await deleteStoredPicture('group', storageKey).catch((cleanupError) => {
                console.error('Unable to remove an unregistered group picture:', cleanupError);
            });
        }

        throw error;
    } finally {
        client.release();
    }

    if (oldStorageKey && oldStorageKey !== storageKey) {
        await cleanUpOldPicture(oldStorageKey);
    }

    return { groupPictureUrl: groupPictureUrl(groupId) };
};

export const getGroupPicture = async (groupId) => {
    const result = await pool.query(
        `SELECT group_picture_storage_key
         FROM student_groups
         WHERE group_id = $1`,
        [groupId]
    );

    const storageKey = result.rows[0]?.group_picture_storage_key;
    if (!storageKey) {
        throw new AppError('Group picture not found.', 404);
    }

    return {
        filePath: resolvePicturePath('group', storageKey),
        mimeType: getPictureMimeType(storageKey)
    };
};
