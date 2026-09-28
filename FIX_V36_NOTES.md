# Fix V36 — Certificates / Result Review / Case Materials

Fixed:
1. Student Certificates page now lists certificate records even if a legacy certificate has no matching result row.
2. Result review route is preserved and cache-busted; duplicate legacy result API route removed.
3. Result review now includes exam-level case files and question-level attachments.
4. Public Certificate Assessment now displays exam case materials and question attachments.
5. Questions with their own attached files are explicitly labeled "Case-based question".
6. Certificate list only shows "View result & answers" when a valid result ID exists.
7. app.js cache version bumped to 22.0.
