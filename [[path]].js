const enc=new TextEncoder();
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const E=(m,s=400)=>{const e=new Error(m);e.s=s;return e};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const pbk=async(pw,salt)=>{const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},k,256))};
const clean=(s,n)=>String(s??'').trim().slice(0,n);

export async function onRequest({request:req,env}){
 const u=new URL(req.url),p=u.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),m=req.method,DB=env.DB;
 const q=(sql,...a)=>DB.prepare(sql).bind(...a);
 try{
  if(m!=='GET'){const o=req.headers.get('origin');if(o&&new URL(o).host!==u.host)throw E('forbidden',403)}
  let b={};if(m==='POST'||m==='PUT'){try{b=await req.json()}catch{}}
  const ck=(req.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/);
  let me=null;
  if(ck)me=await q('SELECT u.id,u.name,u.email,u.role,u.banned FROM sessions s JOIN users u ON u.id=s.uid WHERE s.token=? AND s.exp>?',await sha(ck[1]),Date.now()/1000|0).first();
  const need=()=>{if(!me)throw E('กรุณาเข้าสู่ระบบ',401)};
  const act=()=>{need();if(me.banned)throw E('บัญชีของคุณถูกระงับ',403)};
  const adm=()=>{need();if(me.role!=='admin')throw E('เฉพาะแอดมิน',403)};
  const A=p[0],id=+p[1]||0,mid=me?me.id:0;
  const start=async uid=>{const t=rnd(32);await q('INSERT INTO sessions VALUES(?,?,?)',await sha(t),uid,(Date.now()/1000|0)+2592000).run();
   return J({ok:1},200,{'set-cookie':`sid=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`})};

  if(A==='me'){
   if(m==='PUT'){act();await q('UPDATE users SET bio=? WHERE id=?',clean(b.bio,300),me.id).run();return J({ok:1})}
   return J({user:me&&{id:me.id,name:me.name,role:me.role,banned:me.banned}})}
  if(A==='register'&&m==='POST'){
   const email=clean(b.email,100).toLowerCase(),name=clean(b.name,30),pw=String(b.password||'');
   if(!/^\S+@\S+\.\S+$/.test(email))throw E('อีเมลไม่ถูกต้อง');
   if(name.length<2)throw E('ชื่อที่แสดงสั้นเกินไป');
   if(pw.length<8)throw E('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
   if(!b.accept)throw E('ต้องยอมรับข้อตกลงการใช้งานก่อน');
   if(await q('SELECT 1 FROM users WHERE email=? OR name=?',email,name).first())throw E('อีเมลหรือชื่อนี้ถูกใช้แล้ว');
   const salt=rnd(16),role=email===(env.ADMIN_EMAIL||'').toLowerCase()?'admin':'user';
   const r=await q('INSERT INTO users(email,name,pass,salt,role) VALUES(?,?,?,?,?)',email,name,await pbk(pw,salt),salt,role).run();
   return start(r.meta.last_row_id)}
  if(A==='login'&&m==='POST'){
   const x=await q('SELECT * FROM users WHERE email=?',clean(b.email,100).toLowerCase()).first();
   if(!x||await pbk(String(b.password||''),x.salt)!==x.pass)throw E('อีเมลหรือรหัสผ่านไม่ถูกต้อง',401);
   return start(x.id)}
  if(A==='logout'){if(ck)await q('DELETE FROM sessions WHERE token=?',await sha(ck[1])).run();return J({ok:1},200,{'set-cookie':'sid=; Path=/; Max-Age=0'})}

  if(A==='cats'){
   if(m==='GET')return J({cats:(await q('SELECT * FROM categories').all()).results});
   adm();
   if(m==='POST'){await q('INSERT INTO categories(name) VALUES(?)',clean(b.name,40)).run();return J({ok:1})}
   if(m==='DELETE'){await q('DELETE FROM categories WHERE id=?',id).run();return J({ok:1})}}

  if(A==='threads'){
   if(m==='GET'&&!id){
    const cat=+u.searchParams.get('cat')||0,s=clean(u.searchParams.get('q'),50),pg=Math.max(0,+u.searchParams.get('pg')||0);
    const r=await q(`SELECT t.id,t.title,t.pinned,t.locked,t.created,u.name author,c.name cat,(SELECT COUNT(*) FROM likes WHERE kind='t' AND tid=t.id) likes,(SELECT COUNT(*) FROM posts WHERE tid=t.id AND deleted=0) replies FROM threads t JOIN users u ON u.id=t.uid JOIN categories c ON c.id=t.cid WHERE t.deleted=0 AND (?=0 OR t.cid=?) AND (?='' OR t.title LIKE ? OR t.body LIKE ?) ORDER BY t.pinned DESC,t.id DESC LIMIT 20 OFFSET ?`,cat,cat,s,`%${s}%`,`%${s}%`,pg*20).all();
    return J({threads:r.results})}
   if(m==='GET'){
    const t=await q(`SELECT t.*,u.name author,c.name cat,(SELECT COUNT(*) FROM likes WHERE kind='t' AND tid=t.id) likes,(SELECT COUNT(*) FROM likes WHERE kind='t' AND tid=t.id AND uid=?) liked FROM threads t JOIN users u ON u.id=t.uid JOIN categories c ON c.id=t.cid WHERE t.id=? AND t.deleted=0`,mid,id).first();
    if(!t)throw E('ไม่พบกระทู้',404);
    const r=await q(`SELECT p.id,p.uid,p.body,p.created,u.name author,(SELECT COUNT(*) FROM likes WHERE kind='p' AND tid=p.id) likes,(SELECT COUNT(*) FROM likes WHERE kind='p' AND tid=p.id AND uid=?) liked FROM posts p JOIN users u ON u.id=p.uid WHERE p.tid=? AND p.deleted=0 ORDER BY p.id`,mid,id).all();
    return J({thread:t,posts:r.results})}
   if(m==='POST'&&!id){act();
    const t=clean(b.title,120),bd=clean(b.body,5000);
    if(t.length<3||bd.length<3)throw E('กรอกหัวข้อและเนื้อหาให้ครบ');
    if(!await q('SELECT 1 FROM categories WHERE id=?',+b.cid).first())throw E('เลือกหมวดหมู่');
    const r=await q('INSERT INTO threads(cid,uid,title,body) VALUES(?,?,?,?)',+b.cid,me.id,t,bd).run();
    return J({id:r.meta.last_row_id})}
   if(m==='POST'&&p[2]==='posts'){act();
    const t=await q('SELECT locked FROM threads WHERE id=? AND deleted=0',id).first();
    if(!t)throw E('ไม่พบกระทู้',404);if(t.locked)throw E('กระทู้ถูกล็อก');
    const bd=clean(b.body,3000);if(!bd)throw E('กรอกข้อความ');
    await q('INSERT INTO posts(tid,uid,body) VALUES(?,?,?)',id,me.id,bd).run();return J({ok:1})}
   if(m==='POST'&&(p[2]==='pin'||p[2]==='lock')){adm();
    const col=p[2]==='pin'?'pinned':'locked';await q(`UPDATE threads SET ${col}=1-${col} WHERE id=?`,id).run();return J({ok:1})}
   if(m==='PUT'){act();
    const r=await q('UPDATE threads SET body=? WHERE id=? AND uid=?',clean(b.body,5000),id,me.id).run();
    if(!r.meta.changes)throw E('แก้ไขไม่ได้',403);return J({ok:1})}
   if(m==='DELETE'){need();
    const r=await q('UPDATE threads SET deleted=1 WHERE id=? AND (uid=? OR ?)',id,me.id,me.role==='admin'?1:0).run();
    if(!r.meta.changes)throw E('ลบไม่ได้',403);return J({ok:1})}}

  if(A==='posts'){
   if(m==='PUT'){act();const r=await q('UPDATE posts SET body=? WHERE id=? AND uid=?',clean(b.body,3000),id,me.id).run();
    if(!r.meta.changes)throw E('แก้ไขไม่ได้',403);return J({ok:1})}
   if(m==='DELETE'){need();const r=await q('UPDATE posts SET deleted=1 WHERE id=? AND (uid=? OR ?)',id,me.id,me.role==='admin'?1:0).run();
    if(!r.meta.changes)throw E('ลบไม่ได้',403);return J({ok:1})}}

  if(A==='like'&&m==='POST'){act();
   const k=b.kind==='p'?'p':'t',t=+b.id;
   const d=await q('DELETE FROM likes WHERE uid=? AND kind=? AND tid=?',me.id,k,t).run();
   if(!d.meta.changes)await q('INSERT INTO likes VALUES(?,?,?)',me.id,k,t).run();
   const c=await q('SELECT COUNT(*) n FROM likes WHERE kind=? AND tid=?',k,t).first();
   return J({likes:c.n,liked:!d.meta.changes})}

  if(A==='users'){
   if(m==='GET'&&!id){act();const s=clean(u.searchParams.get('q'),30);
    return J({users:(await q('SELECT id,name FROM users WHERE name LIKE ? AND id!=? LIMIT 10',`%${s}%`,me.id).all()).results})}
   if(m==='GET'){const x=await q("SELECT id,name,role,bio,created,(SELECT COUNT(*) FROM threads WHERE uid=users.id AND deleted=0) threads FROM users WHERE id=?",id).first();
    if(!x)throw E('ไม่พบผู้ใช้',404);return J({user:x})}}

  if(A==='dm'){act();
   if(m==='GET'&&!id){
    const r=await q(`SELECT u.id,u.name,(SELECT body FROM messages m WHERE (m.from_id=u.id AND m.to_id=?) OR (m.from_id=? AND m.to_id=u.id) ORDER BY m.id DESC LIMIT 1) last,(SELECT COUNT(*) FROM messages WHERE from_id=u.id AND to_id=? AND read=0) unread FROM users u WHERE u.id IN (SELECT to_id FROM messages WHERE from_id=? UNION SELECT from_id FROM messages WHERE to_id=?)`,me.id,me.id,me.id,me.id,me.id).all();
    return J({convs:r.results})}
   if(m==='GET'){
    const o=await q('SELECT id,name FROM users WHERE id=?',id).first();if(!o)throw E('ไม่พบผู้ใช้',404);
    await q('UPDATE messages SET read=1 WHERE from_id=? AND to_id=?',id,me.id).run();
    const r=await q('SELECT id,from_id,body,created FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100',me.id,id,id,me.id).all();
    return J({other:o,msgs:r.results.reverse()})}
   if(m==='POST'){
    const bd=clean(b.body,1000);if(!bd)throw E('พิมพ์ข้อความ');if(id===me.id)throw E('ส่งหาตัวเองไม่ได้');
    if(!await q('SELECT 1 FROM users WHERE id=?',id).first())throw E('ไม่พบผู้ใช้',404);
    await q('INSERT INTO messages(from_id,to_id,body) VALUES(?,?,?)',me.id,id,bd).run();return J({ok:1})}}

  if(A==='report'&&m==='POST'){act();
   const k=['t','p','u'].includes(b.kind)?b.kind:'t',r=clean(b.reason,300);if(r.length<3)throw E('ระบุเหตุผล');
   await q('INSERT INTO reports(uid,kind,target,reason) VALUES(?,?,?,?)',me.id,k,+b.id,r).run();return J({ok:1})}

  if(A==='admin'){adm();
   if(p[1]==='reports'&&m==='GET'){
    const r=await q(`SELECT r.*,u.name reporter,CASE r.kind WHEN 't' THEN (SELECT uid FROM threads WHERE id=r.target) WHEN 'p' THEN (SELECT uid FROM posts WHERE id=r.target) ELSE r.target END author,CASE r.kind WHEN 't' THEN r.target WHEN 'p' THEN (SELECT tid FROM posts WHERE id=r.target) END tid,CASE r.kind WHEN 't' THEN (SELECT title FROM threads WHERE id=r.target) WHEN 'p' THEN (SELECT body FROM posts WHERE id=r.target) ELSE (SELECT name FROM users WHERE id=r.target) END preview FROM reports r JOIN users u ON u.id=r.uid ORDER BY r.status='open' DESC,r.id DESC LIMIT 100`).all();
    return J({reports:r.results})}
   if(p[1]==='resolve'){await q("UPDATE reports SET status='done' WHERE id=?",+p[2]).run();return J({ok:1})}
   if(p[1]==='users'&&m==='GET')return J({users:(await q('SELECT id,name,email,role,banned FROM users ORDER BY id DESC LIMIT 200').all()).results});
   if(p[1]==='ban'){const t=+p[2];if(t===me.id)throw E('ห้ามระงับตัวเอง');
    await q("UPDATE users SET banned=1-banned WHERE id=? AND role!='admin'",t).run();return J({ok:1})}}

  throw E('not found',404);
 }catch(e){return J({error:e.s?e.message:'เกิดข้อผิดพลาดของเซิร์ฟเวอร์'},e.s||500)}
}
