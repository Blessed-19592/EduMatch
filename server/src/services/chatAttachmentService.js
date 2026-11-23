import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { validateChatAttachment } from '../utils/chatAttachmentValidation.js';
import { getGroupChatRoom } from './chatService.js';

const STORAGE_DIRECTORY = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../storage/chat-attachments'
);

const getStoragePath = (storageKey) => resolve(STORAGE_DIRECTORY, storageKey);
let cleanupInterval;

const removeExpiredPendingAttachments = async () => {
    const result = await pool.query(
        `DELETE FROM chat_message_attachments
         WHERE message_id IS NULL
           AND pending_expires_at <= CURRENT_TIMESTAMP
         RETURNING storage_key`
    );

    for (const { storage_key: storageKey } of result.rows) {
        try {
            await rm(getStoragePath(storageKey), { force: true });
        } catch (error) {
            console.error('Unable to remove expired chat attachment:', error);
        }
    }

    await removeOrphanedAttachmentFiles();
};

const removeOrphanedAttachmentFiles = async () => {
    const [registeredResult, entries] = await Promise.all([
        pool.query('SELECT storage_key FROM chat_message_attachments'),
        readdir(STORAGE_DIRECTORY, { withFileTypes: true }).catch((error) => {
            if (error.code === 'ENOENT') return [];
            throw error;
        })
    ]);
    const registeredKeys = new Set(
        registeredResult.rows.map(row => row.storage_key)
    );
    const orphanAgeLimit = Date.now() - 24 * 60 * 60 * 1000;

    for (const entry of entries) {
        if (!entry.isFile() || !/^[0-9a-f-]{36}$/i.test(entry.name)) continue;
        if (registeredKeys.has(entry.name)) continue;

        try {
            const fileInfo = await stat(getStoragePath(entry.name));
            if (fileInfo.mtimeMs < orphanAgeLimit) {
                await rm(getStoragePath(entry.name), { force: true });
            }
        } catch (error) {
            console.error('Unable to remove an orphaned chat attachment:', error);
        }
    }
};

const schedulePendingAttachmentCleanup = () => {
    if (cleanupInterval) return;

    cleanupInterval = setInterval(() => {
        removeExpiredPendingAttachments().catch((error) => {
            console.error('Unable to clean expired chat attachments:', error);
        });
    }, 60 * 60 * 1000);
    cleanupInterval.unref();
};

export const uploadChatAttachment = async (
    groupId,
    userId,
    buffer,
    fileName,
    mimeType
) => {
    const file = validateChatAttachment({ buffer, fileName, mimeType });
    await getGroupChatRoom(groupId, userId);
    await removeExpiredPendingAttachments();
    schedulePendingAttachmentCleanup();

    const storageKey = randomUUID();
    const storagePath = getStoragePath(storageKey);

    await mkdir(STORAGE_DIRECTORY, { recursive: true });
    await writeFile(storagePath, buffer, { flag: 'wx' });

    let client;
    let transactionStarted = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transactionStarted = true;

        const userResult = await client.query(
            `SELECT user_id, role, account_status
             FROM users
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        if (
            userResult.rows.length === 0 ||
            userResult.rows[0].role !== 'student' ||
            userResult.rows[0].account_status !== 'active'
        ) {
            throw new AppError('Your account cannot upload attachments.', 403);
        }

        const membershipResult = await client.query(
            `SELECT 1
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_status = 'active'`,
            [groupId, userId]
        );

        if (membershipResult.rows.length === 0) {
            throw new AppError('You are no longer an active group member.', 403);
        }

        const pendingResult = await client.query(
            `SELECT COUNT(*)::integer AS count
             FROM chat_message_attachments
             WHERE uploaded_by = $1
               AND message_id IS NULL
               AND pending_expires_at > CURRENT_TIMESTAMP`,
            [userId]
        );

        if (pendingResult.rows[0].count >= 10) {
            throw new AppError(
                'Remove or send your pending attachments before uploading more.',
                429
            );
        }

        const result = await client.query(
            `INSERT INTO chat_message_attachments (
                group_id,
                uploaded_by,
                storage_key,
                original_filename,
                mime_type,
                size_bytes,
                pending_expires_at
             )
             VALUES (
                $1, $2, $3, $4, $5, $6,
                CURRENT_TIMESTAMP + INTERVAL '24 hours'
             )
             RETURNING
                attachment_id,
                group_id,
                original_filename,
                mime_type,
                size_bytes`,
            [
                groupId,
                userId,
                storageKey,
                file.originalFilename,
                file.mimeType,
                file.sizeBytes
            ]
        );

        await client.query('COMMIT');
        transactionStarted = false;
        return result.rows[0];
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Unable to roll back a chat attachment upload:', rollbackError);
            }
        }

        try {
            await rm(storagePath, { force: true });
        } catch (cleanupError) {
            console.error('Unable to remove an unregistered chat attachment:', cleanupError);
        }

        throw error;
    } finally {
        client?.release();
    }
};

export const deletePendingChatAttachment = async (
    groupId,
    userId,
    attachmentId
) => {
    const client = await pool.connect();
    let storageKey;

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM chat_message_attachments
             WHERE attachment_id = $1
               AND group_id = $2
               AND uploaded_by = $3
               AND message_id IS NULL
             RETURNING storage_key`,
            [attachmentId, groupId, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Pending attachment not found.', 404);
        }

        storageKey = result.rows[0].storage_key;
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    await rm(getStoragePath(storageKey), { force: true });
};

export const getChatAttachment = async (
    groupId,
    userId,
    attachmentId
) => {
    const result = await pool.query(
        `SELECT
            a.storage_key,
            a.original_filename,
            a.mime_type,
            a.size_bytes
         FROM chat_message_attachments a
         JOIN chat_messages cm
           ON cm.message_id = a.message_id
          AND cm.sender_id = a.uploaded_by
         JOIN chat_rooms cr
           ON cr.room_id = cm.room_id
          AND cr.group_id = a.group_id
         JOIN group_members gm
           ON gm.group_id = a.group_id
          AND gm.student_id = $2
          AND gm.membership_status = 'active'
         WHERE a.attachment_id = $1
           AND a.group_id = $3
           AND a.message_id IS NOT NULL
         LIMIT 1`,
        [attachmentId, userId, groupId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Attachment not found.', 404);
    }

    const attachment = result.rows[0];
    const filePath = getStoragePath(attachment.storage_key);

    try {
        await access(filePath, constants.R_OK);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new AppError('The attachment file is unavailable.', 404);
        }

        throw error;
    }

    return { ...attachment, filePath };
};
