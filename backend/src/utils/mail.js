import nodemailer from 'nodemailer';

export async function sendApprovalEmail(toEmail, importerName, tempPassword = null) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('SMTP not configured; skipping approval email to', toEmail);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject = 'EIMS Account Approved';
  let text = `Hello,\n\nYour importer account (${importerName}) has been approved and activated. You can now log in to the Ethiopian Import Goods Management System (EIMS).`;
  if (tempPassword) {
    text += `\n\nTemporary password: ${tempPassword}\nPlease change your password when you first log in.`;
  }
  text += `\n\nRegards,\nEIMS Team`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.info('Approval email sent:', info.messageId);
  } catch (err) {
    console.error('Failed to send approval email:', err.message);
  }
}
