import express from 'express';
import { MAX_PICTURE_UPLOAD_SIZE_BYTES } from '../utils/imageUploadValidation.js';

const parsePictureBody = express.raw({
    type: 'application/octet-stream',
    limit: MAX_PICTURE_UPLOAD_SIZE_BYTES,
    inflate: false
});

export const parsePictureUpload = (req, res, next) => {
    parsePictureBody(req, res, (error) => {
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({
                status: 'error',
                message: 'Images must be 5 MB or smaller.'
            });
        }

        if (error) return next(error);
        next();
    });
};
