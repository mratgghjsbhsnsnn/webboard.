const $=s=>document.querySelector(s),app=$('#app');
let me=null,cats=[],timer=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(p,m='GET',b)=>{const r=await fetch('/api/'+p,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'เกิดข้อผิดพลาด');return d};
const when=t=>new Date(String(t).replace(' ','T')+'Z').toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3000)};
const go=h=>{location.hash=h};
const refresh=()=>route();

async function boot(){try{me=(await api('me')).user;cats=(await api('cats')).cats}catch{}nav();route()}
function nav(){$('#nav').innerHTML=`<a href="#/">หน้าแรก</a>`+(me?`<a href="#/chat">แชท</a>${me.role==='admin'?'<a href="#/admin">แอดมิน</a>':''}<a href="#/u/${me.id}">${esc(me.name)}</a><button data-a="logout">ออก</button>`:`<a href="#/login">เข้าสู่ระบบ</a><a class="btn" href="#/register">สมัครสมาชิก</a>`)}

async function route(){clearInterval(timer);const[h,qs]=(location.hash.slice(1)||'/').split('?');const p=h.split('/').filter(Boolean),q=new URLSearchParams(qs||''),v=p[0];
 try{if(!v)await home(q);else if(v==='t')await thread(+p[1]);else if(v==='new')newThread();else if(v==='login'||v==='register')authView(v);else if(v==='chat')await chat(+p[1]||0);else if(v==='u')await profile(+p[1]);else if(v==='admin')await admin();else app.innerHTML='<div class="card">ไม่พบหน้านี้</div>'}
 catch(e){app.innerHTML=`<div class="card">${esc(e.message)}</div>`}}
window.addEventListener('hashchange',route);

async function home(q){const cat=+q.get('cat')||0,s=q.get('q')||'',pg=+q.get('pg')||0,qq=encodeURIComponent(s);
 const{threads}=await api(`threads?cat=${cat}&q=${qq}&pg=${pg}`);
 app.innerHTML=`<div class="hero"><h1>ยินดีต้อนรับ 👋</h1><p>พื้นที่พูดคุยแลกเปลี่ยนสำหรับทุกคน</p><form data-f="search" class="row"><input name="q" value="${esc(s)}" placeholder="ค้นหากระทู้..."><button>ค้นหา</button></form></div>
 <div class="chips"><a class="${!cat?'on':''}" href="#/">ทั้งหมด</a>${cats.map(c=>`<a class="${cat==c.id?'on':''}" href="#/?cat=${c.id}">${esc(c.name)}</a>`).join('')}</div>
 <div class="bar"><a class="btn" href="#/new">+ ตั้งกระทู้ใหม่</a></div>
 ${threads.map(t=>`<a class="card th" href="#/t/${t.id}"><h3>${t.pinned?'📌 ':''}${t.locked?'🔒 ':''}${esc(t.title)}</h3><small>${esc(t.cat)} · โดย ${esc(t.author)} · ${when(t.created)}</small><small>👍 ${t.likes} · 💬 ${t.replies}</small></a>`).join('')||'<p class="mute">ยังไม่มีกระทู้</p>'}
 <div class="bar">${pg>0?`<a class="btn ghost" href="#/?cat=${cat}&q=${qq}&pg=${pg-1}">← ก่อนหน้า</a>`:''}${threads.length==20?`<a class="btn ghost" href="#/?cat=${cat}&q=${qq}&pg=${pg+1}">ถัดไป →</a>`:''}</div>`}

async function thread(id){const{thread:t,posts}=await api('threads/'+id);const adm=me&&me.role==='admin';
 const tools=(k,o,x)=>`<div class="tools"><button data-a="like" data-k="${k}" data-id="${x.id}" class="${x.liked?'on':''}">👍 <span>${x.likes}</span></button>${me&&me.id!==o?`<button data-a="report" data-k="${k}" data-id="${x.id}">🚩 รายงาน</button>`:''}${me&&me.id===o?`<button data-a="edit" data-k="${k}" data-id="${x.id}">แก้ไข</button>`:''}${me&&(me.id===o||adm)?`<button data-a="del" data-k="${k}" data-id="${x.id}">ลบ</button>`:''}</div>`;
 app.innerHTML=`<div class="card"><small>${esc(t.cat)} · โดย <a href="#/u/${t.uid}">${esc(t.author)}</a> · ${when(t.created)}</small><h2>${t.pinned?'📌 ':''}${t.locked?'🔒 ':''}${esc(t.title)}</h2><div class="body">${esc(t.body)}</div>${tools('t',t.uid,t)}
 ${adm?`<div class="tools"><button data-a="pin" data-id="${t.id}">${t.pinned?'เลิกปักหมุด':'ปักหมุด'}</button><button data-a="lock" data-id="${t.id}">${t.locked?'ปลดล็อก':'ล็อกกระทู้'}</button></div>`:''}</div>
 <h3>ความคิดเห็น (${posts.length})</h3>
 ${posts.map(x=>`<div class="card"><small><a href="#/u/${x.uid}">${esc(x.author)}</a> · ${when(x.created)}</small><div class="body">${esc(x.body)}</div>${tools('p',x.uid,x)}</div>`).join('')}
 ${!me?'<div class="card">กรุณา <a href="#/login">เข้าสู่ระบบ</a> เพื่อแสดงความคิดเห็น</div>':t.locked?'<div class="card">กระทู้นี้ถูกล็อก</div>':`<form class="card" data-f="reply" data-id="${t.id}"><textarea name="body" placeholder="เขียนความคิดเห็น..." required></textarea><button>ตอบกลับ</button></form>`}`}

