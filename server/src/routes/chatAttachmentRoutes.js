import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireStudent } from '../middleware/requireRole.js';
import { AppError } from '../utils/AppError.js';
import { MAX_CHAT_ATTACHMENT_SIZE_BYTES } from '../utils/chatAttachmentValidation.js';
import {
    deletePendingChatAttachment,
    getChatAttachment,
    uploadChatAttachment
} from '../services/chatAttachmentService.js';

const router = express.Router();
const uuidSchema = z.string().uuid();
const uploadMetadataSchema = z.object({
    name: z.string().trim().min(1).max(255),
    type: z.string().trim().max(100).optional()
}).strict();
const attachmentUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: req => String(req.currentUser.userId),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many file uploads. Please wait before trying again.'
    }
});

const parseRawAttachment = express.raw({
    type: 'application/octet-stream',
    limit: MAX_CHAT_ATTACHMENT_SIZE_BYTES,
    inflate: false
});

router.use(requireStudent);

router.post('/:groupId/chat-attachments', attachmentUploadLimiter, (req, res, next) => {
    parseRawAttachment(req, res, (error) => {
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({
                status: 'error',
                message: 'Each attachment must be 10 MB or smaller.'
            });
        }

        if (error) return next(error);
        next();
    });
}, async (req, res, next) => {
    try {
        const groupId = uuidSchema.parse(req.params.groupId);
        const metadata = uploadMetadataSchema.parse(req.query);

        if (!Buffer.isBuffer(req.body)) {
            throw new AppError('Upload the file as binary data.', 400);
        }

        const attachment = await uploadChatAttachment(
            groupId,
            req.currentUser.userId,
            req.body,
            metadata.name,
            metadata.type
        );

        res.status(201).json({
            status: 'success',
            data: { attachment }
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:groupId/chat-attachments/:attachmentId', async (req, res, next) => {
    try {
        const groupId = uuidSchema.parse(req.params.groupId);
        const attachmentId = uuidSchema.parse(req.params.attachmentId);

        await deletePendingChatAttachment(
            groupId,
            req.currentUser.userId,
            attachmentId
        );

        res.status(200).json({
            status: 'success',
            message: 'Pending attachment removed.'
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:groupId/chat-attachments/:attachmentId', async (req, res, next) => {
    try {
        const groupId = uuidSchema.parse(req.params.groupId);
        const attachmentId = uuidSchema.parse(req.params.attachmentId);
        const attachment = await getChatAttachment(
            groupId,
            req.currentUser.userId,
            attachmentId
        );
        const isImage = attachment.mime_type.startsWith('image/');
        const encodedName = encodeURIComponent(attachment.original_filename)
            .replace(/[!'()*]/g, character =>
                `%${character.charCodeAt(0).toString(16).toUpperCase()}`
            );

        res.set({
            'Cache-Control': 'private, no-store',
            'Content-Type': attachment.mime_type,
            'Content-Disposition': `${isImage ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedName}`,
            'X-Content-Type-Options': 'nosniff'
        });

        res.sendFile(attachment.filePath, (error) => {
            if (error) next(error);
        });
    } catch (error) {
        next(error);
    }
});

export default router;
