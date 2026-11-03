import 'dotenv/config';
import { sendVerificationEmail } from '../services/emailService.js';

const testEmail = async () => {
    try {
        await sendVerificationEmail(
            process.env.EMAIL_USER,
            '123456'
        );

        console.log('Email test successful!');
    } catch (error) {
        console.error('Email test failed:', error.message);
    }
};

testEmail();