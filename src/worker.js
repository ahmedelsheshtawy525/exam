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
function absoluteUrl(request,path,env){const base=(env.PUBLIC_BASE_URL||new URL(request.url).origin).replace(/\/$/,'');return `${base}${path}`}
function certificateId(){return `AE-${new Date().getFullYear()}-${randomHex(8).toUpperCase()}`}
async function sendCertificateEmail(env,{to,name,examTitle,certificateUrl,percentage,certificateId}){
  if(!env.RESEND_API_KEY||!env.RESEND_FROM_EMAIL)return {sent:false,reason:'email_not_configured'};
  const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171717"><h2>Ahmed Elsheshtawy</h2><p>Ahmed Finance · Exam Platform</p><hr><p>Dear ${clean(name,120)},</p><h1>Congratulations on passing!</h1><p>You successfully passed <strong>${clean(examTitle,200)}</strong> with a score of <strong>${Number(percentage).toFixed(1)}%</strong>.</p><p>Your certificate has been issued and is publicly verifiable.</p><p><a href="${certificateUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">View & Share Certificate</a></p><p>Certificate ID: ${certificateId}</p><p style="color:#666">You can share this certificate link with anyone who needs to verify your achievement.</p></div>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.RESEND_FROM_EMAIL,to:[to],subject:`Your certificate — ${examTitle}`,html})});
  if(!r.ok){console.error('CERTIFICATE EMAIL ERROR:',await r.text());return {sent:false,reason:'email_send_failed'}}
  return {sent:true};
}
async function ensureCertificate(env,request,resultId){
  const r=await env.DB.prepare(`
    SELECT
      r.id,
      r.attempt_id,
      r.user_id,
      r.exam_id,
      r.percentage,
      r.passed,
      u.full_name,
      u.email,
      e.title
    FROM results r
    JOIN users u ON u.id=r.user_id
    JOIN exams e ON e.id=r.exam_id
    WHERE r.id=?
  `).bind(resultId).first();

  if(!r || !r.passed)return null;

  const existing=await env.DB.prepare(`
    SELECT *
    FROM certificates
    WHERE attempt_id=?
    LIMIT 1
  `).bind(String(r.attempt_id)).first();

  if(existing){
    return {
      certificateId: existing.id,
      certificateNumber: existing.certificate_number,
      certificateUrl: absoluteUrl(
        request,
        `/certificate/${existing.id}`,
        env
      ),
      issuedAt: existing.issued_at,
      emailSent: false
    };
  }

  const cid=certificateId();
  const verificationToken=randomHex(24);
  const issuedAt=new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO certificates(
      id,
      certificate_number,
      verification_token,
      attempt_id,
      user_id,
      exam_id,
      score,
      percentage,
      title,
      issued_by,
      type,
      level,
      format,
      duration,
      description,
      skills,
      issued_at,
      status
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    cid,
    cid,
    verificationToken,
    String(r.attempt_id),
    String(r.user_id),
    String(r.exam_id),
    0,
    Number(r.percentage),
    r.title,
    'Ahmed Elsheshtawy',
    'completion',
    null,
    'digital',
    null,
    null,
    null,
    issuedAt,
    'valid'
  ).run();

  const url=absoluteUrl(
    request,
    `/certificate/${cid}`,
    env
  );

  const mail=await sendCertificateEmail(env,{
    to:r.email,
    name:r.full_name,
    examTitle:r.title,
    certificateUrl:url,
    percentage:r.percentage,
    certificateId:cid
  });

  return {
    certificateId:cid,
    certificateNumber:cid,
    certificateUrl:url,
    issuedAt,
    emailSent:mail.sent
  };
}
function certificatePage(c){
 const safe=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(c.title)} · Certificate</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f2ed;color:#161616;font-family:Arial,sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:28px}.cert{width:min(1120px,100%);background:#fff;border:1px solid #d9d4cc;box-shadow:0 20px 60px #00000014;position:relative;padding:64px;text-align:center}.cert:before{content:'';position:absolute;inset:16px;border:1px solid #e7e1d8}.logo{font-weight:800;font-size:24px}.brand{color:#f97316;margin-top:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#777;margin-top:55px}.title{font-family:Georgia,serif;font-size:58px;margin:14px 0}.sub{color:#666}.name{font-family:Georgia,serif;font-size:42px;margin:28px 0 10px}.exam{font-size:25px;font-weight:700;margin:10px 0}.meta{display:flex;justify-content:center;gap:55px;margin:35px 0}.meta div{display:grid;gap:7px}.meta span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#888}.verify{margin-top:40px;padding-top:20px;border-top:1px solid #e4dfd7;color:#777;font-size:12px}.verify a{color:#f97316;word-break:break-all}.actions{margin-top:20px;display:flex;justify-content:center;gap:10px}.btn{border:0;border-radius:9px;padding:12px 18px;font-weight:700;cursor:pointer}.primary{background:#f97316;color:white}.ghost{background:#eee}@media(max-width:700px){.cert{padding:38px 22px}.title{font-size:42px}.name{font-size:31px}.exam{font-size:20px}.meta{gap:20px;flex-wrap:wrap}}@media print{body{background:#fff}.wrap{padding:0}.cert{box-shadow:none;border:0;min-height:100vh}.actions{display:none}}</style></head><body><main class="wrap"><article class="cert"><div class="logo">Ahmed Elsheshtawy</div><div class="brand">Ahmed Finance · Exam Platform</div><div class="eyebrow">Certificate of Completion</div><div class="title">Certificate</div><div class="sub">This certificate is proudly presented to</div><div class="name">${safe(c.full_name)}</div><div class="sub">for successfully passing the assessment</div><div class="exam">${safe(c.title)}</div><div class="meta"><div><span>Score</span><b>${Number(c.percentage).toFixed(1)}%</b></div><div><span>Issued</span><b>${new Date(c.issued_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</b></div><div><span>Certificate ID</span><b>${safe(c.certificate_id)}</b></div></div><div class="verify">Public verification link<br><a href="${safe(c.url)}">${safe(c.url)}</a></div><div class="actions"><button class="btn primary" onclick="window.print()">Print / Save PDF</button><button class="btn ghost" onclick="navigator.clipboard?.writeText(location.href);this.textContent='Link copied'">Copy public link</button></div></article></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300'}})}

function isoOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const t=Date.parse(String(v));return Number.isFinite(t)?new Date(t).toISOString():null}
function availabilityState(startAt,expiresAt){const t=Date.now();const s=startAt?Date.parse(startAt):NaN,e=expiresAt?Date.parse(expiresAt):NaN;if(Number.isFinite(e)&&t>=e)return 'expired';if(Number.isFinite(s)&&t<s)return 'scheduled';return 'open'}
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

