const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  if (!isEmailConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOtpEmail({ to, otp, name = "Student" }) {
  const transporter = createTransporter();
  if (!transporter) {
    const error = new Error("Email OTP is not configured. Please set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  const from = process.env.OTP_FROM || `Studox.ai <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Your Studox.ai password reset OTP",
    text: `Hi ${name}, your Studox.ai password reset OTP is ${otp}. It expires in ${expiryMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px">
        <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #e7ecf6;border-radius:12px;padding:24px">
          <h2 style="margin:0 0 12px;color:#0f172a">Studox.ai Password Reset</h2>
          <p style="color:#475569">Hi ${name}, use this OTP to reset your password:</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:6px;color:#2563eb;background:#eef5ff;border-radius:10px;padding:16px;text-align:center">${otp}</div>
          <p style="color:#64748b">This OTP expires in ${expiryMinutes} minutes.</p>
          <p style="color:#94a3b8;font-size:13px">If you did not request this, ignore this email.</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeEmail({ to, name = "Student", goal = "your learning goal" }) {
  const transporter = createTransporter();
  if (!transporter) {
    const error = new Error("Welcome email is not configured. Please set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const from = process.env.OTP_FROM || `Studox.ai <${process.env.SMTP_USER}>`;
  const dashboardUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;

  await transporter.sendMail({
    from,
    to,
    subject: "Welcome to Studox.ai - Your AI learning journey starts now",
    text: `Hi ${name}, welcome to Studox.ai. Your ${goal} roadmap is ready. Login here: ${dashboardUrl}`,
    html: `
      <div style="margin:0;padding:0;background:#f4f7ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7ff;padding:28px 14px">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5ecfb;border-radius:18px;overflow:hidden;box-shadow:0 22px 60px rgba(37,99,235,0.13)">
                <tr>
                  <td style="padding:0;background:linear-gradient(135deg,#2563eb,#7c3aed)">
                    <div style="padding:34px 32px 30px;color:#ffffff">
                      <div style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:8px 13px;font-size:12px;font-weight:800;letter-spacing:.4px">WELCOME TO STUDOX.AI</div>
                      <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.08;font-weight:900;letter-spacing:-.4px">Hi ${name}, your AI learning command center is ready.</h1>
                      <p style="margin:0;color:#dbeafe;font-size:16px;line-height:1.7">We created your personalized roadmap for <strong style="color:#ffffff">${goal}</strong>. Start with learning modules, weekly tests, DSA practice, projects, resume scoring, internships and your AI mentor.</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 32px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:14px;border:1px solid #e8eef9;border-radius:12px;background:#f8fbff">
                          <strong style="display:block;color:#0f172a;font-size:15px">Personalized Roadmap</strong>
                          <span style="display:block;color:#64748b;font-size:13px;line-height:1.6;margin-top:4px">Milestones tailored to your goal.</span>
                        </td>
                        <td width="12"></td>
                        <td style="padding:14px;border:1px solid #e8eef9;border-radius:12px;background:#f8fbff">
                          <strong style="display:block;color:#0f172a;font-size:15px">AI Mentor</strong>
                          <span style="display:block;color:#64748b;font-size:13px;line-height:1.6;margin-top:4px">Ask doubts, code, resume and career questions.</span>
                        </td>
                      </tr>
                    </table>
                    <div style="height:14px"></div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:14px;border:1px solid #e8eef9;border-radius:12px;background:#f8fbff">
                          <strong style="display:block;color:#0f172a;font-size:15px">Weekly Tests</strong>
                          <span style="display:block;color:#64748b;font-size:13px;line-height:1.6;margin-top:4px">Submit tests and get AI analysis.</span>
                        </td>
                        <td width="12"></td>
                        <td style="padding:14px;border:1px solid #e8eef9;border-radius:12px;background:#f8fbff">
                          <strong style="display:block;color:#0f172a;font-size:15px">Career Tools</strong>
                          <span style="display:block;color:#64748b;font-size:13px;line-height:1.6;margin-top:4px">Resume ATS, internships and hackathons.</span>
                        </td>
                      </tr>
                    </table>
                    <div style="text-align:center;margin-top:28px">
                      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-weight:800;font-size:15px">Open Studox.ai Dashboard</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px;background:#f8fbff;border-top:1px solid #e8eef9;color:#64748b;font-size:13px;line-height:1.6">
                    Keep learning consistently. Your progress, tests, DSA streaks and projects will update inside your dashboard.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

module.exports = {
  isEmailConfigured,
  sendOtpEmail,
  sendWelcomeEmail,
};
