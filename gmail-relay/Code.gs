/**
 * Excam Gmail Relay - Google Apps Script Web App
 *
 * IMPORTANT:
 * 1) Set the same token in Script Properties as GMAIL_RELAY_TOKEN.
 * 2) Deploy as Web app, Execute as: Me, Who has access: Anyone.
 * 3) Use the /exec URL in Cloudflare Worker secret GMAIL_APPS_SCRIPT_URL.
 */
const PROPERTY_TOKEN = 'GMAIL_RELAY_TOKEN';

function token_() {
  return String(PropertiesService.getScriptProperties().getProperty(PROPERTY_TOKEN) || '').trim();
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: 'Excam Gmail Relay', method: 'GET', ready: !!token_() });
}

function doPost(e) {
  const started = Date.now();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Missing POST body' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      return json_({ ok: false, error: 'Invalid JSON body' });
    }

    const expected = token_();
    if (!expected) return json_({ ok: false, error: 'GMAIL_RELAY_TOKEN is not configured in Script Properties' });
    if (String(body.token || '') !== expected) return json_({ ok: false, error: 'Unauthorized' });

    const students = Array.isArray(body.students) ? body.students.slice(0, 100) : [];
    if (!students.length) return json_({ ok: false, error: 'No emails to send' });

    const quota = MailApp.getRemainingDailyQuota();
    if (quota < students.length) {
      return json_({ ok: false, error: 'Gmail daily quota is too low', remainingQuota: quota, requested: students.length });
    }

    let sent = 0;
    const skipped = [];
    for (let i = 0; i < students.length; i++) {
      const item = students[i] || {};
      const email = String(item.email || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ index: i, reason: 'Invalid email' });
        continue;
      }

      const subject = String(item.subject || 'Excam Notification').slice(0, 200);
      const htmlBody = String(item.html || '').slice(0, 100000);
      const plainBody = String(item.text || stripHtml_(htmlBody) || 'You have a new message from Excam.').slice(0, 20000);

      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody || plainBody,
        name: 'Ahmed Elsheshtawy'
      });
      sent++;
    }

    return json_({
      ok: sent > 0,
      sent: sent,
      skipped: skipped,
      durationMs: Date.now() - started
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err), durationMs: Date.now() - started });
  }
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