function newThread(){if(!me)return go('#/login');
 app.innerHTML=`<form class="card" data-f="newthread"><h2>ตั้งกระทู้ใหม่</h2><select name="cid">${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><input name="title" placeholder="หัวข้อ" maxlength="120" required><textarea name="body" placeholder="เนื้อหา" required></textarea><button>โพสต์</button></form>`}

function authView(v){const reg=v==='register';
 app.innerHTML=`<form class="card" data-f="${v}"><h2>${reg?'สมัครสมาชิก':'เข้าสู่ระบบ'}</h2>${reg?'<input name="name" placeholder="ชื่อที่แสดง" maxlength="30" required>':''}<input name="email" type="email" placeholder="อีเมล" required><input name="password" type="password" placeholder="รหัสผ่าน${reg?' (8 ตัวขึ้นไป)':''}" required>${reg?'<label><input type="checkbox" name="accept" style="width:auto"> ฉันอ่านและยอมรับ <a href="terms.html" target="_blank">ข้อตกลงการใช้งานและความเป็นส่วนตัว</a> รวมถึงความเสี่ยงที่ระบุไว้</label><br>':''}<button>${reg?'สมัคร':'เข้าสู่ระบบ'}</button></form>`}

async function chat(uid){if(!me)return go('#/login');const{convs}=await api('dm');
 app.innerHTML=`<div class="chat"><aside><form data-f="usersearch"><input name="q" placeholder="ค้นหาผู้ใช้เพื่อแชท"></form><div id="us"></div>${convs.map(c=>`<a class="conv ${c.id==uid?'on':''}" href="#/chat/${c.id}"><b>${esc(c.name)}</b>${c.unread?`<i>${c.unread}</i>`:''}<small>${esc((c.last||'').slice(0,40))}</small></a>`).join('')}</aside>
 <section class="card" id="pane">${uid?`<b id="who"></b><div id="msgs"></div><form class="row" data-f="dm" data-id="${uid}"><input name="body" placeholder="พิมพ์ข้อความ..." autocomplete="off" required><button>ส่ง</button></form>`:'<p class="mute">เลือกการสนทนา หรือค้นหาผู้ใช้</p>'}</section></div>`;
 if(uid){const load=async()=>{const{msgs,other}=await api('dm/'+uid);$('#who').textContent=other.name;const box=$('#msgs');if(!box)return;const bottom=box.scrollTop+box.clientHeight>=box.scrollHeight-40;box.innerHTML=msgs.map(m=>`<div class="msg ${m.from_id===me.id?'me':''}">${esc(m.body)}<small>${when(m.created)}</small></div>`).join('');if(bottom)box.scrollTop=box.scrollHeight};
  await load();$('#msgs').scrollTop=1e9;timer=setInterval(()=>load().catch(()=>{}),4000)}}

async function profile(id){const{user:u}=await api('users/'+id);const self=me&&me.id===u.id;
 app.innerHTML=`<div class="card"><h2>${esc(u.name)} ${u.role==='admin'?'<span class="tag">แอดมิน</span>':''}</h2><small>สมัครเมื่อ ${when(u.created)} · ${u.threads} กระทู้</small><p class="body">${esc(u.bio||'ยังไม่มีคำแนะนำตัว')}</p>
 ${self?`<form data-f="bio"><textarea name="bio" maxlength="300">${esc(u.bio)}</textarea><button>บันทึก</button></form>`:me?`<div class="tools"><a class="btn" href="#/chat/${u.id}">💬 ส่งข้อความ</a><button data-a="report" data-k="u" data-id="${u.id}">🚩 รายงานผู้ใช้</button></div>`:''}</div>`}

