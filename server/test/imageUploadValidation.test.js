import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_PICTURE_UPLOAD_SIZE_BYTES,
    validatePictureUpload
} from '../src/utils/imageUploadValidation.js';

test('accepts supported image files after checking their contents', () => {
    const result = validatePictureUpload({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        fileName: 'portrait.jpg',
        mimeType: 'image/jpeg'
    });

    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.extension, '.jpg');
    assert.equal(result.sizeBytes, 4);
});

test('rejects non-image attachments and mismatched image metadata', () => {
    assert.throws(
        () => validatePictureUpload({
            buffer: Buffer.from('%PDF-1.7'),
            fileName: 'document.pdf',
            mimeType: 'application/pdf'
        }),
        { statusCode: 400 }
    );

    assert.throws(
        () => validatePictureUpload({
            buffer: Buffer.from([0xff, 0xd8, 0xff]),
            fileName: 'portrait.jpg',
            mimeType: 'image/png'
        }),
        { statusCode: 400 }
    );
});

test('rejects pictures above the upload size limit', () => {
    assert.throws(
        () => validatePictureUpload({
            buffer: Buffer.alloc(MAX_PICTURE_UPLOAD_SIZE_BYTES + 1),
            fileName: 'large.jpg',
            mimeType: 'image/jpeg'
        }),
        { statusCode: 413 }
    );
});
