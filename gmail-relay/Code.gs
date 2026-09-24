const CONFIG = {
  TOKEN: 'CHANGE_ME_TO_A_LONG_RANDOM_TOKEN'
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'Excam Gmail Relay' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e?.postData?.contents || '{}');
    if (body.token !== CONFIG.TOKEN) return out({ ok: false, error: 'Unauthorized' }, 401);

    const students = Array.isArray(body.students) ? body.students.slice(0, 100) : [];
    if (!students.length) return out({ ok: false, error: 'No emails to send' }, 400);

    const quota = MailApp.getRemainingDailyQuota();
    if (quota < students.length) return out({ ok: false, error: `Gmail daily quota is too low. Remaining: ${quota}` }, 429);

    let sent = 0;
    for (const item of students) {
      const email = String(item?.email || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const subject = String(item?.subject || 'Excam Notification').slice(0, 200);
      const htmlBody = String(item?.html || '').slice(0, 100000);
      const plainBody = String(item?.text || stripHtml(htmlBody) || 'You have a new message from Excam.').slice(0, 20000);
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody || plainBody,
        name: 'Ahmed Elsheshtawy'
      });
      sent++;
    }

    return out({ ok: true, sent });
  } catch (err) {
    return out({ ok: false, error: String(err?.message || err) }, 500);
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