async function admin(){if(!me||me.role!=='admin')return go('#/');
 const[{reports},{users}]=await Promise.all([api('admin/reports'),api('admin/users')]);
 app.innerHTML=`<h2>แผงควบคุมแอดมิน</h2><div class="card"><h3>รายงาน</h3>${reports.map(r=>`<div class="card"><span class="tag">${{t:'กระทู้',p:'ความคิดเห็น',u:'ผู้ใช้'}[r.kind]}</span> ${r.status==='open'?'🟠':'✅'} โดย ${esc(r.reporter)} · ${when(r.created)}<div><b>เหตุผล:</b> ${esc(r.reason)}</div><div class="mute">${esc((r.preview||'(ถูกลบแล้ว)').slice(0,120))}</div>
 <div class="tools">${r.tid?`<a class="btn ghost" href="#/t/${r.tid}">ดู</a>`:`<a class="btn ghost" href="#/u/${r.target}">ดู</a>`}${r.kind!=='u'?`<button data-a="del" data-k="${r.kind}" data-id="${r.target}">ลบเนื้อหา</button>`:''}<button data-a="ban" data-id="${r.author}">ระงับ/ปลดผู้ใช้</button>${r.status==='open'?`<button data-a="resolve" data-id="${r.id}">ปิดเรื่อง</button>`:''}</div></div>`).join('')||'<p class="mute">ไม่มีรายงาน</p>'}</div>
 <div class="card"><h3>หมวดหมู่</h3>${cats.map(c=>`${esc(c.name)} <button data-a="delcat" data-id="${c.id}">ลบ</button> `).join('')}<form class="row" data-f="addcat"><input name="name" placeholder="ชื่อหมวดใหม่" required><button>เพิ่ม</button></form></div>
 <div class="card"><h3>สมาชิก (${users.length})</h3><div style="overflow-x:auto"><table><tr><th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th><th></th></tr>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}${u.banned?' <span class="tag">ถูกระงับ</span>':''}</td><td>${u.role!=='admin'?`<button data-a="ban" data-id="${u.id}">${u.banned?'ปลด':'ระงับ'}</button>`:''}</td></tr>`).join('')}</table></div></div>`}

const forms={
 async login(d){await api('login','POST',d);await after()},
 async register(d){await api('register','POST',{...d,accept:d.accept==='on'});await after()},
 async newthread(d){const r=await api('threads','POST',d);go('#/t/'+r.id)},
 async reply(d,f){await api(`threads/${f.dataset.id}/posts`,'POST',d);refresh()},
 async search(d){go('#/?q='+encodeURIComponent(d.q))},
 async usersearch(d){const{users}=await api('users?q='+encodeURIComponent(d.q));$('#us').innerHTML=users.map(u=>`<a class="conv" href="#/chat/${u.id}">➕ ${esc(u.name)}</a>`).join('')||'<small>ไม่พบ</small>'},
 async dm(d,f){await api('dm/'+f.dataset.id,'POST',d);f.reset();refresh()},
 async bio(d){await api('me','PUT',d);toast('บันทึกแล้ว')},
 async addcat(d){await api('cats','POST',d);cats=(await api('cats')).cats;refresh()}
};
async function after(){me=(await api('me')).user;cats=(await api('cats')).cats;nav();go('#/')}
document.addEventListener('submit',async e=>{const f=e.target.dataset.f;if(!f)return;e.preventDefault();try{await forms[f](Object.fromEntries(new FormData(e.target)),e.target)}catch(x){toast(x.message)}});

const urlOf=(k,id)=>(k==='t'?'threads/':'posts/')+id;
const actions={
 async logout(){await api('logout','POST');me=null;nav();go('#/')},
 async like(d,a){const r=await api('like','POST',{kind:d.k,id:+d.id});a.classList.toggle('on',r.liked);a.querySelector('span').textContent=r.likes},
 async report(d){const r=prompt('เหตุผลที่รายงาน');if(!r)return;await api('report','POST',{kind:d.k,id:+d.id,reason:r});toast('ส่งรายงานแล้ว')},
 async del(d){if(!confirm('ยืนยันการลบ?'))return;await api(urlOf(d.k,d.id),'DELETE');if(d.k==='t'&&location.hash.startsWith('#/t/'))go('#/');else refresh()},
 async edit(d,a){const el=a.closest('.card').querySelector('.body'),v=prompt('แก้ไขข้อความ',el.textContent);if(!v)return;await api(urlOf(d.k,d.id),'PUT',{body:v});refresh()},
 async pin(d){await api(`threads/${d.id}/pin`,'POST');refresh()},
 async lock(d){await api(`threads/${d.id}/lock`,'POST');refresh()},
 async ban(d){if(!+d.id)return;await api('admin/ban/'+d.id,'POST');refresh()},
 async resolve(d){await api('admin/resolve/'+d.id,'POST');refresh()},
 async delcat(d){if(!confirm('ลบหมวดนี้?'))return;await api('cats/'+d.id,'DELETE');cats=(await api('cats')).cats;refresh()}
};
document.addEventListener('click',async e=>{const a=e.target.closest('[data-a]');if(!a)return;try{await actions[a.dataset.a](a.dataset,a)}catch(x){toast(x.message)}});
boot();
