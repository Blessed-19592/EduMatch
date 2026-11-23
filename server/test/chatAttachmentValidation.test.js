import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_CHAT_ATTACHMENT_SIZE_BYTES,
    validateChatAttachment
} from '../src/utils/chatAttachmentValidation.js';

test('validates JPEG file contents and sanitizes path components', () => {
    const result = validateChatAttachment({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        fileName: 'C:\\private\\photo.jpg',
        mimeType: 'image/jpeg'
    });

    assert.equal(result.originalFilename, 'photo.jpg');
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.sizeBytes, 4);
});

test('rejects MIME-type mismatches and invalid file signatures', () => {
    assert.throws(
        () => validateChatAttachment({
            buffer: Buffer.from('%PDF-1.7'),
            fileName: 'notes.pdf',
            mimeType: 'image/png'
        }),
        { statusCode: 400 }
    );

    assert.throws(
        () => validateChatAttachment({
            buffer: Buffer.from('not a PDF'),
            fileName: 'notes.pdf',
            mimeType: 'application/pdf'
        }),
        { statusCode: 400 }
    );
});

test('rejects attachments above the configured limit', () => {
    assert.throws(
        () => validateChatAttachment({
            buffer: Buffer.alloc(MAX_CHAT_ATTACHMENT_SIZE_BYTES + 1),
            fileName: 'large.jpg',
            mimeType: 'image/jpeg'
        }),
        { statusCode: 413 }
    );
});
