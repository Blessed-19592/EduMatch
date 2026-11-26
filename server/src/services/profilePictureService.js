import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { validatePictureUpload } from '../utils/imageUploadValidation.js';
import {
    deleteStoredPicture,
    getPictureMimeType,
    resolvePicturePath,
    storePicture
} from '../utils/pictureStorage.js';
import { canViewPublicStudentProfile } from '../utils/publicProfileSerializer.js';

const profilePictureUrl = (studentId) =>
    `/api/students/${encodeURIComponent(studentId)}/profile-picture`;

const cleanUpOldPicture = async (storageKey) => {
    if (!storageKey) return;

    try {
        await deleteStoredPicture('profile', storageKey);
    } catch (error) {
        console.error('Unable to remove a replaced profile picture:', error);
    }
};

export const uploadStudentProfilePicture = async (
    studentId,
    buffer,
    fileName,
    mimeType
) => {
    const image = validatePictureUpload({ buffer, fileName, mimeType });
    const client = await pool.connect();
    let transactionStarted = false;
    let storageKey;
    let oldStorageKey;
    let profileReviewStatus;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const profileResult = await client.query(
            `SELECT sp.profile_review_status, sp.profile_picture_storage_key
             FROM student_profiles sp
             JOIN users u ON u.user_id = sp.user_id
             WHERE sp.user_id = $1
               AND u.role = 'student'
               AND u.account_status = 'active'
             FOR UPDATE OF sp`,
            [studentId]
        );

        if (profileResult.rows.length === 0) {
            throw new AppError('Student profile not found.', 404);
        }

        if (profileResult.rows[0].profile_review_status === 'submitted') {
            throw new AppError(
                'Your profile is awaiting admin review. You cannot edit it right now.',
                409
            );
        }

        oldStorageKey = profileResult.rows[0].profile_picture_storage_key;
        profileReviewStatus =
            profileResult.rows[0].profile_review_status === 'approved'
                ? 'draft'
                : profileResult.rows[0].profile_review_status;
        storageKey = await storePicture('profile', buffer, image.extension);

        const updates = [
            'profile_picture_storage_key = $2',
            'updated_at = NOW()'
        ];

        if (profileResult.rows[0].profile_review_status === 'approved') {
            updates.push(
                "profile_review_status = 'draft'",
                'profile_submitted_at = NULL',
                'profile_reviewed_at = NULL',
                'profile_reviewed_by = NULL'
            );
        }

        await client.query(
            `UPDATE student_profiles
             SET ${updates.join(', ')}
             WHERE user_id = $1`,
            [studentId, storageKey]
        );

        await client.query('COMMIT');
        transactionStarted = false;
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Unable to roll back a profile picture upload:', rollbackError);
            });
        }

        if (storageKey) {
            await deleteStoredPicture('profile', storageKey).catch((cleanupError) => {
                console.error('Unable to remove an unregistered profile picture:', cleanupError);
            });
        }

        throw error;
    } finally {
        client.release();
    }

    if (oldStorageKey && oldStorageKey !== storageKey) {
        await cleanUpOldPicture(oldStorageKey);
    }

    return {
        profilePictureUrl: profilePictureUrl(studentId),
        profileReviewStatus
    };
};

export const getStudentProfilePicture = async (studentId, requesterId) => {
    const result = await pool.query(
        `SELECT
            sp.profile_picture_storage_key,
            sp.profile_review_status,
            sp.profile_moderation_status,
            COALESCE(us.profile_discoverable, TRUE) AS profile_discoverable
         FROM student_profiles sp
         JOIN users u ON u.user_id = sp.user_id
         LEFT JOIN user_settings us ON us.user_id = sp.user_id
         WHERE sp.user_id = $1
           AND u.role = 'student'
           AND u.account_status = 'active'`,
        [studentId]
    );

    const profile = result.rows[0];
    const isOwner = String(studentId) === String(requesterId);
    if (
        !profile?.profile_picture_storage_key ||
        (
            !isOwner &&
            !canViewPublicStudentProfile(
                profile,
                profile.profile_discoverable
            )
        )
    ) {
        throw new AppError('Profile picture not found.', 404);
    }

    return {
        filePath: resolvePicturePath('profile', profile.profile_picture_storage_key),
        mimeType: getPictureMimeType(profile.profile_picture_storage_key)
    };
};
