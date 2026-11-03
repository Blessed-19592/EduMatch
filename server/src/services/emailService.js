import nodemailer from 'nodemailer';
import 'dotenv/config';

// Configure Gmail as the email provider.
const transporter = nodemailer.createTransport({
    service: 'gmail',

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
    },
});

// Send a student verification code.
export const sendVerificationEmail = async (email, code) => {
    try {
        const info = await transporter.sendMail({
            from: `"EduMatch" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'EduMatch - Email Verification Code',

            text: `Your EduMatch verification code is ${code}. It expires in 10 minutes.`,

            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
                    <h2>Welcome to EduMatch!</h2>

                    <p>Use the verification code below to continue your registration:</p>

                    <h1 style="letter-spacing: 6px;">${code}</h1>

                    <p>This code expires in <strong>10 minutes</strong>.</p>

                    <p>If you did not request this code, you can ignore this email.</p>

                    <hr>

                    <p>EduMatch Team</p>
                </div>
            `,
        });

        console.log('Verification email sent:', info.messageId);

        return true;

    } catch (error) {
        console.error('Email sending failed:', error.message);

        throw new Error('Unable to send verification email.');
    }
};