async function certificateResponse(request,env,cid){const c=await env.DB.prepare(`SELECT c.certificate_id,c.issued_at,u.full_name,e.title,r.percentage FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id JOIN results r ON r.id=c.result_id WHERE c.certificate_id=?`).bind(cid).first();if(!c)return bad('Certificate not found',404);return json({...c,certificateUrl:absoluteUrl(request,`/certificate/${cid}`,env)})}

async function api(request,env){
  const url=new URL(request.url),p=url.pathname,m=request.method,s=await getSession(request,env);
  if(!originOK(request))return bad('Invalid request origin',403);

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
    const rows=await env.DB.prepare(`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.status,e.created_at,e.attachments_json,e.desktop_required,e.available_from,e.expires_at,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ${adminSession(s)?'':'WHERE e.status=\'active\' AND (e.expires_at IS NULL OR e.expires_at>datetime(\'now\'))'} ORDER BY COALESCE(e.available_from,e.created_at) ASC,e.created_at DESC`).all();const results=(rows.results||[]).map(e=>({...e,attachments:parseAttachments(e.attachments_json)}));return json(results);
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
      const a=await env.DB.prepare(`SELECT a.*,e.passing_percentage,e.duration_minutes,e.title FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.user_id=?`).bind(id,s.user_id).first();

      if(!a)return bad('Attempt not found',404);

      if(a.status!=='in_progress'){
        const existing=await env.DB.prepare(`SELECT r.id,r.score,r.total_points,r.percentage,r.passed,e.title AS examTitle,e.id AS examId,e.passing_percentage FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.attempt_id=?`).bind(id).first();
        if(existing){
          const certificate=Number(existing.passed)?await ensureCertificate(env,request,existing.id):null;
          return json({ok:true,result:{score:Number(existing.score),totalPoints:Number(existing.total_points),percentage:Number(existing.percentage),passed:Number(existing.passed),examTitle:existing.examTitle,examId:existing.examId,passingPercentage:Number(existing.passing_percentage),certificate}});
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

      const resultInsert=await env.DB.prepare(`INSERT INTO results(attempt_id,user_id,exam_id,score,total_points,percentage,passed) VALUES(?,?,?,?,?,?,?) ON CONFLICT(attempt_id) DO UPDATE SET score=excluded.score,total_points=excluded.total_points,percentage=excluded.percentage,passed=excluded.passed`).bind(id,s.user_id,a.exam_id,score,total,percentage,passed).run();
      const resultId=resultInsert.meta.last_row_id;
      const certificate=passed?await ensureCertificate(env,request,resultId):null;
      return json({ok:true,result:{score,totalPoints:total,percentage,passed,examTitle:a.title,examId:a.exam_id,passingPercentage:Number(a.passing_percentage),questionCount:qs.length,answeredCount:[...incoming.values()].filter(Boolean).length,submittedAt:new Date().toISOString(),certificate}});
    }catch(e){
      console.error('EXAM SUBMIT ERROR:',e?.message||e);
      return json({error:'Exam submission failed',details:String(e?.message||e)},500);
    }
  }

  if(m==='GET'&&p.match(/^\/api\/certificates\/[A-Za-z0-9-]+$/))return certificateResponse(request,env,p.split('/')[3]);
  if(m==='GET'&&p==='/api/certificates'){if(!userSession(s))return bad('Unauthorized',401);const rows=await env.DB.prepare(`SELECT c.certificate_id,c.issued_at,c.email_sent,e.title,r.percentage FROM certificates c JOIN exams e ON e.id=c.exam_id JOIN results r ON r.id=c.result_id WHERE c.user_id=? ORDER BY c.issued_at DESC`).bind(s.user_id).all();return json((rows.results||[]).map(x=>({...x,certificateUrl:absoluteUrl(request,`/certificate/${x.certificate_id}`,env)})))}

  if(m==='GET'&&p==='/api/results'){
    if(!userSession(s))return bad('Unauthorized',401);const rows=await env.DB.prepare('SELECT r.*,e.title,e.passing_percentage FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(s.user_id).all();return json(rows.results||[]);
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
      const b=await body(request),title=clean(b?.title,200),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),attachments=normalizeAttachments(b?.attachments),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!title||!Number.isInteger(duration)||duration<1||duration>600||!Number.isFinite(pass)||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;const r=await env.DB.prepare('INSERT INTO exams(title,description,duration_minutes,passing_percentage,status,created_by,attachments_json,desktop_required,available_from,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(title,clean(b?.description),duration,pass,b?.status==='active'?'active':'inactive',s.admin_user_id,JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]),b=await body(request),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!id||!clean(b?.title)||!Number.isInteger(duration)||duration<1||duration>600||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;if(Object.prototype.hasOwnProperty.call(b,'attachments')){const attachments=normalizeAttachments(b.attachments);await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,attachments_json=?,desktop_required=?,available_from=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,id).run()}else{await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,desktop_required=?,available_from=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',desktopRequired,availableFrom,expiresAt,id).run()}return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]);if(!id)return bad('Invalid exam');await env.DB.prepare('DELETE FROM exams WHERE id=?').bind(id).run();return json({ok:true})}
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
    if(m==='GET'&&p==='/api/admin/results'){const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ? ORDER BY r.created_at DESC').bind(like,like,like,like).all();return json(rows.results||[])}
    if(m==='GET'&&p==='/api/admin/results/stats'){const d=await env.DB.prepare('SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN passed=1 THEN 1 ELSE 0 END),0) passed,COALESCE(SUM(CASE WHEN passed=0 THEN 1 ELSE 0 END),0) failed,COALESCE(AVG(percentage),0) average,COALESCE(MAX(percentage),0) highest,COALESCE(MIN(percentage),0) lowest FROM results').first();return json({total:Number(d.total||0),passed:Number(d.passed||0),failed:Number(d.failed||0),average:Number(d.average||0),highest:Number(d.highest||0),lowest:Number(d.lowest||0),passRate:Number(d.total?100*d.passed/d.total:0)})}
    if(m==='GET'&&p.match(/^\/api\/admin\/results\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid result');const r=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title,e.passing_percentage FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE r.id=?').bind(id).first();if(!r)return bad('Result not found',404);const answers=await env.DB.prepare('SELECT a.*,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.points FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY q.sort_order,q.id').bind(r.attempt_id).all();return json({result:r,answers:answers.results||[]})}
    if(m==='GET'&&p==='/api/admin/certificates'){const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare(`SELECT c.*,u.student_id,u.full_name,u.email,e.title,r.percentage FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id JOIN results r ON r.id=c.result_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ? ORDER BY c.issued_at DESC`).bind(like,like,like,like).all();return json((rows.results||[]).map(x=>({...x,certificateUrl:absoluteUrl(request,`/certificate/${x.certificate_id}`,env)})))}
    if(m==='GET'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const rows=await env.DB.prepare('SELECT id,username,role,status,created_at FROM admin_users ORDER BY created_at DESC').all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password)||!['admin','super_admin'].includes(b?.role||'admin'))return bad('Invalid admin fields');const exists=await env.DB.prepare('SELECT id FROM admin_users WHERE username=?').bind(username).first();if(exists)return bad('Username already exists',409);const ph=await hashPassword(b.password);const r=await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,b.role,'active').run();return json({id:r.meta.last_row_id},201)}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/admins\/\d+$/)){if(s.role!=='super_admin')return bad('Super admin required',403);const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE admin_users SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true})}
  }
  return bad('Not found',404);
}

export default {async fetch(request,env){try{const url=new URL(request.url);const path=url.pathname;if(path.startsWith('/api/'))return api(request,env);const cm=path.match(/^\/certificate\/([A-Za-z0-9-]+)$/);if(request.method==='GET'&&cm){const c=await env.DB.prepare(`SELECT c.certificate_id,c.issued_at,u.full_name,e.title,r.percentage,r.score,r.total_points FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id JOIN results r ON r.id=c.result_id WHERE c.certificate_id=?`).bind(cm[1]).first();if(!c)return new Response('Certificate not found',{status:404});return certificatePage({...c,url:absoluteUrl(request,`/certificate/${cm[1]}`,env)})}if(path==='/admin'||path==='/admin/')return env.ASSETS.fetch(new Request(new URL('/admin.html',request.url),request));return env.ASSETS.fetch(request)}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};
