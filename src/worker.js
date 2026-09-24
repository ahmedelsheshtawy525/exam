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
async function ensureCertificate(env,request,{attemptId,userId,examId,a,score,total,percentage}){
  const existing=await env.DB.prepare('SELECT certificate_number,status FROM certificates WHERE attempt_id=?').bind(String(attemptId)).first();
  if(existing)return {certificateNumber:existing.certificate_number,verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(existing.certificate_number)}`,status:existing.status};
  const u=await env.DB.prepare('SELECT full_name,email FROM users WHERE id=?').bind(userId).first();
  if(!u)throw new Error('Student account not found while issuing certificate');
  const certId=randomHex(16);
  const certNo=certificateNumber();
  const token=randomHex(24);
  const skills=parseSkills(a.certificate_skills_json);
  const issuedAt=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO certificates(id,certificate_number,verification_token,attempt_id,user_id,exam_id,score,percentage,title,issued_by,type,level,format,duration,description,skills,issued_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(certId,certNo,token,String(attemptId),String(userId),String(examId),score,percentage,
      clean(a.certificate_title||`${a.title} Certificate`,200),
      clean(a.certificate_issued_by||'Ahmed Elsheshtawy',200),
      clean(a.certificate_type||'Training',80),
      clean(a.certificate_level||'Intermediate',80),
      clean(a.certificate_format||'Online',80),
      clean(a.certificate_duration||'',80),
      clean(a.certificate_description||a.description||'',10000),
      JSON.stringify(skills),issuedAt,'valid').run();
  return {certificateNumber:certNo,verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(certNo)}`,status:'valid'};
}
function htmlEscape(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll("'",'&#39;')}
function credentialPage(c,request){const origin=new URL(request.url).origin;const verify=`${origin}/verify/${encodeURIComponent(c.certificate_number)}`;const skills=parseSkills(c.skills);const status=c.status==='valid';return `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${htmlEscape(c.title)} — ${htmlEscape(c.student_name)}</title><style>body{margin:0;background:#f5f7fb;color:#172033;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:900px;margin:48px auto;padding:20px}.card{background:#fff;border:1px solid #e4e8ef;border-radius:24px;box-shadow:0 16px 50px #17203314;overflow:hidden}.hero{padding:42px;background:linear-gradient(135deg,#101828,#26364f);color:#fff}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.72}.hero h1{font-size:34px;margin:12px 0}.hero p{margin:6px 0;color:#dce5f2}.student{font-size:26px;font-weight:700}.body{padding:34px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.item{padding:16px;border:1px solid #e8ebf0;border-radius:14px}.label{font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.08em}.value{font-weight:650;margin-top:6px}.desc{line-height:1.7;color:#475467}.skills{display:flex;gap:8px;flex-wrap:wrap}.skill{padding:8px 11px;border-radius:999px;background:#eef2f7}.status{display:inline-flex;padding:8px 12px;border-radius:999px;font-weight:700;background:${status?'#e8f7ee':'#fdecec'};color:${status?'#18794e':'#b42318'}}.footer{margin-top:28px;padding-top:24px;border-top:1px solid #e8ebf0;display:flex;justify-content:space-between;gap:20px;align-items:end}.verify{font-family:ui-monospace,monospace;font-size:13px;word-break:break-all;color:#475467}@media(max-width:650px){.grid{grid-template-columns:1fr}.wrap{margin:10px auto}.hero{padding:28px}.body{padding:22px}.hero h1{font-size:27px}}</style></head><body><main class=\"wrap\"><section class=\"card\"><div class=\"hero\"><div class=\"eyebrow\">Verified Credential</div><h1>${htmlEscape(c.title)}</h1><p class=\"student\">${htmlEscape(c.student_name)}</p><p>Successfully completed <b>${htmlEscape(c.exam_title)}</b></p></div><div class=\"body\"><div class=\"grid\"><div class=\"item\"><div class=\"label\">Score</div><div class=\"value\">${Number(c.percentage).toFixed(1)}%</div></div><div class=\"item\"><div class=\"label\">Issued</div><div class=\"value\">${htmlEscape(new Date(String(c.issued_at).includes('T')?c.issued_at:c.issued_at+'Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}))}</div></div><div class=\"item\"><div class=\"label\">Issued by</div><div class=\"value\">${htmlEscape(c.issued_by)}</div></div><div class=\"item\"><div class=\"label\">Type</div><div class=\"value\">${htmlEscape(c.type)}</div></div><div class=\"item\"><div class=\"label\">Level</div><div class=\"value\">${htmlEscape(c.level)}</div></div><div class=\"item\"><div class=\"label\">Format</div><div class=\"value\">${htmlEscape(c.format)}</div></div><div class=\"item\"><div class=\"label\">Duration</div><div class=\"value\">${htmlEscape(c.duration||'—')}</div></div><div class=\"item\"><div class=\"label\">Status</div><div class=\"value\"><span class=\"status\">${status?'✓ Valid':'⚠ Revoked'}</span></div></div></div><div style=\"margin-top:28px\"><div class=\"label\">Description</div><p class=\"desc\">${htmlEscape(c.description||'No description provided.')}</p></div><div style=\"margin-top:28px\"><div class=\"label\">Skills</div><div class=\"skills\">${skills.map(x=>`<span class=\"skill\">${htmlEscape(x)}</span>`).join('')||'<span class=\"desc\">No skills listed.</span>'}</div></div><div class=\"footer\"><div><div class=\"label\">Certificate ID</div><div class=\"value\">${htmlEscape(c.certificate_number)}</div><div class=\"verify\">${htmlEscape(verify)}</div></div><div><b>${status?'Certificate Verified':'Certificate Revoked'}</b></div></div></div></section></main></body></html>`}
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

async function api(request,env){
  const url=new URL(request.url),p=url.pathname,m=request.method,s=await getSession(request,env);
  if(!originOK(request))return bad('Invalid request origin',403);

  if(m==='GET'&&p.match(/^\/verify\/[^/]+$/)){const number=decodeURIComponent(p.split('/')[2]||'');const c=number?await env.DB.prepare('SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?').bind(number).first():null;if(!c)return new Response('<h1>Certificate not found</h1>',{status:404,headers:{'content-type':'text/html; charset=utf-8'}});return new Response(credentialPage(c,request),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60'}})}
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
          if(Number(existing.passed)===1 && Number(a.certificate_enabled??1)===1){
            try{
              certificate=await ensureCertificate(env,request,{attemptId:id,userId:s.user_id,examId:existing.exam_id,a,score:Number(existing.score),total:Number(existing.total_points),percentage:Number(existing.percentage)});
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
            certificateError
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
      if(passed && Number(a.certificate_enabled??1)===1){
        try{
          certificate=await ensureCertificate(env,request,{attemptId:id,userId:s.user_id,examId:a.exam_id,a,score,total,percentage});
        }catch(certError){
          certificateError=String(certError?.message||certError);
          console.error('CERTIFICATE ISSUE ERROR:',certificateError);
        }
      }
      return json({ok:true,result:{score,totalPoints:total,percentage,passed,examTitle:a.title,examId:a.exam_id,passingPercentage:Number(a.passing_percentage),questionCount:qs.length,answeredCount:[...incoming.values()].filter(Boolean).length,submittedAt:new Date().toISOString(),certificate,certificateError}});
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
        'SELECT certificate_number,status FROM certificates WHERE attempt_id=?'
      ).bind(String(result.attempt_id)).first();
      if(existingCert){
        certificate={
          certificateNumber:existingCert.certificate_number,
          verificationUrl:`${new URL(request.url).origin}/verify/${encodeURIComponent(existingCert.certificate_number)}`,
          status:existingCert.status
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
      const b=await body(request),title=clean(b?.title,200),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),attachments=normalizeAttachments(b?.attachments),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!title||!Number.isInteger(duration)||duration<1||duration>600||!Number.isFinite(pass)||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;const r=await env.DB.prepare('INSERT INTO exams(title,description,duration_minutes,passing_percentage,status,created_by,attachments_json,desktop_required,available_from,expires_at,certificate_enabled,certificate_title,certificate_issued_by,certificate_type,certificate_level,certificate_format,certificate_duration,certificate_description,certificate_skills_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(title,clean(b?.description),duration,pass,b?.status==='active'?'active':'inactive',s.admin_user_id,JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,b?.certificateEnabled===false?0:1,clean(b?.certificateTitle,200),clean(b?.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b?.certificateType||'Training',80),clean(b?.certificateLevel||'Intermediate',80),clean(b?.certificateFormat||'Online',80),clean(b?.certificateDuration,80),clean(b?.certificateDescription||'',10000),JSON.stringify(parseSkills(b?.certificateSkills))).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]),b=await body(request),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!id||!clean(b?.title)||!Number.isInteger(duration)||duration<1||duration>600||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;if(Object.prototype.hasOwnProperty.call(b,'attachments')){const attachments=normalizeAttachments(b.attachments);await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,attachments_json=?,desktop_required=?,available_from=?,expires_at=?,certificate_enabled=?,certificate_title=?,certificate_issued_by=?,certificate_type=?,certificate_level=?,certificate_format=?,certificate_duration=?,certificate_description=?,certificate_skills_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,b.certificateEnabled===false?0:1,clean(b.certificateTitle,200),clean(b.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b.certificateType||'Training',80),clean(b.certificateLevel||'Intermediate',80),clean(b.certificateFormat||'Online',80),clean(b.certificateDuration,80),clean(b.certificateDescription||'',10000),JSON.stringify(parseSkills(b.certificateSkills)),id).run()}else{await env.DB.prepare('UPDATE exams SET title=?,description=?,duration_minutes=?,passing_percentage=?,status=?,desktop_required=?,available_from=?,expires_at=?,certificate_enabled=?,certificate_title=?,certificate_issued_by=?,certificate_type=?,certificate_level=?,certificate_format=?,certificate_duration=?,certificate_description=?,certificate_skills_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),duration,pass,b.status==='active'?'active':'inactive',desktopRequired,availableFrom,expiresAt,b.certificateEnabled===false?0:1,clean(b.certificateTitle,200),clean(b.certificateIssuedBy||'Ahmed Elsheshtawy',200),clean(b.certificateType||'Training',80),clean(b.certificateLevel||'Intermediate',80),clean(b.certificateFormat||'Online',80),clean(b.certificateDuration,80),clean(b.certificateDescription||'',10000),JSON.stringify(parseSkills(b.certificateSkills)),id).run()}return json({ok:true})}
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

export default {async fetch(request,env){try{
  const url=new URL(request.url);
  const path=url.pathname;
  const verifyMatch=path.match(/^\/verify\/([^/]+)\/?$/);
  if(verifyMatch){
    const certificateNumber=decodeURIComponent(verifyMatch[1]);
    const c=await env.DB.prepare(
      'SELECT c.*,u.full_name AS student_name,u.email AS student_email,e.title AS exam_title FROM certificates c JOIN users u ON u.id=c.user_id JOIN exams e ON e.id=c.exam_id WHERE c.certificate_number=?'
    ).bind(certificateNumber).first();
    if(!c)return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate Not Found</title></head><body style="font-family:system-ui;padding:40px"><h1>Certificate Not Found</h1><p>The certificate ID is invalid or the certificate does not exist.</p></body></html>',{status:404,headers:{'content-type':'text/html;charset=UTF-8'}});
    return new Response(credentialPage(c,request),{status:200,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store'}});
  }
  if(path.startsWith('/api/'))return api(request,env);
  if(path==='/admin'||path==='/admin/')return env.ASSETS.fetch(new Request(new URL('/admin.html',request.url),request));
  return env.ASSETS.fetch(request)
}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};
