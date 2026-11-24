// ELEVOS private cloud-save beta. No credentials beyond public Firebase Web config.
const cfg=window.ELEVOS_FIREBASE_CONFIG||{};
const local=window.ElevosLocal;
let auth,db,A,F,user=null,ready=false,busy=false,notice='',remoteRevision=null,registering=false;
const configured=!!(cfg.apiKey&&cfg.authDomain&&cfg.projectId&&cfg.appId);
const parts=['core','players','matches','seasons','cups','scores','calendar','cards','economy'];
const $=id=>document.getElementById(id);
function message(t){notice=t;if($('cloud-status'))$('cloud-status').textContent=t;window.ElevosEntry?.status(t)}
let accountMode='login';
function draw(){
 const p=$('cloud-panel');if(!p)return;
 p.innerHTML='<div class="row"><h2>계정 및 클라우드 저장</h2><button class="btn sub mini" id="cloud-close">닫기</button></div><p id="cloud-status" class="cloud-status"></p>';
 $('cloud-close').onclick=()=>{if(!busy)$('cloud-modal')?.remove()};
 if(!user){
  const register=accountMode==='register';
  p.insertAdjacentHTML('beforeend','<div class="auth-brand"><img src="./elevos-wordmark.svg" alt="ELEVOS"><strong>'+(register?'회원가입':'로그인')+'</strong><p>현재 ELEVOS는 베타테스트 기간입니다.</p></div><div class="auth-tabs"><button class="btn '+(register?'sub':'')+'" id="auth-login-tab">로그인</button><button class="btn '+(register?'':'sub')+'" id="auth-register-tab">회원가입</button></div><form id="auth-form">'+(register?'<label for="cloud-username">아이디</label><input type="text" id="cloud-username" autocomplete="username" pattern="[A-Za-z0-9]{4,20}" maxlength="20" placeholder="영문·숫자 4~20자" required>':'<label for="cloud-login-email">이메일</label><input type="email" id="cloud-login-email" autocomplete="email" maxlength="254" placeholder="가입 이메일" required>')+'<label for="cloud-password">비밀번호</label><input type="password" id="cloud-password" autocomplete="'+(register?'new-password':'current-password')+'" minlength="'+(register?8:6)+'" placeholder="비밀번호 입력" required>'+(register?'<label for="cloud-password-confirm">비밀번호 확인</label><input type="password" id="cloud-password-confirm" autocomplete="new-password" minlength="8" required><label for="cloud-email">이메일</label><input type="email" id="cloud-email" autocomplete="email" placeholder="name@example.com" maxlength="254" required><label for="cloud-phone">휴대전화 번호</label><input type="tel" id="cloud-phone" autocomplete="tel-national" inputmode="tel" placeholder="010-1234-5678" maxlength="16" required><p class="auth-note">이메일과 휴대전화 번호는 회원 관리 및 계정 문의에 사용됩니다.</p>':'')+'<button class="btn auth-primary" type="submit">'+(register?'회원가입':'로그인')+'</button></form>'+(!register?'<button class="auth-text" id="cloud-reset">비밀번호 찾기</button>':'')+'<p class="auth-note">회원가입 후 감독 프로필을 설정할 수 있습니다.</p>');
  $('auth-login-tab').onclick=()=>{accountMode='login';notice='';draw()};
  $('auth-register-tab').onclick=()=>{accountMode='register';notice='';draw()};
  $('auth-form').onsubmit=e=>{e.preventDefault();const password=$('cloud-password').value;if(!register){entryLogin($('cloud-login-email').value.trim(),password);return}const username=$('cloud-username').value.trim().toLowerCase();const confirmPassword=$('cloud-password-confirm').value,email=$('cloud-email').value.trim(),phone=$('cloud-phone').value.trim().replace(/[\s-]/g,'');if(!/^[a-z0-9]{4,20}$/.test(username)){message('아이디는 영문과 숫자 4~20자로 입력하세요.');return}if(password.length<8){message('비밀번호는 8자 이상으로 입력하세요.');return}if(password!==confirmPassword){message('비밀번호가 일치하지 않습니다.');return}if(!/^01[016789][0-9]{7,8}$/.test(phone)){message('올바른 휴대전화 번호를 입력하세요.');return}registerMember(username,email,phone,password)};
  if($('cloud-reset'))$('cloud-reset').onclick=()=>entryReset($('cloud-login-email').value.trim());
  if(!configured)message('회원 인증 서비스 연결 준비 중입니다.');
  else if(!ready)message('계정 서비스 연결 중입니다.');
 }else{
  p.insertAdjacentHTML('beforeend','<p id="cloud-identity"></p><p>게임 로그아웃 시 클라우드에도 저장합니다. 다른 기기에서 불러올 수 있으며 게스트 기록은 별도로 유지됩니다.</p><div class="cloud-actions"><button class="btn" id="cloud-upload">클라우드 저장</button><button class="btn sub" id="cloud-download">클라우드 불러오기</button><button class="btn sub" id="cloud-migrate">게스트 기록 가져오기</button><button class="btn sub" id="cloud-logout">로그아웃</button></div>');
  $('cloud-identity').textContent=user.email||'Google 계정';
  $('cloud-upload').onclick=()=>act(upload);
  $('cloud-download').onclick=()=>act(download);
  $('cloud-migrate').onclick=()=>act(migrate);
  $('cloud-logout').onclick=()=>{$('cloud-modal')?.remove();if(typeof requestGameLogout==='function')requestGameLogout()};
 }
 message(notice);
}
function bindLocalBackup(){const exp=$('cloud-export'),imp=$('cloud-import'),file=$('cloud-file');if(!exp||!imp||!file)return;exp.onclick=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 백업하세요.');const data=local.snapshot();if(!data.save||data.save.manager==null)throw Error('저장할 커리어가 없습니다.');const blob=new Blob([JSON.stringify({format:'ELEVOS_BACKUP_V1',...data})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elevos-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('백업 파일을 생성했습니다.')});imp.onclick=()=>file.click();file.onchange=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 복원하세요.');const f=file.files[0];if(!f)return;if(f.size>30000000)throw Error('파일 크기 제한 초과');const d=JSON.parse(await f.text());if(d.format!=='ELEVOS_BACKUP_V1'||d.save?.version!==2||!Array.isArray(d.save.players)||!Array.isArray(d.save.clubs)||!d.save.clubs.some(c=>c.id===d.save.manager)||!d.archive||typeof d.archive!=='object'||Array.isArray(d.archive))throw Error('올바른 ELEVOS 백업 파일이 아닙니다.');if(!confirm('현재 게스트 기록을 백업 파일로 교체할까요?'))return;local.restoreGuest(d)})}
function open(mode='login'){accountMode=mode==='register'?'register':'login';if($('cloud-modal')){draw();return;}if(!$('elevos-auth-style')){const style=document.createElement('style');style.id='elevos-auth-style';style.textContent=".cloud-panel{background:linear-gradient(145deg,#303d4e,#17212c 65%,#151b24)!important;border:1px solid #758aa3!important;border-radius:8px!important;box-shadow:0 20px 80px #0009}.auth-brand{text-align:center;margin:22px 0}.auth-brand img{width:145px;max-width:60%;display:block;margin:0 auto 18px;filter:brightness(0) invert(1)}.auth-brand strong{font-size:19px;color:#f0f5fc}.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 18px}.cloud-panel #auth-form input{box-sizing:border-box;border-radius:4px;padding:12px}.auth-primary,.auth-google{width:100%;min-height:44px;margin-top:16px!important}.auth-text{background:none;border:0;color:#c6d6e8;cursor:pointer;display:block;margin:16px auto!important}.auth-note{text-align:center;margin:16px 0 0;color:#bccbdb!important}";document.head.appendChild(style)};const el=document.createElement('div');el.id='cloud-modal';el.className='cloud-modal';if(window.ElevosEntry?.isOpen())el.style.zIndex='100001';el.innerHTML='<section id="cloud-panel" class="cloud-panel" role="dialog" aria-modal="true" aria-label="계정"></section>';document.body.appendChild(el);draw()}
async function registerMember(username,email,phone,password){
 if(!configured||!ready){message('회원 인증 서비스 연결을 확인해 주세요.');return}
 return act(async()=>{registering=true;let account=null;
 try{
  const credential=await A.createUserWithEmailAndPassword(auth,email,password);account=credential.user;
  const profile=F.doc(db,'users',account.uid),handle=F.doc(db,'usernames',username);
  await F.runTransaction(db,async tx=>{
   const existing=await tx.get(handle);if(existing.exists())throw Error('이미 사용 중인 아이디입니다.');
   tx.set(handle,{uid:account.uid});
   tx.set(profile,{username,email:account.email,phone,createdAt:F.serverTimestamp()});
  });
 }catch(e){if(account){const profile=await F.getDocFromServer(F.doc(db,'users',account.uid)).catch(()=>null);if(profile&&!profile.exists())await A.deleteUser(account).catch(()=>{});await A.signOut(auth).catch(()=>{})}throw e}
 finally{registering=false}
 await activateAccount(account);
 });
}
function entryLogin(email,password){if(!configured){message('회원 인증 서비스 연결 준비 중입니다.');return}if(!ready){message('계정 서비스 연결 중입니다.');return}if(!email.includes('@')){message('가입한 이메일 주소를 입력해 주세요.');return}return act(()=>A.signInWithEmailAndPassword(auth,email,password))}
function entryReset(email){if(!configured||!ready){message('계정 서비스가 연결되지 않았습니다.');return}if(!email||!email.includes('@')){message('비밀번호 재설정을 위해 가입 이메일을 입력해 주세요.');return}return act(async()=>{await A.sendPasswordResetEmail(auth,email);message('비밀번호 재설정 이메일 발송을 요청했습니다.')})}
window.ElevosCloud={open,entryLogin,entryReset,logoutSavedGame};
async function act(fn){
 if(busy)return;busy=true;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=true);
 try{await fn()}catch(e){message(({'auth/invalid-credential':'이메일 또는 비밀번호를 확인해 주세요.','auth/email-already-in-use':'이미 가입된 이메일입니다. 로그인해 주세요.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.','auth/invalid-email':'이메일 형식을 확인해 주세요.','auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 시도해 주세요.','auth/network-request-failed':'네트워크 연결을 확인해 주세요.','auth/too-many-requests':'요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'})[e.code]||('처리 실패: '+(e.message||'다시 시도하세요.')))}finally{busy=false;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=false)}
}
function requireAccount(){if(!user||local.uid!==user.uid)throw Error('계정 연결을 완료하세요.');if(local.busy)throw Error('경기 종료 후 실행하세요.');return user.uid}
const ptr=uid=>F.doc(db,'users',uid,'career','main');
const partRef=(uid,rev,key,i)=>F.doc(db,'users',uid,'career','main','revisions',rev,'parts',key+'-'+i);
function split(data){
 const {save,archive}=data;if(!save||save.manager==null)throw Error('저장할 구단이 없습니다.');
 const {players,calendarMatchArchive,coachCards,coachPacks,coachItems,economyLog,...core}=save;
 return {core,players:players||[],matches:archive?.matches||{},seasons:archive?.seasons||{},cups:archive?.cups||{},scores:archive?.leagueScores||{},calendar:calendarMatchArchive||{},cards:{coachCards,coachPacks,coachItems},economy:economyLog||[]};
}
function join(groups){return {save:{...groups.core,players:groups.players,calendarMatchArchive:groups.calendar,...groups.cards,economyLog:groups.economy},archive:{matches:groups.matches,seasons:groups.seasons,cups:groups.cups,leagueScores:groups.scores}}}
function chunks(value){const str=JSON.stringify(value??null),out=[];for(let i=0;i<str.length;i+=100000)out.push(str.slice(i,i+100000));return out}
async function upload(options={}){
 const automatic=options.automatic===true;const uid=automatic?user?.uid:requireAccount();if(!uid||local.uid!==uid||auth.currentUser?.uid!==uid)throw Error('계정 연결을 확인해 주세요.');if(!automatic&&!confirm('현재 계정의 로컬 기록을 클라우드에 저장할까요?'))return;
 const snapshot=local.snapshot();if(snapshot.save?.manager==null){if(automatic)return;throw Error('저장할 커리어가 없습니다.')}const groups=split(snapshot),before=await F.getDocFromServer(ptr(uid)),base=before.exists()?before.data().revision:null;
 if(base&&remoteRevision!==base){message('기존 클라우드 기록이 있습니다. 저장 여부를 확인하세요.');if(!confirm('현재 기록을 클라우드에 저장할까요? 이전 리비전은 보존됩니다.')){if(automatic)throw Error('클라우드 저장이 취소되었습니다. 로그아웃하지 않았습니다.');return}}
 const rev=crypto.randomUUID(),counts={};
 for(const key of parts){const list=chunks(groups[key]);counts[key]=list.length;if(list.length>200)throw Error('저장 용량 제한을 초과했습니다.');for(let i=0;i<list.length;i++){if(auth.currentUser?.uid!==uid)throw Error('계정이 변경되었습니다.');message('저장 중: '+key+' '+(i+1)+'/'+list.length);if($('game-logout-message'))$('game-logout-message').textContent='클라우드 저장 중입니다. '+key+' '+(i+1)+'/'+list.length;await F.setDoc(partRef(uid,rev,key,i),{data:list[i]})}}
 await F.runTransaction(db,async tx=>{const current=await tx.get(ptr(uid));if((current.exists()?current.data().revision:null)!==base)throw Error('다른 기기의 저장이 감지되었습니다. 다시 확인하세요.');tx.set(ptr(uid),{revision:rev,counts,schema:1,updatedAt:F.serverTimestamp()})});
 remoteRevision=rev;localStorage.setItem(local.guestKey+':uid:'+uid+':cloud-revision',rev);message('클라우드 저장 완료');
}
async function logoutSavedGame(){if(busy)throw Error('다른 계정 작업을 완료한 뒤 다시 시도하세요.');if(!configured||!ready||!user||local.uid!==user.uid)throw Error('로그인 상태를 확인해 주세요.');busy=true;try{await upload({automatic:true});sessionStorage.setItem('elevos-signed-out','1');sessionStorage.removeItem('elevos-beta-session');await A.signOut(auth)}finally{busy=false}}
async function download(){
 const uid=requireAccount();if(!confirm('현재 계정의 로컬 기록을 클라우드 기록으로 교체할까요?'))return;
 const snap=await F.getDocFromServer(ptr(uid));if(!snap.exists()){message('클라우드 저장 기록이 없습니다.');return}
 const data=await readCloudCareer(uid,snap);if(auth.currentUser?.uid!==uid||local.busy)throw Error('계정 또는 경기 상태가 변경되었습니다.');localStorage.setItem(local.guestKey+':uid:'+uid+':cloud-revision',snap.data().revision);local.switchAccount(uid,data);
}
async function readCloudCareer(uid,snap){ const {revision,counts,schema}=snap.data(),groups={};if(schema!==1)throw Error('지원하지 않는 저장 형식');
 for(const key of parts){const n=counts[key];if(!Number.isInteger(n)||n<1||n>200)throw Error('저장 데이터 오류');let text='';for(let i=0;i<n;i++){const d=await F.getDocFromServer(partRef(uid,revision,key,i));if(!d.exists())throw Error('저장 데이터 일부 누락');text+=d.data().data}groups[key]=JSON.parse(text);message('불러오는 중: '+key)}
 const data=join(groups);if(!data.save||data.save.version!==2||!Array.isArray(data.save.players)||!Array.isArray(data.save.clubs))throw Error('저장 데이터 형식 오류');
 if(auth.currentUser?.uid!==uid)throw Error('계정 상태가 변경되었습니다.');return data;
}
async function migrate(){
 const uid=requireAccount(),data=local.guestSnapshot();if(!data.save||data.save.manager==null){message('가져올 게스트 기록이 없습니다.');return}
 if(!confirm('게스트 커리어를 이 계정의 로컬 기록으로 복사할까요? 기존 계정 로컬 기록은 교체되며 원본 게스트 기록은 유지됩니다.'))return;
 local.switchAccount(uid,data);
}
async function boot(){
 if(!configured){message('회원 인증 서비스 연결 준비 중입니다.');return}
 try{
  const base='https://www.gstatic.com/firebasejs/11.10.0/';
  const app=await import(base+'firebase-app.js');A=await import(base+'firebase-auth.js');F=await import(base+'firebase-firestore.js');
  const instance=app.initializeApp(cfg);auth=A.getAuth(instance);db=F.getFirestore(instance);
  await A.setPersistence(auth,A.browserSessionPersistence);
  A.onAuthStateChanged(auth,u=>{ready=true;if(registering)return;activateAccount(u).catch(e=>{message('계정 연결 실패: '+(e.message||e.code));draw()})});
 }catch(e){message('Firebase 연결 실패: '+(e.code||e.message));draw()}
}
async function activateAccount(u){user=u;remoteRevision=null;
   if(u){sessionStorage.removeItem('elevos-beta-session');sessionStorage.removeItem('elevos-signed-out')}
   if(u&&local.uid!==u.uid){if(local.busy){message('경기 종료 후 계정 메뉴에서 다시 연결하세요.');draw();return}local.switchAccount(u.uid);return}
   if(!u&&local.uid){sessionStorage.removeItem('elevos-active-uid');sessionStorage.removeItem('elevos-beta-session');sessionStorage.setItem('elevos-signed-out','1');location.replace(location.pathname);return}
   const btn=$('cloud-account');if(btn)btn.textContent=u?'내 계정':'로그인';draw();if(u&&local.uid===u.uid){const profile=await F.getDocFromServer(F.doc(db,'users',u.uid));if(!profile.exists()){message('회원 정보 등록이 완료되지 않았습니다. 관리자에게 문의해 주세요.');return}const localKey=local.guestKey+':uid:'+u.uid;let career=null;try{career=JSON.parse(localStorage.getItem(localKey)||'null')}catch(e){}const snap=await F.getDocFromServer(ptr(u.uid));if(snap.exists()){remoteRevision=snap.data().revision;const marker=localStorage.getItem(localKey+':cloud-revision');if(!career||career.manager==null){const data=await readCloudCareer(u.uid,snap);localStorage.setItem(localKey+':cloud-revision',remoteRevision);local.switchAccount(u.uid,data);return}if(marker!==remoteRevision){remoteRevision=null;message('클라우드와 기기 기록을 확인해 주세요.')}}$('cloud-modal')?.remove();window.ElevosEntry?.release()}
}
boot();
