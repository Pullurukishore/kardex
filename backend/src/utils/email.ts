import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs/promises';
import handlebars from 'handlebars';

// ─── SMTP Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  // Guard: skip if credentials are not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || process.env.EMAIL_PASSWORD === 'xxxx xxxx xxxx xxxx') {
    console.warn(`[Email] Skipped "${options.subject}" – EMAIL_USER/PASSWORD not set correctly in .env`);
    return;
  }

  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${options.template}.hbs`);

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    const html = template(options.context || {});

    const fromName = process.env.EMAIL_FROM_NAME || 'Kardex Finance';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html,
    });

    console.log(`[Email] Sent "${options.subject}" to ${options.to} — Message ID: ${info.messageId}`);
  } catch (error: any) {
    console.error(`[Email] SMTP Error:`, error?.message || error);
    throw new Error(`Failed to send email: ${error?.message || 'Unknown SMTP error'}`);
  }
};

export const sendOTP = async (email: string, otp: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Your OTP Code',
    template: 'otp',
    context: { otp },
  });
};
