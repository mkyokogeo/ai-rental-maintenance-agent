import nodemailer from 'nodemailer';

function requiredEmailConfig() {
  return [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'EMAIL_FROM',
  ].every((name) => Boolean(process.env[name]));
}

function button(url, label, color) {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;margin-right:8px">${label}</a>`;
}

export async function sendTechnicianIncidentEmail({ incidentId, technician, incident, applicationId, providerAction }) {
  const recipientEmail = process.env.DEMO_TECHNICIAN_EMAIL || technician?.email;
  if (!recipientEmail) return { sent: false, reason: 'Technician has no email.' };
  if (!requiredEmailConfig()) return { sent: false, reason: 'SMTP or action URL configuration is incomplete.' };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const actionsConfigured = Boolean(
    (process.env.ENGINEER_ACTION_BASE_URL || process.env.ENGINEER_MATCH_URL) && applicationId && providerAction?.token,
  );
  const actionBase = (process.env.ENGINEER_ACTION_BASE_URL || new URL(process.env.ENGINEER_MATCH_URL).origin).replace(/\/$/, '');
  const acceptUrl = actionsConfigured
    ? `${actionBase}/applications/${encodeURIComponent(applicationId)}/action?token=${encodeURIComponent(providerAction.token)}&decision=accept`
    : null;
  const rejectUrl = actionsConfigured
    ? `${actionBase}/applications/${encodeURIComponent(applicationId)}/action?token=${encodeURIComponent(providerAction.token)}&decision=decline`
    : null;
  const desiredTime = incident.findings?.desired_appointment_time || 'Not specified';
  const property = incident.property || {};
  const address = [property.address_line1, property.address_line2, property.city, property.region, property.postal_code, property.country]
    .filter(Boolean)
    .join(', ') || property.address || 'Not available';
  const propertyContext = `Property: ${property.name || 'Not available'}\nAddress: ${address}\nProperty type: ${property.property_type || 'Not available'}`;
  const propertyHtml = `<p><strong>Property:</strong> ${property.name || 'Not available'}<br><strong>Address:</strong> ${address}<br><strong>Property type:</strong> ${property.property_type || 'Not available'}</p>`;
  const actionText = actionsConfigured ? `\n\nAccept: ${acceptUrl}\nReject: ${rejectUrl}` : '';
  const actionHtml = actionsConfigured ? `<p>${button(acceptUrl, 'Accept incident', '#198754')}${button(rejectUrl, 'Reject incident', '#dc3545')}</p>` : '<p>Reply to this email to confirm or reject the incident.</p>';
  const text = `${incident.summary}\n\n${propertyContext}\nDesired appointment time: ${desiredTime}${actionText}`;
  const html = `<h2>New maintenance incident</h2>${propertyHtml}<p><strong>Desired appointment time:</strong> ${desiredTime}</p><p>${incident.summary}</p>${actionHtml}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Maintenance incident: ${incident.problem_type || incident.categories?.join(', ') || 'service request'}`,
    text,
    html,
  });
  return { sent: true, email: recipientEmail };
}
