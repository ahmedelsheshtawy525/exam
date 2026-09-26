/**
 * Gmail relay for Ahmed Finance Exam.
 * Deploy as a Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 * - URL must end with /exec
 *
 * Script Property required:
 * GMAIL_RELAY_TOKEN = same value as Cloudflare GMAIL_APPS_SCRIPT_TOKEN
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('GMAIL_RELAY_TOKEN') || '';
    var supplied = String(body.token || (e && e.parameter && e.parameter.token) || '');

    if (!expected || supplied !== expected) {
      return json({ ok: false, error: 'Unauthorized relay token' }, 401);
    }

    if (body.action !== 'sendCertificateEmail') {
      return json({ ok: false, error: 'Unsupported action' }, 400);
    }

    var to = String(body.to || '').trim();
    var subject = String(body.subject || 'Your certificate is ready').trim();
    var html = String(body.html || '').trim();
    var text = String(body.text || '').trim();

    if (!to || !html) {
      return json({ ok: false, error: 'Recipient and email body are required' }, 400);
    }

    GmailApp.sendEmail(to, subject, text || 'Your certificate is ready.', {
      htmlBody: html,
      name: 'Ahmed Elsheshtawy'
    });

    return json({ ok: true, sent: 1 });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

function testAuthorization() {
  var token = PropertiesService.getScriptProperties().getProperty('GMAIL_RELAY_TOKEN');
  if (!token) throw new Error('GMAIL_RELAY_TOKEN is not configured');
  return 'Gmail relay authorization is configured.';
}

function json(obj, status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
