const encoder = new TextEncoder();
const SESSION_DAYS = 30;
const SESSION_COOKIE = 'exam_session';

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
}
function bad(message,status=400){return json({error:message},status)}
function cookie(name,value,maxAge){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function clearCookie(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
function randomHex(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
function toB64(buf){let s='';for(const b of new Uint8Array(buf))s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64(s){s=s.replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function clean(v,max=10000){return String(v??'').trim().slice(0,max)}
function normalizeAttachments(value){
  const arr=Array.isArray(value)?value:[];
  return arr.slice(0,10).map(x=>({
    name:clean(x?.name||x?.title,200),
    url:clean(x?.url,2000)
  })).filter(x=>x.name&&/^https?:\/\//i.test(x.url));
}
function parseAttachments(value){
  try{return normalizeAttachments(JSON.parse(value||'[]'))}
  catch{return []}
}
function idNum(v){const n=Number(v);return Number.isInteger(n)&&n>0?n:null}
function passwordOK(v){return typeof v==='string'&&v.length>=8&&v.length<=128}
function emailOK(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function phoneOK(v){return v===''||/^[+0-9][0-9 ()-]{6,19}$/.test(v)}
function now(){return Math.floor(Date.now()/1000)}
function isoOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const t=Date.parse(String(v));return Number.isFinite(t)?new Date(t).toISOString():null}
function availabilityState(startAt,expiresAt){const t=Date.now();const s=startAt?Date.parse(startAt):NaN,e=expiresAt?Date.parse(expiresAt):NaN;if(Number.isFinite(e)&&t>=e)return 'expired';if(Number.isFinite(s)&&t<s)return 'scheduled';return 'open'}
function parseSkills(value){try{const a=Array.isArray(value)?value:JSON.parse(value||'[]');return a.map(x=>clean(x,80)).filter(Boolean).slice(0,30)}catch{return []}}
function certificateNumber(){const d=new Date(),y=d.getUTCFullYear();return `CERT-${y}-${randomHex(5).slice(0,10).toUpperCase()}`}
async function sendCertificateEmail(env,{to,studentName,certificateTitle,examTitle,verificationUrl,certificateNumber,percentage,issuedAt}){
  const relayUrl=String(env.GMAIL_APPS_SCRIPT_URL||'').trim();
  const token=String(env.GMAIL_APPS_SCRIPT_TOKEN||'').trim();
  if(!relayUrl||!token||!emailOK(to)){
    console.error('CERTIFICATE EMAIL SKIPPED',JSON.stringify({hasRelayUrl:!!relayUrl,hasToken:!!token,validRecipient:emailOK(to)}));
    return {sent:false,skipped:true,reason:'Gmail certificate email service is not configured'};
  }
  console.log('CERTIFICATE EMAIL START',JSON.stringify({hasRelayUrl:true,hasToken:true,validRecipient:true}));

  const origin=(()=>{try{return new URL(String(verificationUrl||'')).origin}catch{return String(env.APP_ORIGIN||'')}})();
  const no=encodeURIComponent(certificateNumber||'');
  const certificateUrl=`${origin}/certificate/${no}`;
  const verifyUrl=`${origin}/verify/${no}`;
  const safeName=htmlEscape(studentName||'Student');
  const safeTitle=htmlEscape(certificateTitle||examTitle||'Certificate');
  const safeNo=htmlEscape(certificateNumber||'');
  const safeCertificateUrl=htmlEscape(certificateUrl);
  const safeVerifyUrl=htmlEscape(verifyUrl);
  const dateValue=issuedAt||new Date().toISOString();
  const issueDate=htmlEscape(new Date(String(dateValue).includes('T')?dateValue:dateValue+'Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}));

  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your certificate has been issued</title></head>
<body style="margin:0;padding:0;background:#eeece6;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<div style="width:100%;background:#eeece6;padding:32px 12px;box-sizing:border-box;"><div style="max-width:680px;margin:0 auto;">
<div style="background:#050505;border-radius:22px 22px 0 0;padding:24px 28px;color:#fff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="width:52px;"><img src="${htmlEscape(origin)}/ae-logo.png" width="44" height="44" alt="Ahmed Elsheshtawy" style="display:block;object-fit:contain;"></td><td valign="middle" style="padding-left:12px;"><div style="font-size:17px;font-weight:800;line-height:1.2;">Ahmed Elsheshtawy</div><div style="margin-top:4px;color:#a8a8a8;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Finance · Assessment · Credentials</div></td></tr></table></div>
<div style="background:#fbfaf6;border:1px solid #d8d3c8;border-top:0;padding:34px 28px 30px;"><div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#ff4d00;">Certificate of Achievement</div><h1 style="margin:10px 0 14px;font-size:34px;line-height:1.08;letter-spacing:-.7px;color:#090909;">Congratulations, ${safeName}!</h1><p style="margin:0;color:#57534d;font-size:15px;line-height:1.65;">You successfully passed the assessment and your certificate has been officially issued by Ahmed Elsheshtawy.</p>
<div style="height:2px;background:#ff4d00;width:58px;margin:24px 0;"></div><div style="background:#f1eee7;border:1px solid #ddd8cd;border-radius:16px;padding:20px;"><div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#817b72;margin-bottom:14px;">Certificate details</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:1.5;"><tr><td style="padding:8px 0;color:#817b72;width:42%;">Student name</td><td style="padding:8px 0;font-weight:800;color:#111;">${safeName}</td></tr><tr><td style="padding:8px 0;color:#817b72;">Certificate</td><td style="padding:8px 0;font-weight:800;color:#111;">${safeTitle}</td></tr><tr><td style="padding:8px 0;color:#817b72;">Certificate ID</td><td style="padding:8px 0;font-weight:800;color:#111;word-break:break-word;">${safeNo}</td></tr><tr><td style="padding:8px 0;color:#817b72;">Issue date</td><td style="padding:8px 0;font-weight:800;color:#111;">${issueDate}</td></tr></table></div>
<div style="margin-top:24px;text-align:center;"><a href="${safeCertificateUrl}" style="display:inline-block;background:#ff4d00;color:#050505;text-decoration:none;font-size:13px;font-weight:800;padding:14px 22px;border-radius:10px;margin:0 4px 10px;">View Certificate</a><a href="${safeVerifyUrl}" style="display:inline-block;background:#050505;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;padding:14px 22px;border-radius:10px;margin:0 4px 10px;">Verify Certificate</a></div>
<div style="margin-top:20px;padding:16px 18px;background:#fff;border:1px solid #e0dbd0;border-radius:12px;"><div style="font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#817b72;margin-bottom:7px;">Verification link</div><a href="${safeVerifyUrl}" style="font-size:12px;line-height:1.5;color:#111;text-decoration:none;word-break:break-all;">${safeVerifyUrl}</a></div><p style="margin:24px 0 0;text-align:center;color:#77736c;font-size:12px;line-height:1.6;">Keep your Certificate ID for future verification.</p></div>
<div style="background:#050505;border-radius:0 0 22px 22px;padding:24px 28px;text-align:center;color:#fff;"><div style="font-size:15px;font-weight:800;">Ahmed Elsheshtawy</div><div style="margin-top:5px;color:#999;font-size:10px;letter-spacing:1.1px;text-transform:uppercase;">Finance · Assessment · Credentials</div><div style="margin-top:15px;color:#777;font-size:10px;line-height:1.6;">This email confirms that the certificate above was issued by the Ahmed Elsheshtawy Finance Assessment Platform.</div><div style="margin-top:12px;color:#666;font-size:10px;">© ${new Date().getFullYear()} Ahmed Elsheshtawy. All rights reserved.</div></div>
</div></div></body></html>`;
  const text=`Congratulations, ${studentName||'Student'}!\n\nYou successfully passed the assessment and your certificate has been officially issued by Ahmed Elsheshtawy.\n\nCertificate: ${certificateTitle||examTitle||'Certificate'}\nCertificate ID: ${certificateNumber||''}\nIssue date: ${issueDate}\n\nView Certificate: ${certificateUrl}\nVerify Certificate: ${verifyUrl}`;
  const res=await fetch(relayUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,students:[{email:to,name:studentName||'Student',subject:`Congratulations — Your ${certificateTitle||'Certificate'} Has Been Issued`,html,text}]})});
  const data=await res.json().catch(()=>({}));
  console.log('CERTIFICATE EMAIL RELAY RESPONSE',JSON.stringify({status:res.status,ok:data?.ok,sent:data?.sent,error:data?.error||null}));
  if(!res.ok||data?.ok===false)throw new Error(`Certificate email failed (${res.status}): ${String(data?.error||data?.message||'Gmail relay error').slice(0,500)}`);
  return {sent:true};
}
async function ensureCertificate(env,request,{attemptId,userId,examId,a,score,total,percentage}){
  const existing=await env.DB.prepare('SELECT certificate_number,status,show_answers FROM certificates WHERE attempt_id=?').bind(String(attemptId)).first();
  if(existing)return {certificateNumber:existing.certificate_number,verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(existing.certificate_number)}`,status:existing.status,created:false};
  const u=await env.DB.prepare('SELECT full_name,email FROM users WHERE id=?').bind(userId).first();
  if(!u)throw new Error('Student account not found while issuing certificate');
  const certId=randomHex(16);
  const certNo=certificateNumber();
  const token=randomHex(24);
  const skills=parseSkills(a.certificate_skills_json);
  const issuedAt=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO certificates(id,certificate_number,verification_token,attempt_id,user_id,exam_id,score,percentage,title,issued_by,type,level,format,duration,description,skills,issued_at,status,show_answers) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(certId,certNo,token,String(attemptId),String(userId),String(examId),score,percentage,
      clean(a.certificate_title||`${a.title} Certificate`,200),
      clean(a.certificate_issued_by||'Ahmed Elsheshtawy',200),
      clean(a.certificate_type||'Training',80),
      clean(a.certificate_level||'Intermediate',80),
      clean(a.certificate_format||'Online',80),
      clean(a.certificate_duration||'',80),
      clean(a.certificate_description||a.description||'',10000),
      JSON.stringify(skills),issuedAt,'valid',0).run();
  return {certificateNumber:certNo,verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(certNo)}`,status:'valid',showAnswers:false,issuedAt,created:true};
}
function htmlEscape(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll("'",'&#39;')}
function credentialPage(c,request){
  const origin=new URL(request.url).origin;
  const verify=`${origin}/verify/${encodeURIComponent(c.certificate_number)}`;
  const assessment=`${origin}/certificate-exam/${encodeURIComponent(c.certificate_number)}`;
  const issued=new Date(String(c.issued_at).includes('T')?c.issued_at:c.issued_at+'Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(verify)}`;
  const status=c.status==='valid';
  const skills=parseSkills(c.skills);
  const description=String(c.description||'').trim();
  const content=skills.length?skills.map(x=>`<span class="skill">${htmlEscape(x)}</span>`).join(''):'<span class="content-empty">Assessment content is defined by the exam completed by the learner.</span>';
  const sourceUrl='https://ahmed-portfolio.ahmedelsheshtawyofficial.workers.dev/';
  const contactIcons=`<div class="certificate-contact" aria-label="Contact links">
    <a href="mailto:ahmedelsheshtawyofficial@gmail.com" title="Email" aria-label="Email"><svg viewBox="0 0 24 24"><path d="M3 5.5h18v13H3z"/><path d="m3 6 9 7 9-7"/></svg></a>
    <a href="https://linkedin.com/in/ahmedelsheshtawyofficial/" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M5 8.5V19M5 5.2v.1M10 19v-6.2a3.1 3.1 0 0 1 6.2 0V19M10 10.3V19"/></svg></a>
    <a href="https://wa.me/+201559694529" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.2 2 2 3.8 4 4 .6.1 1-.2 1.4-.8l.5-.8-1.7-.9-.6.7c-.8-.3-1.5-1-1.8-1.8l.7-.6-.9-1.7-.8.5c-.6.4-.9.8-.8 1.4Z"/></svg></a>
    <a href="https://www.facebook.com/ahmedelsheshtawyofficial" target="_blank" rel="noopener" title="Facebook" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14 19v-7h2.3l.4-2.8H14V7.4c0-.8.3-1.4 1.5-1.4h1.5V3.5c-.7-.1-1.4-.2-2.2-.2-2.3 0-3.8 1.4-3.8 3.9v2H8.5V12H11v7"/></svg></a>
    <a href="https://ahmed-portfolio.ahmedelsheshtawyofficial.workers.dev/" target="_blank" rel="noopener" title="Portfolio" aria-label="Portfolio"><svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 11h16M10 11v2h4v-2"/></svg></a>
  </div>`;
  const details=`<section class="details"><div class="detail-main"><div class="detail-head"><div><div class="kicker left">Credential details</div><h2>Verification record</h2></div><span class="status ${status?'':'revoked'}">● ${status?'VALID':'REVOKED'}</span></div><div class="detail-grid"><div><span>Type</span><b>${htmlEscape(c.type||'Training')}</b></div><div><span>Level</span><b>${htmlEscape(c.level||'Intermediate')}</b></div><div><span>Format</span><b>${htmlEscape(c.format||'Online')}</b></div><div><span>Duration</span><b>${htmlEscape(c.duration||'')}</b></div><div><span>Issued</span><b>${htmlEscape(issued)}</b></div><div><span>Certificate ID</span><b>${htmlEscape(c.certificate_number)}</b></div></div>${description?`<div class="description-box"><span>Assessment description</span><p>${htmlEscape(description)}</p></div>`:''}<div class="content-block"><div class="kicker left">Skills</div><div class="skills">${content}</div></div></div><aside class="source-panel"><div class="kicker left">Source</div><h3>Credential issuer</h3><div class="source-row"><span>Issued by</span><b>${htmlEscape(c.issued_by||'Ahmed Elsheshtawy')}</b></div><div class="source-row"><span>Assessment</span><b>${htmlEscape(c.exam_title||'Assessment')}</b></div><div class="source-row"><span>Verification</span><b>Official certificate record</b></div><a class="source-link" href="${sourceUrl}" target="_blank" rel="noopener">Open source ↗</a></aside></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Verified certificate issued by Ahmed Elsheshtawy"><title>${htmlEscape(c.title)} — ${htmlEscape(c.student_name)}</title><style>
:root{--orange:#ff4d00;--black:#050505;--paper:#f4f2ec;--ink:#0a0a0a;--muted:#77736c;--line:#d7d3c9}@font-face{font-family:"Amsterdam Four_ttf";src:url("https://db.onlinewebfonts.com/t/07cb29fdcb073fff840edc6de2067b50.woff2") format("woff2"),url("https://db.onlinewebfonts.com/t/07cb29fdcb073fff840edc6de2067b50.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#e9e6dd;color:var(--ink);font-family:Inter,Arial,sans-serif}.page{max-width:1360px;width:min(96vw,1360px);margin:0 auto;padding:24px 8px 60px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:10px;color:#fff}.brand img{width:40px;height:40px;object-fit:contain}.brand-name{font-weight:800}.brand-name small{display:block;color:#aaa;font-size:10px;letter-spacing:.12em;text-transform:uppercase}.topbar{background:var(--black);padding:14px 18px;border-radius:16px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid #333;background:#111;color:#fff;border-radius:9px;padding:10px 14px;font-weight:800;font-size:12px;cursor:pointer;text-decoration:none}.btn.primary{background:var(--orange);border-color:var(--orange);color:#050505}.certificate{position:relative;min-height:660px;background:#fbfaf6;border:1px solid #cfc9bc;border-radius:24px;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,.12);padding:58px 42px 235px;display:flex;flex-direction:column;justify-content:center}.certificate:before{content:"";position:absolute;inset:18px;border:1px solid #ded9ce;border-radius:16px;pointer-events:none}.certificate:after{content:"";position:absolute;width:360px;height:360px;border:1px solid rgba(255,77,0,.14);border-radius:50%;right:-180px;top:-160px;box-shadow:0 0 0 22px rgba(255,77,0,.025),0 0 0 45px rgba(255,77,0,.018);pointer-events:none}.corner{position:absolute;width:110px;height:110px;border:2px solid var(--orange);opacity:.8}.corner.tl{left:30px;top:30px;border-right:0;border-bottom:0;border-radius:12px 0 0 0}.corner.br{right:30px;bottom:30px;border-left:0;border-top:0;border-radius:0 0 12px 0}.issuer{text-align:center;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--muted)}.brandline{display:none}.certificate-logo{display:block;width:68px;height:68px;object-fit:contain;margin:0 auto 14px;position:relative;z-index:1}.signature{position:relative;text-align:center;height:112px;padding:0;border:0;font-size:11px;color:var(--muted);display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.signature:after{content:"";width:min(220px,85%);height:1px;background:#aaa399;display:block;order:2;flex:0 0 1px}.signature b.signature-name{font-family:"Amsterdam Four_ttf","Amsterdam Four","Brush Script MT",cursive;font-weight:400;font-size:28px;line-height:1;display:block;position:static;z-index:2;white-space:nowrap;transform:none;margin:0 0 -2px}.signature span{display:block;order:3;margin-top:6px;font-size:10px}.signature b{font-weight:400}.kicker{text-align:center;color:var(--orange);font:800 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;margin-bottom:16px}.certificate h1{text-align:center;font-size:clamp(38px,6vw,68px);line-height:.95;letter-spacing:-.065em;margin:0 auto 20px;max-width:820px}.rule{width:90px;height:2px;background:var(--orange);margin:0 auto 28px}.presented{text-align:center;color:var(--muted);font-size:13px}.student{text-align:center;font-size:clamp(28px,4vw,46px);font-weight:900;letter-spacing:-.04em;margin:7px 0 15px}.completion{text-align:center;max-width:650px;margin:0 auto;color:#4f4b45;font-size:15px;line-height:1.65}.completion b{color:var(--ink)}.bottom{position:absolute;left:50%;bottom:42px;transform:translateX(-50%);width:min(820px,calc(100% - 136px));display:grid;grid-template-columns:1fr 170px 1fr;align-items:end;gap:28px}.bottom .qr{grid-column:2}.bottom .signature{grid-column:1}.bottom .meta{grid-column:3}.qr{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;text-align:center;min-width:0}.qr img{display:block;width:126px;height:126px;background:#fff;padding:6px;border:1px solid #d8d3c8;border-radius:10px;margin:0 auto 8px}.qr small{display:block;font:700 9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#777;letter-spacing:.08em;line-height:1.2;text-align:center;width:100%}.meta{text-align:right;font-size:11px;color:var(--muted);line-height:1.8}.meta b{color:var(--ink);font-size:12px}.details{margin:34px auto 0;max-width:1120px;padding:34px 36px;background:#f3f0e8;border:1px solid #ded8cc;border-radius:22px;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:30px;box-shadow:0 12px 30px rgba(0,0,0,.05)}.detail-main{min-width:0}.source-panel{border-left:1px solid #d7d0c4;padding-left:26px}.source-panel h3{margin:5px 0 18px;font-size:18px;letter-spacing:-.03em}.source-row{padding:10px 0;border-top:1px solid #ddd7cb}.source-row:first-of-type{border-top:0}.source-row span{display:block;color:#858078;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.source-row b{font-size:12px;color:var(--ink);line-height:1.4}.source-link{display:inline-flex;margin-top:14px;padding:9px 12px;border-radius:9px;background:#111;color:#fff;text-decoration:none;font-size:11px;font-weight:800}.detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.detail-head h2{margin:3px 0 0;font-size:24px;letter-spacing:-.04em}.kicker.left{text-align:left;margin:0;color:var(--orange)}.description-box{margin-top:20px;padding:14px 16px;background:#fbfaf6;border:1px solid #ddd7cb;border-radius:12px}.description-box>span{display:block;color:#858078;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px}.description-box p{margin:0;color:#4f4b45;line-height:1.65;font-size:13px}.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}.detail-grid>div{background:#fbfaf6;border:1px solid #ddd7cb;border-radius:12px;padding:12px 14px;min-height:62px}.detail-grid span{display:block;color:#858078;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}.detail-grid b{font-size:12px;color:var(--ink)}.content-block{margin-top:22px}.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.skill{display:inline-flex;padding:7px 10px;border-radius:999px;background:#fff;border:1px solid #d7d0c3;font-size:11px;font-weight:800;color:#28251f}.content-empty{color:#77736c;font-size:12px}.verify-note{margin-top:20px;text-align:center;color:#918d85;font-size:10px}.digital-tools{margin-top:16px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.digital-tools a{color:#111;background:#fff;border:1px solid #ccc5b9;border-radius:999px;padding:9px 13px;text-decoration:none;font-size:12px;font-weight:800}.status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:#eaf8ef;color:#13733d;font-size:10px;font-weight:800}.status.revoked{background:#fff0ed;color:#a6290f}.source-block{margin:24px auto 0;max-width:900px;padding:14px 18px;border:1px solid #ded8cc;border-radius:14px;background:#fbfaf6;text-align:center;color:#77736c;font-size:11px}.source-block a{color:#111;font-weight:800;text-decoration:none}.site-footer{margin:28px auto 0;max-width:900px;border-top:1px solid #d7d3c9;padding:22px 4px 0;text-align:center;color:#77736c}.site-footer-brand{display:flex;justify-content:center;align-items:center;gap:9px}.site-footer-brand img{width:30px;height:30px;object-fit:contain}.site-footer-brand b{color:#111;font-size:13px}.site-footer-role{margin-top:5px;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.site-footer-bottom{margin-top:12px;font-size:10px;color:#999}.site-footer-bottom span{margin:0 4px}.site-footer a{color:#111;font-weight:700;text-decoration:none}.certificate-contact{margin-top:14px;display:flex;justify-content:center;align-items:center;gap:9px}.certificate-contact a{width:32px;height:32px;border:1px solid #d5d0c6;border-radius:50%;display:grid;place-items:center;background:#fff;text-decoration:none;color:#111;transition:.18s ease}.certificate-contact a:hover{border-color:var(--orange);color:var(--orange);transform:translateY(-1px)}.certificate-contact svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}@media(max-width:700px){.page{padding:10px 9px 34px}.topbar{align-items:flex-start;margin-bottom:12px;padding:11px 12px;border-radius:14px}.brand img{width:34px;height:34px}.brand-name{font-size:13px}.brand-name small{font-size:8px}.actions{gap:6px}.actions .btn{padding:8px 9px;font-size:10px}.certificate{padding:34px 18px 30px;min-height:0;height:auto;display:flex;justify-content:flex-start;border-radius:18px}.certificate:before{inset:9px;border-radius:12px}.certificate:after{width:230px;height:230px;right:-120px;top:-110px}.certificate-logo{width:48px;height:48px;margin-bottom:9px}.kicker{font-size:8px;letter-spacing:.16em;margin-bottom:9px}.certificate h1{font-size:clamp(28px,8.2vw,38px);line-height:.98;max-width:100%;margin:0 auto 12px;letter-spacing:-.055em}.rule{width:60px;height:2px;margin-bottom:18px}.presented{font-size:10px}.student{font-size:clamp(22px,6.4vw,30px);line-height:1.05;margin:7px 0 11px;letter-spacing:-.045em}.completion{font-size:11px;line-height:1.5;max-width:320px}.bottom{position:static;left:auto;right:auto;bottom:auto;transform:none;width:100%;margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px 10px;align-items:end}.bottom .qr{grid-column:1/-1;grid-row:1;order:1}.bottom .signature{grid-column:1;grid-row:2;order:2}.bottom .meta{grid-column:2;grid-row:2;order:3}.qr img{width:92px;height:92px;padding:5px;border-radius:8px;margin-bottom:6px}.qr small{font-size:7px}.signature{height:72px;justify-content:flex-end;overflow:visible}.signature b.signature-name{font-size:18px;line-height:1.5;max-width:none;overflow:visible;white-space:nowrap}.signature:after{width:120px}.signature span{font-size:8px;margin-top:4px}.meta{text-align:center;font-size:8px;line-height:1.55}.meta b{font-size:9px}.meta .status{font-size:8px;padding:3px 6px}.details{margin-top:18px;padding:18px 14px;grid-template-columns:1fr;gap:18px;border-radius:17px}.detail-head h2{font-size:20px}.detail-grid{grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.detail-grid>div{padding:10px 11px;min-height:56px}.detail-grid span{font-size:8px}.detail-grid b{font-size:10px}.description-box{margin-top:14px;padding:11px 12px}.description-box>span{font-size:8px}.description-box p{font-size:11px}.source-panel{border-left:0;border-top:1px solid #d7d0c4;padding-left:0;padding-top:16px}.source-panel h3{font-size:16px;margin-bottom:12px}.source-row{padding:8px 0}.source-row span{font-size:8px}.source-row b{font-size:10px}.digital-tools{margin-top:12px}.digital-tools a{font-size:10px;padding:8px 11px}.site-footer{margin-top:20px;padding-top:16px}.site-footer-role{font-size:8px}.certificate-contact{gap:7px}.certificate-contact a{width:29px;height:29px}.certificate-contact svg{width:14px;height:14px}.site-footer-bottom{font-size:8px}}@media print{@page{size:A4 landscape;margin:0}html,body{width:100%;height:100%;background:#fff}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%;max-width:none;margin:0;padding:0}.topbar,.digital-tools,.verify-note,.details,.source-block,.site-footer{display:none}.certificate{width:100vw;height:100vh;min-height:0;aspect-ratio:auto;border:0;border-radius:0;box-shadow:none;padding:46px 44px 170px;justify-content:center}.certificate:before{inset:18px}.corner.tl{left:32px;top:32px}.corner.br{right:32px;bottom:32px}.certificate-logo{width:60px;height:60px;margin-bottom:10px}.certificate h1{font-size:clamp(38px,5.4vw,64px);max-width:820px}.bottom{left:50%;bottom:48px;transform:translateX(-50%);margin:0;width:min(900px,calc(100% - 88px));grid-template-columns:1fr 150px 1fr;gap:22px}.signature{height:86px}.signature b.signature-name{font-size:24px}.signature:after{width:190px}.qr img{width:112px;height:112px}}
</style></head><body><main class="page"><header class="topbar"><div class="brand"><img src="/ae-logo.png" alt="Ahmed Elsheshtawy"><div class="brand-name">Ahmed Elsheshtawy<small>Finance · Assessment · Credentials</small></div></div><div class="actions"><button class="btn" onclick="window.print()">Print Certificate</button><button class="btn primary" onclick="copyLink()">Copy Verification Link</button></div></header><section class="certificate"><div class="corner tl"></div><div class="corner br"></div><img class="certificate-logo" src="/ae-logo.png" alt="Ahmed Elsheshtawy"><div class="kicker">Certificate of Achievement</div><h1>${htmlEscape(c.title)}</h1><div class="rule"></div><div class="presented">This certificate is presented to</div><div class="student">${htmlEscape(c.student_name)}</div><div class="completion">For successfully completing this assessment and meeting the required criteria.</div><div class="bottom"><div class="signature"><b class="signature-name">${htmlEscape(c.issued_by||'Ahmed Elsheshtawy')}</b><span>Issuer</span></div><div class="qr"><img src="${qr}" alt="QR code for certificate verification"><small>SCAN TO VERIFY</small></div><div class="meta"><div>Issue date<br><b>${htmlEscape(issued)}</b></div><div>Certificate ID<br><b>${htmlEscape(c.certificate_number)}</b></div><div style="margin-top:5px"><span class="status ${status?'':'revoked'}">● ${status?'VALID':'REVOKED'}</span></div></div></div></section>${details}<div class="digital-tools"><a href="${htmlEscape(assessment)}">View Assessment ↗</a><a href="${htmlEscape(verify)}">Refresh verification ↗</a></div><div class="verify-note">The QR code and certificate link open the official verification page.</div><footer class="site-footer"><div class="site-footer-brand"><img src="/ae-logo.png" alt="AE"><b>Ahmed Elsheshtawy</b></div><div class="site-footer-role">Finance Assessment Platform · Financial Analysis · Financial Modeling</div>${contactIcons}<div class="site-footer-bottom">© ${new Date().getFullYear()} Ahmed Elsheshtawy. All rights reserved.<span>·</span>Built with intention.</div></footer></main><script>const verifyUrl=${JSON.stringify(verify)};async function copyLink(){try{await navigator.clipboard.writeText(verifyUrl);alert('Verification link copied.')}catch(e){prompt('Copy verification link:',verifyUrl)}}</script></body></html>`;
}

function certificateAssessmentPage(c,questions,request){
  const origin=new URL(request.url).origin;
  const esc=htmlEscape;
  const rows=(questions||[]).map((q,i)=>{
    const opts=[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([k,v])=>`<div class="option"><span>${k}</span><p>${esc(v||'')}</p></div>`).join('');
    const answer=Number(c.show_answers)===1?`<div class="answer"><b>Your answer:</b> ${esc(q.selected_answer||'No answer')} &nbsp; <b>Correct:</b> ${esc(q.correct_answer||'')}</div>`:'';
    return `<article class="question"><div class="q-head"><div class="number">${i+1}</div><h2>${esc(q.question_text||'')}</h2></div><div class="options">${opts}</div>${answer}</article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(c.exam_title||c.title||'Assessment')} — Questions</title><style>
:root{--orange:#ff4d00;--bg:#f4f2ec;--paper:#fffdf9;--ink:#111;--muted:#77736c;--line:#d9d4ca}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,Arial,sans-serif}.wrap{width:min(980px,92vw);margin:0 auto;padding:28px 0 60px}.head{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:14px 18px;background:#050505;color:#fff;border-radius:16px}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand img{width:38px;height:38px;object-fit:contain}.brand small{display:block;color:#aaa;font-size:9px;letter-spacing:.12em;text-transform:uppercase;margin-top:3px}.btn{border:1px solid #333;background:#111;color:#fff;border-radius:9px;padding:10px 13px;font-weight:800;text-decoration:none;font-size:12px}.hero{padding:42px 0 24px}.eyebrow{color:var(--orange);font:800 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}.hero h1{font-size:clamp(34px,6vw,58px);line-height:1;letter-spacing:-.055em;margin:10px 0}.hero p{color:var(--muted);line-height:1.6}.notice{border:1px solid var(--line);background:#eeeae2;border-radius:13px;padding:13px 15px;font-size:12px;margin:0 0 16px}.question{background:var(--paper);border:1px solid var(--line);border-radius:17px;padding:22px;margin:12px 0;box-shadow:0 8px 24px rgba(0,0,0,.035)}.q-head{display:grid;grid-template-columns:36px 1fr;gap:12px;align-items:start}.number{width:34px;height:34px;border-radius:10px;background:#eeeae2;border:1px solid var(--line);display:grid;place-items:center;font-weight:900;font-size:12px}.question h2{font-size:16px;line-height:1.55;margin:3px 0 0}.options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:18px 0 0 48px}.option{display:flex;gap:10px;border:1px solid var(--line);border-radius:11px;padding:12px;background:#fff}.option span{font-weight:900;color:var(--orange)}.option p{margin:0;line-height:1.5;font-size:13px}.answer{margin:15px 0 0 48px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.empty{padding:28px;text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:14px}.foot{text-align:center;color:#999;font-size:10px;padding-top:28px}@media(max-width:650px){.head{align-items:flex-start}.options{grid-template-columns:1fr;margin-left:0}.answer{margin-left:0}.wrap{width:92vw}.hero{padding-top:30px}}
</style></head><body><main class="wrap"><header class="head"><div class="brand"><img src="/ae-logo.png" alt="AE"><div>Ahmed Elsheshtawy<small>Certificate Assessment</small></div></div><a class="btn" href="${origin}/verify/${encodeURIComponent(c.certificate_number)}">Certificate ↗</a></header><section class="hero"><div class="eyebrow">Public assessment</div><h1>${esc(c.exam_title||c.title||'Assessment')}</h1><p>Certificate: <b>${esc(c.certificate_number)}</b><br>This page contains the assessment questions and does not require a student account or login.</p></section><div class="notice">Questions are publicly viewable from the certificate link. No student login is required.</div>${rows||'<div class="empty">No questions are available for this assessment.</div>'}<footer class="foot">© ${new Date().getFullYear()} Ahmed Elsheshtawy · Public certificate assessment</footer></main></body></html>`;
}
async function hashPassword(password,saltB64){
  const salt=saltB64?fromB64(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
  return {hash:toB64(bits),salt:toB64(salt)};
}
function equalBytes(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
async function verifyPassword(password,stored,salt){const x=await hashPassword(password,salt);return equalBytes(fromB64(x.hash),fromB64(stored))}
function sessionCookie(id){return cookie(SESSION_COOKIE,id,SESSION_DAYS*86400)}
function sessionId(request){return request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1]||null}
async function getSession(request,env){
  const sid=sessionId(request);if(!sid)return null;
  const row=await env.DB.prepare(`SELECT s.*,u.student_id,u.full_name,u.email,u.phone,u.status user_status,au.username,au.role,au.status admin_status FROM sessions s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN admin_users au ON au.id=s.admin_user_id WHERE s.id=? AND s.expires_at>?`).bind(sid,now()).first();
  if(!row)return null;
  if((row.user_id&&row.user_status!=='active')||(row.admin_user_id&&row.admin_status!=='active'))return null;
  // Refresh active sessions on each authenticated request so students stay signed in.
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind(now()+SESSION_DAYS*86400,sid).run();
  return row;
}
function userSession(s){return !!s?.user_id}
function adminSession(s){return !!s?.admin_user_id}
async function body(req){try{return await req.json()}catch{return null}}
function originOK(request){const origin=request.headers.get('Origin');if(!origin)return true;return origin===new URL(request.url).origin}
async function createSession(env,kind,id,request){
  const sid=randomHex(32);await env.DB.prepare(`INSERT INTO sessions(id,${kind==='user'?'user_id':'admin_user_id'},expires_at,created_at,user_agent) VALUES(?,?,?,?,?)`).bind(sid,id,now()+SESSION_DAYS*86400,now(),clean(request.headers.get('user-agent'),500)).run();return sid;
}
async function logout(request,env){const sid=sessionId(request);if(sid)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();return new Response(null,{status:204,headers:{'set-cookie':clearCookie(SESSION_COOKIE)}})}
function adminOnly(s){return adminSession(s)?null:bad('Admin authorization required',403)}

async function api(request,env,ctx){
  const url=new URL(request.url),p=url.pathname,m=request.method,s=await getSession(request,env);
  if(!originOK(request))return bad('Invalid request origin',403);

  if(m==='GET'&&p==='/api/public/certificate-verify'){
    const number=clean(url.searchParams.get('id'),100).toUpperCase();
    if(!number)return bad('Certificate ID is required',400);
    const cert=await env.DB.prepare(`
      SELECT c.certificate_number,c.status,c.title,c.type,c.level,c.format,c.duration,c.issued_at,
             c.issued_by,u.full_name AS student_name,e.title AS exam_title
      FROM certificates c
      JOIN users u ON u.id=c.user_id
      JOIN exams e ON e.id=c.exam_id
      WHERE upper(c.certificate_number)=?
    `).bind(number).first();
    if(!cert)return bad('Certificate ID not found',404);
    return json({verified:true,certificate:{id:cert.certificate_number,status:cert.status,title:cert.title,recipient:cert.student_name,issuedAt:cert.issued_at,issuedBy:cert.issued_by||'Ahmed Elsheshtawy',assessment:cert.exam_title,type:cert.type,level:cert.level,format:cert.format,duration:cert.duration}});
  }
  if(m==='GET'&&p.match(/^\/api\/public\/certificate-exam\/[^/]+$/)){
    const number=decodeURIComponent(p.split('/')[4]||'');
    if(!number)return bad('Certificate not found',404);
    const cert=await env.DB.prepare(`SELECT c.certificate_number,c.status,c.show_answers,c.attempt_id,c.user_id,c.exam_id,c.score,c.percentage,c.title,c.issued_at,u.full_name AS student_name,e.title AS exam_title,e.description,e.passing_percentage,e.certificate_type,e.certificate_level,e.certificate_format,e.certificate_duration,e.certificate_description,e.certificate_skills_json FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?`).bind(number).first();
    if(!cert)return bad('Certificate not found',404);
    const qs=await env.DB.prepare(`SELECT q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.points,q.sort_order${Number(cert.show_answers)===1?',q.correct_answer,a.selected_answer,a.is_correct,a.points_earned':''} FROM questions q ${Number(cert.show_answers)===1?'LEFT JOIN answers a ON a.question_id=q.id AND a.attempt_id=? ':''}WHERE q.exam_id=? ORDER BY q.sort_order,q.id`).bind(...(Number(cert.show_answers)===1?[String(cert.attempt_id),cert.exam_id]:[cert.exam_id])).all();
    return json({certificate:{certificateNumber:cert.certificate_number,status:cert.status,showAnswers:Number(cert.show_answers)===1,title:cert.title,studentName:cert.student_name,examTitle:cert.exam_title,score:Number(cert.score),percentage:Number(cert.percentage),issuedAt:cert.issued_at},exam:{title:cert.exam_title,description:cert.description,passingPercentage:Number(cert.passing_percentage),type:cert.certificate_type,level:cert.certificate_level,format:cert.certificate_format,duration:cert.certificate_duration,certificateDescription:cert.certificate_description,skills:parseSkills(cert.certificate_skills_json)},questions:qs.results||[]});
  }
  if(m==='GET'&&p.match(/^\/(?:verify|certificate)\/[^/]+$/)){const number=decodeURIComponent(p.split('/')[2]||'');const c=number?await env.DB.prepare('SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?').bind(number).first():null;if(!c)return new Response('<h1>Certificate not found</h1>',{status:404,headers:{'content-type':'text/html; charset=utf-8'}});return new Response(credentialPage(c,request),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60'}})}
  if(m==='POST'&&p==='/api/setup/admin'){
    const secret=request.headers.get('x-bootstrap-secret')||'';if(!env.ADMIN_BOOTSTRAP_SECRET||secret!==env.ADMIN_BOOTSTRAP_SECRET)return bad('Forbidden',403);
    const count=await env.DB.prepare('SELECT COUNT(*) c FROM admin_users').first();if(Number(count?.c||0)>0)return bad('Admin bootstrap is already locked',409);
    const b=await body(request);const username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password))return bad('Valid username and 8+ character password required');
    const ph=await hashPassword(b.password);await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,'super_admin','active').run();return json({ok:true});
  }
  if(m==='POST'&&p==='/api/auth/register'){
    const b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30);if(!name||!email||!emailOK(email)||!passwordOK(b?.password)||!phoneOK(phone))return bad('Full name, valid email, valid phone and password of 8–128 characters are required');
    let studentId=clean(b?.studentId,30).toUpperCase();if(studentId&&!/^STU-[A-Z0-9]{6,12}$/.test(studentId))return bad('Student ID must look like STU-ABC123456');
    if(!studentId){for(let i=0;i<10;i++){studentId=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;const x=await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(studentId).first();if(!x)break}}
    const existing=await env.DB.prepare('SELECT id FROM users WHERE student_id=? OR email=?').bind(studentId,email).first();if(existing)return bad('Student ID or email already exists',409);
    const ph=await hashPassword(b.password),r=await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,password_hash,password_salt) VALUES(?,?,?,?,?,?)').bind(studentId,name,email,phone,ph.hash,ph.salt).run();
    const sid=await createSession(env,'user',r.meta.last_row_id,request);return json({ok:true,studentId,user:{studentId,fullName:name,email,phone}},201,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/login'){
    const b=await body(request),ident=clean(b?.identifier,160).toLowerCase();if(!ident||!passwordOK(b?.password))return bad('Identifier and password are required');
    const u=await env.DB.prepare('SELECT * FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(ident,ident).first();if(!u||u.status!=='active'||!(await verifyPassword(b.password,u.password_hash,u.password_salt)))return bad('Invalid credentials',401);
    const sid=await createSession(env,'user',u.id,request);return json({ok:true,user:{studentId:u.student_id,fullName:u.full_name,email:u.email}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/admin/login'){
    const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!username||!passwordOK(b?.password))return bad('Username and password are required');
    const a=await env.DB.prepare('SELECT * FROM admin_users WHERE lower(username)=?').bind(username).first();if(!a||a.status!=='active'||!(await verifyPassword(b.password,a.password_hash,a.password_salt)))return bad('Invalid admin credentials',401);
    const sid=await createSession(env,'admin',a.id,request);return json({ok:true,admin:{username:a.username,role:a.role}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/logout')return logout(request,env);
  if(m==='GET'&&p==='/api/auth/me')return json({authenticated:!!s,user:userSession(s)?{studentId:s.student_id,fullName:s.full_name,email:s.email,phone:s.phone}:null,admin:adminSession(s)?{username:s.username,role:s.role}:null});

  if(m==='GET'&&p==='/api/exams'){
    if(!userSession(s)&&!adminSession(s))return bad('Unauthorized',401);
    const rows=await env.DB.prepare(`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.status,e.created_at,e.attachments_json,e.desktop_required,e.available_from,e.expires_at,e.certificate_enabled,e.certificate_title,e.certificate_issued_by,e.certificate_type,e.certificate_level,e.certificate_format,e.certificate_duration,e.certificate_description,e.certificate_skills_json,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ${adminSession(s)?'':'WHERE e.status=\'active\' AND (e.expires_at IS NULL OR e.expires_at>datetime(\'now\'))'} ORDER BY COALESCE(e.available_from,e.created_at) ASC,e.created_at DESC`).all();const results=(rows.results||[]).map(e=>({...e,attachments:parseAttachments(e.attachments_json)}));return json(results);
  }
  if(m==='GET'&&p.match(/^\/api\/exams\/\d+\/start$/)){
    if(!userSession(s))return bad('Unauthorized',401);const id=idNum(p.split('/')[3]);const e=id?await env.DB.prepare('SELECT id,title,description,duration_minutes,passing_percentage,attachments_json,desktop_required FROM exams WHERE id=? AND status=\'active\'').bind(id).first():null;if(!e)return bad('Exam not found',404);
    if(Number(e.desktop_required)===1 && /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(request.headers.get('user-agent')||'')){return json({ok:false,canEnter:false,reason:'desktop_required',error:'This assessment must be taken on a desktop or laptop.',message:'This assessment must be taken on a desktop or laptop.'},409)}
    const schedule=availabilityState(e.available_from,e.expires_at);if(schedule==='scheduled')return json({ok:false,canEnter:false,reason:'not_started',error:'This assessment is not open yet.',message:'This assessment is not open yet.',availableFrom:e.available_from},409);if(schedule==='expired')return json({ok:false,canEnter:false,reason:'expired',error:'This assessment is no longer available.',message:'This assessment is no longer available.'},410)
    const previousResult=await env.DB.prepare("SELECT id,passed,percentage,created_at FROM results WHERE exam_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(id,s.user_id).first();
    if(previousResult&&Number(previousResult.passed)===1){
      return json({ok:false,canEnter:false,reason:'already_passed',error:'لا يمكن دخول الامتحان مرة أخرى لأنك اجتزت هذا الامتحان بالفعل.',message:'لا يمكن دخول الامتحان مرة أخرى لأنك اجتزت هذا الامتحان بالفعل.',result:{percentage:Number(previousResult.percentage),passed:true}},409);
    }

    let attempt=await env.DB.prepare("SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='in_progress' ORDER BY id DESC LIMIT 1").bind(id,s.user_id).first();
    if(!attempt){
      await env.DB.prepare("INSERT INTO exam_attempts(exam_id,user_id,status) VALUES(?,?, 'in_progress') ON CONFLICT(exam_id,user_id,status) DO NOTHING").bind(id,s.user_id).run();
      attempt=await env.DB.prepare("SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='in_progress' ORDER BY id DESC LIMIT 1").bind(id,s.user_id).first();
      if(!attempt)return bad('Could not create exam attempt',500);
    }
    const age=(Date.now()-Date.parse(attempt.started_at))/60000;if(age>e.duration_minutes+0.5){await env.DB.prepare("UPDATE exam_attempts SET status='expired',submitted_at=CURRENT_TIMESTAMP WHERE id=?").bind(attempt.id).run();return bad('This attempt has expired',409)}
    const qs=await env.DB.prepare('SELECT id,question_text,option_a,option_b,option_c,option_d,points,sort_order,attachments_json FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();const exam={...e};delete exam.attachments_json;const questions=(qs.results||[]).map(q=>{const x={...q,attachments:parseAttachments(q.attachments_json)};delete x.attachments_json;return x});return json({exam,attachments:parseAttachments(e.attachments_json),attemptId:attempt.id,startedAt:attempt.started_at,questions});
  }
  if(m==='POST'&&p.match(/^\/api\/attempts\/\d+\/submit$/)){
    if(!userSession(s))return bad('Unauthorized',401);

    const id=idNum(p.split('/')[3]);
    const b=await body(request);

    if(!id||!Array.isArray(b?.answers)){
      return bad('Answers are required');
    }

    try{
      const a=await env.DB.prepare(`SELECT a.*,e.passing_percentage,e.duration_minutes,e.title,e.description,e.certificate_enabled,e.certificate_title,e.certificate_issued_by,e.certificate_type,e.certificate_level,e.certificate_format,e.certificate_duration,e.certificate_description,e.certificate_skills_json FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.user_id=?`).bind(id,s.user_id).first();

      if(!a)return bad('Attempt not found',404);

      if(a.status!=='in_progress'){
        const existing=await env.DB.prepare(`SELECT r.score,r.total_points,r.percentage,r.passed,r.exam_id,e.title AS examTitle,e.passing_percentage FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.attempt_id=?`).bind(id).first();
        if(existing){
          const qCount=await env.DB.prepare('SELECT COUNT(*) AS c FROM questions WHERE exam_id=?').bind(existing.exam_id).first();
          const answered=await env.DB.prepare('SELECT COUNT(*) AS c FROM answers WHERE attempt_id=? AND selected_answer IS NOT NULL').bind(id).first();
          let certificate=null;
          let certificateError=null;
          let certificateEmail=null;
          if(Number(existing.passed)===1 && Number(a.certificate_enabled??1)===1){
            try{
              certificate=await ensureCertificate(env,request,{attemptId:id,userId:s.user_id,examId:existing.exam_id,a,score:Number(existing.score),total:Number(existing.total_points),percentage:Number(existing.percentage)});
              if(certificate?.created){try{certificateEmail=await sendCertificateEmail(env,{to:s.email||a.email,studentName:s.full_name||a.full_name,certificateTitle:a.certificate_title||`${a.title} Certificate`,examTitle:a.title,verificationUrl:certificate.verificationUrl,certificateNumber:certificate.certificateNumber,percentage:Number(existing.percentage),issuedAt:certificate.issuedAt});}catch(emailError){certificateEmail={sent:false,error:String(emailError?.message||emailError)};console.error('CERTIFICATE EMAIL ERROR',emailError?.message||emailError);}}
            }catch(certError){
              certificateError=String(certError?.message||certError);
              console.error('CERTIFICATE ISSUE ERROR:',certificateError);
            }
          }
          return json({ok:true,result:{
            score:Number(existing.score),
            totalPoints:Number(existing.total_points),
            percentage:Number(existing.percentage),
            passed:Number(existing.passed),
            examTitle:existing.examTitle,
            examId:existing.exam_id,
            passingPercentage:Number(existing.passing_percentage),
            questionCount:Number(qCount?.c||0),
            answeredCount:Number(answered?.c||0),
            submittedAt:a.submitted_at||null,
            certificate,
            certificateError,
            certificateEmail
          }});
        }
        return bad('Attempt already submitted',409);
      }

      const age=(Date.now()-Date.parse(a.started_at))/60000;

      if(!Number.isFinite(age))return bad('Invalid attempt start time',500);

      if(age>Number(a.duration_minutes)+0.5){
        await env.DB.prepare(`UPDATE exam_attempts SET status='expired',submitted_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
        return bad('Time expired',409);
      }

      const qs=(await env.DB.prepare(`SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order,id`).bind(a.exam_id).all()).results||[];
      const incoming=new Map(b.answers.map(x=>[Number(x.questionId),['A','B','C','D'].includes(x.answer)?x.answer:null]));

      // Manual submission is allowed only when every question has an answer.
      // Automatic timer expiry may still submit the attempt with unanswered questions.
      if(!b.expired){
        const missing=qs.filter(q=>!incoming.get(q.id));
        if(missing.length)return json({ok:false,error:`Please answer all ${missing.length} remaining question${missing.length===1?'':'s'} before submitting.`},400);
      }

      let score=0,total=0;

      for(const q of qs){
        const points=Number(q.points)||0;
        total+=points;
        const selected=incoming.get(q.id)||null;
        const correct=selected!==null&&selected===q.correct_answer;
        const earned=correct?points:0;
        score+=earned;

        await env.DB.prepare(`INSERT INTO answers(attempt_id,question_id,selected_answer,is_correct,points_earned) VALUES(?,?,?,?,?) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_answer=excluded.selected_answer,is_correct=excluded.is_correct,points_earned=excluded.points_earned`).bind(id,q.id,selected,correct?1:0,earned).run();
      }

      const percentage=total>0?(score/total)*100:0;
      const passed=percentage>=Number(a.passing_percentage)?1:0;

      await env.DB.prepare(`UPDATE exam_attempts SET status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();

      await env.DB.prepare(`INSERT INTO results(attempt_id,user_id,exam_id,score,total_points,percentage,passed) VALUES(?,?,?,?,?,?,?) ON CONFLICT(attempt_id) DO UPDATE SET score=excluded.score,total_points=excluded.total_points,percentage=excluded.percentage,passed=excluded.passed`).bind(id,s.user_id,a.exam_id,score,total,percentage,passed).run();
      let certificate=null;
      let certificateError=null;
      let certificateEmail=null;
      if(passed && Number(a.certificate_enabled??1)===1){
        try{
          certificate=await ensureCertificate(env,request,{attemptId:id,userId:s.user_id,examId:a.exam_id,a,score,total,percentage});
          if(certificate?.created){try{certificateEmail=await sendCertificateEmail(env,{to:s.email||a.email,studentName:s.full_name||a.full_name,certificateTitle:a.certificate_title||`${a.title} Certificate`,examTitle:a.title,verificationUrl:certificate.verificationUrl,certificateNumber:certificate.certificateNumber,percentage,issuedAt:certificate.issuedAt});}catch(emailError){certificateEmail={sent:false,error:String(emailError?.message||emailError)};console.error('CERTIFICATE EMAIL ERROR',emailError?.message||emailError);}}
        }catch(certError){
          certificateError=String(certError?.message||certError);
          console.error('CERTIFICATE ISSUE ERROR:',certificateError);
        }
      }
      return json({ok:true,result:{score,totalPoints:total,percentage,passed,examTitle:a.title,examId:a.exam_id,passingPercentage:Number(a.passing_percentage),questionCount:qs.length,answeredCount:[...incoming.values()].filter(Boolean).length,submittedAt:new Date().toISOString(),certificate,certificateError,certificateEmail}});
    }catch(e){
      console.error('EXAM SUBMIT ERROR:',e?.message||e);
      return json({error:'Exam submission failed',details:String(e?.message||e)},500);
    }
  }

  if(m==='GET'&&p.match(/^\/api\/results\/\d+$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const resultId=idNum(p.split('/')[3]);
    if(!resultId)return bad('Invalid result');
    const result=await env.DB.prepare(`
      SELECT r.*,e.title,e.description,e.passing_percentage,
             e.certificate_enabled,e.certificate_title,e.certificate_issued_by,
             e.certificate_type,e.certificate_level,e.certificate_format,
             e.certificate_duration,e.certificate_description,e.certificate_skills_json,
             u.student_id,u.full_name,u.email
      FROM results r
      JOIN exams e ON e.id=r.exam_id
      JOIN users u ON u.id=r.user_id
      WHERE r.id=? AND r.user_id=?
    `).bind(resultId,s.user_id).first();
    if(!result)return bad('Result not found',404);
    const answers=await env.DB.prepare(`
      SELECT a.question_id,a.selected_answer,a.is_correct,a.points_earned,
             q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,
             q.correct_answer,q.points,q.sort_order
      FROM answers a
      JOIN questions q ON q.id=a.question_id
      WHERE a.attempt_id=?
      ORDER BY q.sort_order,q.id
    `).bind(result.attempt_id).all();

    // Always return an already-issued certificate. If a student has a passing
    // result but no certificate yet, recover it here. Certificate failures are
    // isolated so the Results page itself never becomes a 500.
    let certificate=null;
    if(Number(result.passed)===1){
      const existingCert=await env.DB.prepare(
        'SELECT certificate_number,status,show_answers FROM certificates WHERE attempt_id=?'
      ).bind(String(result.attempt_id)).first();
      if(existingCert){
        certificate={
          certificateNumber:existingCert.certificate_number,
          verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(existingCert.certificate_number)}`,
          status:existingCert.status,
          showAnswers:Number(existingCert.show_answers)===1
        };
      }else{
        try{
          certificate=await ensureCertificate(env,request,{
            attemptId:result.attempt_id,
            userId:s.user_id,
            examId:result.exam_id,
            a:result,
            score:Number(result.score),
            total:Number(result.total_points),
            percentage:Number(result.percentage)
          });
          if(certificate?.created){const emailTask=sendCertificateEmail(env,{to:result.email||s.email,studentName:result.full_name||s.full_name,certificateTitle:result.certificate_title||`${result.title} Certificate`,examTitle:result.title,verificationUrl:certificate.verificationUrl,certificateNumber:certificate.certificateNumber,percentage:Number(result.percentage),issuedAt:certificate.issuedAt||result.issued_at}).catch(e=>console.error('CERTIFICATE EMAIL ERROR:',e?.message||e));if(ctx?.waitUntil)ctx.waitUntil(emailTask);else await emailTask;}
        }catch(certError){
          console.error('CERTIFICATE RECOVERY ERROR:',certError?.message||certError);
          certificate=null;
        }
      }
    }
    delete result.certificate_enabled;
    delete result.certificate_title;
    delete result.certificate_issued_by;
    delete result.certificate_type;
    delete result.certificate_level;
    delete result.certificate_format;
    delete result.certificate_duration;
    delete result.certificate_description;
    delete result.certificate_skills_json;
    return json({result,answers:answers.results||[],certificate});
  }

  if(m==='GET'&&p.match(/^\/api\/results\/\d+$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const id=idNum(p.split('/')[3]);
    if(!id)return bad('Invalid result');
    const r=await env.DB.prepare(`SELECT r.*,u.student_id,u.full_name,u.email,e.title,e.passing_percentage FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE r.id=? AND r.user_id=?`).bind(id,s.user_id).first();
    if(!r)return bad('Result not found',404);
    const answers=await env.DB.prepare(`SELECT a.*,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.points FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY q.sort_order,q.id`).bind(r.attempt_id).all();
    const cert=await env.DB.prepare(`SELECT certificate_number,show_answers FROM certificates WHERE attempt_id=? AND user_id=? AND status='valid'`).bind(r.attempt_id,s.user_id).first();
    const certificate=cert?{certificateNumber:cert.certificate_number,showAnswers:Number(cert.show_answers)===1,verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(cert.certificate_number)}`} : null;
    return json({result:r,answers:answers.results||[],certificate});
  }
  if(m==='GET'&&p==='/api/results'){
    if(!userSession(s))return bad('Unauthorized',401);
    const rows=await env.DB.prepare(`SELECT r.*,e.title,e.passing_percentage,c.certificate_number,c.show_answers AS certificate_show_answers FROM results r JOIN exams e ON e.id=r.exam_id LEFT JOIN certificates c ON c.attempt_id=r.attempt_id AND c.status='valid' WHERE r.user_id=? ORDER BY r.created_at DESC`).bind(s.user_id).all();
    return json(rows.results||[]);
  }

  if(m==='POST'&&p.match(/^\/api\/certificates\/[^/]+\/answer-visibility$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const number=decodeURIComponent(p.split('/')[3]||'');
    const b=await body(request);const show=b?.showAnswers===true||Number(b?.showAnswers)===1;
    if(!number)return bad('Certificate not found',404);
    const cert=await env.DB.prepare('SELECT id FROM certificates WHERE certificate_number=? AND user_id=?').bind(number,s.user_id).first();
    if(!cert)return bad('Certificate not found',404);
    await env.DB.prepare('UPDATE certificates SET show_answers=? WHERE id=?').bind(show?1:0,cert.id).run();
    return json({ok:true,showAnswers:show});
  }
  if(adminSession(s)){
    if(m==='GET'&&p==='/api/admin/stats'){
      const queries=[
        'SELECT COUNT(*) c FROM users',
        'SELECT COUNT(*) c FROM exams',
        "SELECT COUNT(*) c FROM exams WHERE status='active' AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))",
        'SELECT COUNT(*) c FROM exam_attempts',
        "SELECT COUNT(*) c FROM results",
        'SELECT COUNT(*) c FROM questions',
        'SELECT AVG(percentage) avg FROM results',
        'SELECT COALESCE(SUM(passed),0) passed,COUNT(*) total FROM results',
        'SELECT COALESCE(SUM(CASE WHEN passed=0 THEN 1 ELSE 0 END),0) failed FROM results',
        "SELECT COUNT(*) c FROM exams WHERE available_from IS NOT NULL AND julianday(available_from)>julianday('now')"
      ];
      const [u,e,ae,a,r,q,avg,pr,fr,se]=await Promise.all(queries.map(x=>env.DB.prepare(x).first()));
      return json({students:Number(u.c),exams:Number(e.c),activeExams:Number(ae.c),attempts:Number(a.c),completedAttempts:Number(r.c),questions:Number(q.c),averagePercentage:Number(avg.avg||0),passedResults:Number(pr.passed||0),failedResults:Number(fr.failed||0),passRate:Number(pr.total?100*pr.passed/pr.total:0),scheduledExams:Number(se.c)});
    }
    if(m==='GET'&&p==='/api/admin/students'){
      const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare('SELECT id,student_id,full_name,email,phone,status,created_at FROM users WHERE student_id LIKE ? OR full_name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY created_at DESC').bind(like,like,like,like).all();return json(rows.results||[]);
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid student');const u=await env.DB.prepare('SELECT id,student_id,full_name,email,phone,status,created_at FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);const results=await env.DB.prepare('SELECT r.*,e.title FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(id).all();return json({student:u,results:results.results||[]})}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.status,id).run();return json({ok:true})}
    if(m==='POST'&&p.match(/^\/api\/admin\/students\/\d+\/reset-password$/)){
      const id=idNum(p.split('/')[4]),b=await body(request),newPassword=typeof b?.newPassword==='string'?b.newPassword:'';
      if(!id||!passwordOK(newPassword))return bad('Password must be 8–128 characters');
      const u=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);
      const ph=await hashPassword(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(ph.hash,ph.salt,id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
      return json({ok:true,message:'Student password updated. Existing student sessions were signed out.'});
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){
      const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]);
      if(!id)return bad('Invalid exam');
      const exam=await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE e.id=?`).bind(id).first();
      if(!exam)return bad('Exam not found',404);
      return json({...exam,attachments:parseAttachments(exam.attachments_json)});
    }
    if(m==='GET'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const rows=await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ORDER BY e.created_at DESC`).all();return json(rows.results||[]);
    }
    if(m==='POST'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const b=await body(request),title=clean(b?.title,200),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),attachments=normalizeAttachments(b?.attachments),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!title||!Number.isInteger(duration)||duration<1||duration>600||!Number.isFinite(pass)||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;const r=await env.DB.prepare('INSERT INTO exams(title,description,duration_minutes,passing_percentage,status,created_by,attachments_json,desktop_required,available_from,expires_at,certificate_enabled,certificate_title,certificate_issued_by,certificate_type,certificate_level,certificate_format,certificate_duration,certificate_description,certificate_skills_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(title,clean(b?.description),duration,pass,b?.status==='active'?'active':'inactive',s.admin_user_id,JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,b?.certificateEnabled===false?0:1,clean(b?.certificateTitle,200),clean(b?.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b?.certificateType||'Training',80),clean(b?.certificateLevel||'Intermediate',80),clean(b?.certificateFormat||'Online',80),clean(b?.certificateDuration,80),clean(b?.certificateDescription||'',10000),JSON.stringify(parseSkills(b?.certificateSkills))).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]),b=await body(request),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!id||!clean(b?.title)||!Number.isInteger(duration)||duration<1||duration>600||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;if(Object.prototype.hasOwnProperty.call(b,'attachments')){const attachments=normalizeAttachments(b.attachments);await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,attachments_json=?,desktop_required=?,available_from=?,expires_at=?,certificate_enabled=?,certificate_title=?,certificate_issued_by=?,certificate_type=?,certificate_level=?,certificate_format=?,certificate_duration=?,certificate_description=?,certificate_skills_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,b.certificateEnabled===false?0:1,clean(b.certificateTitle,200),clean(b.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b.certificateType||'Training',80),clean(b.certificateLevel||'Intermediate',80),clean(b.certificateFormat||'Online',80),clean(b.certificateDuration,80),clean(b.certificateDescription||'',10000),JSON.stringify(parseSkills(b.certificateSkills)),id).run()}else{await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,desktop_required=?,available_from=?,expires_at=?,certificate_enabled=?,certificate_title=?,certificate_issued_by=?,certificate_type=?,certificate_level=?,certificate_format=?,certificate_duration=?,certificate_description=?,certificate_skills_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',desktopRequired,availableFrom,expiresAt,b.certificateEnabled===false?0:1,clean(b.certificateTitle,200),clean(b.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b.certificateType||'Training',80),clean(b.certificateLevel||'Intermediate',80),clean(b.certificateFormat||'Online',80),clean(b.certificateDuration,80),clean(b.certificateDescription||'',10000),JSON.stringify(parseSkills(b.certificateSkills)),id).run()}return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){
      const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]);
      if(!id)return bad('Invalid exam');
      const exists=await env.DB.prepare('SELECT id FROM exams WHERE id=?').bind(id).first();
      if(!exists)return bad('Exam not found',404);
      try{
        // Delete dependants in a strict parent/child order.  This is intentionally
        // sequential instead of one D1 batch so an older/partially migrated DB
        // cannot make the whole delete fail with an opaque 500.
        await env.DB.prepare('DELETE FROM certificates WHERE exam_id=?').bind(String(id)).run();
        const attempts=await env.DB.prepare('SELECT id FROM exam_attempts WHERE exam_id=?').bind(id).all();
        for(const row of (attempts.results||[])){
          await env.DB.prepare('DELETE FROM answers WHERE attempt_id=?').bind(row.id).run();
        }
        await env.DB.prepare('DELETE FROM results WHERE exam_id=?').bind(id).run();
        await env.DB.prepare('DELETE FROM exam_attempts WHERE exam_id=?').bind(id).run();
        await env.DB.prepare('DELETE FROM questions WHERE exam_id=?').bind(id).run();
        await env.DB.prepare('DELETE FROM exams WHERE id=?').bind(id).run();
        return json({ok:true});
      }catch(e){
        console.error('EXAM DELETE ERROR',e);
        return bad(`Unable to delete exam: ${e?.message||'database error'}`,500);
      }
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/exams\/\d+\/questions$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid exam');const rows=await env.DB.prepare('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();return json((rows.results||[]).map(q=>({...q,attachments:parseAttachments(q.attachments_json)})))}
    if(m==='POST'&&p==='/api/admin/questions/bulk'){
      const b=await body(request),examId=idNum(b?.examId),items=Array.isArray(b?.questions)?b.questions:[];
      if(!examId||!items.length||items.length>200)return bad('Provide 1–200 questions');
      const exam=await env.DB.prepare('SELECT id FROM exams WHERE id=?').bind(examId).first();if(!exam)return bad('Exam not found',404);
      const statements=[];
      for(let i=0;i<items.length;i++){
        const q=items[i]||{},points=Number(q.points??1),sortOrder=Number(q.sortOrder??i+1),correct=String(q.correctAnswer||'').trim().toUpperCase();
        if(!clean(q.questionText)||!clean(q.optionA)||!clean(q.optionB)||!clean(q.optionC)||!clean(q.optionD)||!['A','B','C','D'].includes(correct)||!Number.isFinite(points)||points<=0||!Number.isInteger(sortOrder))return bad(`Invalid question data on row ${i+2}`);
        statements.push(env.DB.prepare('INSERT INTO questions(exam_id,question_text,option_a,option_b,option_c,option_d,correct_answer,points,sort_order,attachments_json) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(examId,clean(q.questionText),clean(q.optionA),clean(q.optionB),clean(q.optionC),clean(q.optionD),correct,points,sortOrder,'[]'));
      }
      await env.DB.batch(statements);
      return json({ok:true,inserted:items.length});
    }
    if(m==='POST'&&p==='/api/admin/questions'){
      const b=await body(request),examId=idNum(b?.examId),points=Number(b?.points||1),attachments=normalizeAttachments(b?.attachments);if(!examId||!clean(b?.questionText)||!clean(b?.optionA)||!clean(b?.optionB)||!clean(b?.optionC)||!clean(b?.optionD)||!['A','B','C','D'].includes(b?.correctAnswer)||!Number.isFinite(points)||points<=0)return bad('Invalid question fields');const r=await env.DB.prepare('INSERT INTO questions(exam_id,question_text,option_a,option_b,option_c,option_d,correct_answer,points,sort_order,attachments_json) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(examId,clean(b.questionText),clean(b.optionA),clean(b.optionB),clean(b.optionC),clean(b.optionD),b.correctAnswer,points,Number(b.sortOrder||0),JSON.stringify(attachments)).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/questions\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request),points=Number(b?.points||1),attachments=normalizeAttachments(b?.attachments);if(!id||!clean(b?.questionText)||!['A','B','C','D'].includes(b?.correctAnswer)||points<=0)return bad('Invalid question fields');await env.DB.prepare('UPDATE questions SET question_text=?,option_a=?,option_b=?,option_c=?,option_d=?,correct_answer=?,points=?,sort_order=?,attachments_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.questionText),clean(b.optionA),clean(b.optionB),clean(b.optionC),clean(b.optionD),b.correctAnswer,points,Number(b.sortOrder||0),JSON.stringify(attachments),id).run();return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/questions\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid question');await env.DB.prepare('DELETE FROM questions WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='GET'&&p==='/api/admin/certificates'){const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare('SELECT c.*,u.student_id,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ? ORDER BY c.issued_at DESC').bind(like,like,like,like).all();return json(rows.results||[])}
    if(m==='GET'&&p.match(/^\/api\/admin\/certificates\/[^/]+$/)){const id=clean(p.split('/')[4],100);if(!id)return bad('Invalid certificate');const c=await env.DB.prepare('SELECT c.*,u.student_id,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.id=?').bind(id).first();if(!c)return bad('Certificate not found',404);return json(c)}
    if(m==='POST'&&p.match(/^\/api\/admin\/certificates\/[^/]+\/revoke$/)){const id=clean(p.split('/')[4],100),b=await body(request);if(!id)return bad('Invalid certificate');await env.DB.prepare("UPDATE certificates SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revocation_reason=? WHERE id=?").bind(clean(b?.reason,500),id).run();return json({ok:true})}
    if(m==='POST'&&p.match(/^\/api\/admin\/certificates\/[^/]+\/restore$/)){const id=clean(p.split('/')[4],100);if(!id)return bad('Invalid certificate');await env.DB.prepare("UPDATE certificates SET status='valid',revoked_at=NULL,revocation_reason=NULL WHERE id=?").bind(id).run();return json({ok:true})}
    if(m==='GET'&&p==='/api/admin/results'){const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ? ORDER BY r.created_at DESC').bind(like,like,like,like).all();return json(rows.results||[])}
    if(m==='GET'&&p==='/api/admin/results/stats'){const d=await env.DB.prepare('SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN passed=1 THEN 1 ELSE 0 END),0) passed,COALESCE(SUM(CASE WHEN passed=0 THEN 1 ELSE 0 END),0) failed,COALESCE(AVG(percentage),0) average,COALESCE(MAX(percentage),0) highest,COALESCE(MIN(percentage),0) lowest FROM results').first();return json({total:Number(d.total||0),passed:Number(d.passed||0),failed:Number(d.failed||0),average:Number(d.average||0),highest:Number(d.highest||0),lowest:Number(d.lowest||0),passRate:Number(d.total?100*d.passed/d.total:0)})}
    if(m==='GET'&&p.match(/^\/api\/admin\/results\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid result');const r=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title,e.passing_percentage FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE r.id=?').bind(id).first();if(!r)return bad('Result not found',404);const answers=await env.DB.prepare('SELECT a.*,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.points FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY q.sort_order,q.id').bind(r.attempt_id).all();return json({result:r,answers:answers.results||[]})}
    if(m==='GET'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const rows=await env.DB.prepare('SELECT id,username,role,status,created_at FROM admin_users ORDER BY created_at DESC').all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password)||!['admin','super_admin'].includes(b?.role||'admin'))return bad('Invalid admin fields');const exists=await env.DB.prepare('SELECT id FROM admin_users WHERE username=?').bind(username).first();if(exists)return bad('Username already exists',409);const ph=await hashPassword(b.password);const r=await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,b.role,'active').run();return json({id:r.meta.last_row_id},201)}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/admins\/\d+$/)){if(s.role!=='super_admin')return bad('Super admin required',403);const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE admin_users SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true})}
  }
  return bad('Not found',404);
}

export default {async fetch(request,env,ctx){try{
  const url=new URL(request.url);
  const path=url.pathname;
  if(path==='/verify'||path==='/verify/')return env.ASSETS.fetch(new Request(new URL('/',request.url),request));
  const certificateMatch=path.match(/^\/certificate\/([^/]+)\/?$/);
  if(certificateMatch){
    const certificateNumber=decodeURIComponent(certificateMatch[1]);
    const c=await env.DB.prepare(
      'SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?'
    ).bind(certificateNumber).first();
    if(!c)return new Response('<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Certificate Not Found</title></head><body style=\"font-family:system-ui;padding:40px\"><h1>Certificate Not Found</h1><p>The certificate ID is invalid or the certificate does not exist.</p></body></html>',{status:404,headers:{'content-type':'text/html;charset=UTF-8'}});
    return new Response(credentialPage(c,request),{status:200,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'}});
  }
  const verifyMatch=path.match(/^\/verify\/([^/]+)\/?$/);
  if(verifyMatch){
    const certificateNumber=decodeURIComponent(verifyMatch[1]);
    const c=await env.DB.prepare(
      'SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?'
    ).bind(certificateNumber).first();
    if(!c)return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate Not Found</title></head><body style="font-family:system-ui;padding:40px"><h1>Certificate Not Found</h1><p>The certificate ID is invalid or the certificate does not exist.</p></body></html>',{status:404,headers:{'content-type':'text/html;charset=UTF-8'}});
    return new Response(credentialPage(c,request),{status:200,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'}});
  }
  if(path.match(/^\/exam-review\/\d+\/?$/))return env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));
  const assessmentMatch=path.match(/^\/certificate-exam\/([^/]+)\/?$/);
  if(assessmentMatch){
    const certificateNumber=decodeURIComponent(assessmentMatch[1]);
    const c=await env.DB.prepare('SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title,e.description,e.passing_percentage FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?').bind(certificateNumber).first();
    if(!c)return new Response('<!doctype html><html><body style="font-family:system-ui;padding:40px"><h1>Certificate Not Found</h1><p>The certificate ID is invalid or the certificate does not exist.</p></body></html>',{status:404,headers:{'content-type':'text/html;charset=UTF-8'}});
    const qs=await env.DB.prepare(`SELECT q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.points,q.sort_order${Number(c.show_answers)===1?',q.correct_answer,a.selected_answer':''} FROM questions q ${Number(c.show_answers)===1?'LEFT JOIN answers a ON a.question_id=q.id AND a.attempt_id=? ':''}WHERE q.exam_id=? ORDER BY q.sort_order,q.id`).bind(...(Number(c.show_answers)===1?[String(c.attempt_id),c.exam_id]:[c.exam_id])).all();
    return new Response(certificateAssessmentPage(c,qs.results||[],request),{status:200,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'public, max-age=60'}});
  }
  if(path.startsWith('/api/'))return api(request,env,ctx);
  if(path==='/admin'||path==='/admin/')return env.ASSETS.fetch(new Request(new URL('/admin.html',request.url),request));
  return env.ASSETS.fetch(request)
}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};
