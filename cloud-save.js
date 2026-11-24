// ELEVOS private cloud-save beta. No credentials beyond public Firebase Web config.
const cfg=window.ELEVOS_FIREBASE_CONFIG||{};
const local=window.ElevosLocal;
let auth,db,A,F,user=null,ready=false,busy=false,notice='',remoteRevision=null;
const configured=!!(cfg.apiKey&&cfg.authDomain&&cfg.projectId&&cfg.appId);
const parts=['core','players','matches','seasons','cups','scores','calendar','cards','economy'];
const $=id=>document.getElementById(id);
function message(t){notice=t;if($('cloud-status'))$('cloud-status').textContent=t}
function draw(){
 const p=$('cloud-panel');if(!p)return;
 p.innerHTML='<div class="row"><h2>계정 및 클라우드 저장</h2><button class="btn sub mini" id="cloud-close">닫기</button></div><p id="cloud-status" class="cloud-status"></p>';
 $('cloud-close').onclick=()=>{if(!busy)$('cloud-modal')?.remove()};
 if(!configured){p.insertAdjacentHTML('beforeend','<p>현재 게스트 커리어를 이용 중입니다. 이 기기의 기록을 파일로 백업할 수 있습니다.</p><div class="cloud-actions"><button class="btn" id="cloud-export">기록 백업</button><button class="btn sub" id="cloud-import">기록 복원</button></div><input type="file" id="cloud-file" accept=".json,application/json" hidden>');bindLocalBackup();message('로컬 저장 모드');return}
 if(!ready){message(notice||'계정 서비스 연결 중');return}
 if(!user){
  p.insertAdjacentHTML('beforeend','<label for="cloud-email">이메일</label><input type="email" id="cloud-email" autocomplete="email"><label for="cloud-password">비밀번호</label><input type="password" id="cloud-password" autocomplete="current-password" minlength="6"><div class="cloud-actions"><button class="btn" id="cloud-login">로그인</button><button class="btn sub" id="cloud-register">회원가입</button></div><button class="btn sub" id="cloud-google">Google 로그인</button><button class="btn sub" id="cloud-reset">비밀번호 재설정</button>');
  $('cloud-login').onclick=()=>act(()=>A.signInWithEmailAndPassword(auth,$('cloud-email').value.trim(),$('cloud-password').value));
  $('cloud-register').onclick=()=>act(()=>A.createUserWithEmailAndPassword(auth,$('cloud-email').value.trim(),$('cloud-password').value));
  $('cloud-google').onclick=()=>act(()=>A.signInWithPopup(auth,new A.GoogleAuthProvider()));
  $('cloud-reset').onclick=()=>act(async()=>{await A.sendPasswordResetEmail(auth,$('cloud-email').value.trim());message('재설정 이메일 발송을 요청했습니다.')});
 }else{
  p.insertAdjacentHTML('beforeend','<p id="cloud-identity"></p><p>클라우드 저장은 직접 실행하는 방식입니다. 다른 기기에서 불러올 수 있으며 게스트 기록은 별도로 유지됩니다.</p><div class="cloud-actions"><button class="btn" id="cloud-upload">클라우드 저장</button><button class="btn sub" id="cloud-download">클라우드 불러오기</button><button class="btn sub" id="cloud-migrate">게스트 기록 가져오기</button><button class="btn sub" id="cloud-logout">로그아웃</button></div>');
  $('cloud-identity').textContent=user.email||'Google 계정';
  $('cloud-upload').onclick=()=>act(upload);
  $('cloud-download').onclick=()=>act(download);
  $('cloud-migrate').onclick=()=>act(migrate);
  $('cloud-logout').onclick=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 로그아웃하세요.');await A.signOut(auth);if(local.uid)local.switchAccount(null)});
 }
 message(notice);
}
function bindLocalBackup(){const exp=$('cloud-export'),imp=$('cloud-import'),file=$('cloud-file');if(!exp||!imp||!file)return;exp.onclick=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 백업하세요.');const data=local.snapshot();if(!data.save||data.save.manager==null)throw Error('저장할 커리어가 없습니다.');const blob=new Blob([JSON.stringify({format:'ELEVOS_BACKUP_V1',...data})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elevos-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('백업 파일을 생성했습니다.')});imp.onclick=()=>file.click();file.onchange=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 복원하세요.');const f=file.files[0];if(!f)return;if(f.size>30000000)throw Error('파일 크기 제한 초과');const d=JSON.parse(await f.text());if(d.format!=='ELEVOS_BACKUP_V1'||d.save?.version!==2||!Array.isArray(d.save.players)||!Array.isArray(d.save.clubs)||!d.save.clubs.some(c=>c.id===d.save.manager)||!d.archive||typeof d.archive!=='object'||Array.isArray(d.archive))throw Error('올바른 ELEVOS 백업 파일이 아닙니다.');if(!confirm('현재 게스트 기록을 백업 파일로 교체할까요?'))return;local.restoreGuest(d)})}
function open(){if($('cloud-modal'))return;const el=document.createElement('div');el.id='cloud-modal';el.className='cloud-modal';el.innerHTML='<section id="cloud-panel" class="cloud-panel" role="dialog" aria-modal="true" aria-label="계정"></section>';document.body.appendChild(el);draw()}
window.ElevosCloud={open};
async function act(fn){
 if(busy)return;busy=true;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=true);
 try{await fn()}catch(e){message('처리 실패: '+(e.code||e.message||'다시 시도하세요.'))}finally{busy=false;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=false)}
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
async function upload(){
 const uid=requireAccount();if(!confirm('현재 계정의 로컬 기록을 클라우드에 저장할까요?'))return;
 const snapshot=local.snapshot(),groups=split(snapshot),before=await F.getDocFromServer(ptr(uid)),base=before.exists()?before.data().revision:null;
 if(base&&remoteRevision!==base){message('다른 기기의 기록이 있습니다. 먼저 불러오거나 새 기록으로 교체할지 확인하세요.');if(!confirm('기존 클라우드 기록을 현재 로컬 기록으로 교체할까요? 이전 리비전은 보존됩니다.'))return}
 const rev=crypto.randomUUID(),counts={};
 for(const key of parts){const list=chunks(groups[key]);counts[key]=list.length;if(list.length>200)throw Error('저장 용량 제한을 초과했습니다.');for(let i=0;i<list.length;i++){if(auth.currentUser?.uid!==uid)throw Error('계정이 변경되었습니다.');message('저장 중: '+key+' '+(i+1)+'/'+list.length);await F.setDoc(partRef(uid,rev,key,i),{data:list[i]})}}
 await F.runTransaction(db,async tx=>{const current=await tx.get(ptr(uid));if((current.exists()?current.data().revision:null)!==base)throw Error('다른 기기의 저장이 감지되었습니다. 다시 확인하세요.');tx.set(ptr(uid),{revision:rev,counts,schema:1,updatedAt:F.serverTimestamp()})});
 remoteRevision=rev;message('클라우드 저장 완료');
}
async function download(){
 const uid=requireAccount();if(!confirm('현재 계정의 로컬 기록을 클라우드 기록으로 교체할까요?'))return;
 const snap=await F.getDocFromServer(ptr(uid));if(!snap.exists()){message('클라우드 저장 기록이 없습니다.');return}
 const {revision,counts,schema}=snap.data(),groups={};if(schema!==1)throw Error('지원하지 않는 저장 형식');
 for(const key of parts){const n=counts[key];if(!Number.isInteger(n)||n<1||n>200)throw Error('저장 데이터 오류');let text='';for(let i=0;i<n;i++){const d=await F.getDocFromServer(partRef(uid,revision,key,i));if(!d.exists())throw Error('저장 데이터 일부 누락');text+=d.data().data}groups[key]=JSON.parse(text);message('불러오는 중: '+key)}
 const data=join(groups);if(!data.save||data.save.version!==2||!Array.isArray(data.save.players)||!Array.isArray(data.save.clubs))throw Error('저장 데이터 형식 오류');
 if(auth.currentUser?.uid!==uid||local.busy)throw Error('계정 또는 경기 상태가 변경되었습니다.');
 local.switchAccount(uid,data);
}
async function migrate(){
 const uid=requireAccount(),data=local.guestSnapshot();if(!data.save||data.save.manager==null){message('가져올 게스트 기록이 없습니다.');return}
 if(!confirm('게스트 커리어를 이 계정의 로컬 기록으로 복사할까요? 기존 계정 로컬 기록은 교체되며 원본 게스트 기록은 유지됩니다.'))return;
 local.switchAccount(uid,data);
}
async function boot(){
 if(!configured)return;
 try{
  const base='https://www.gstatic.com/firebasejs/11.10.0/';
  const app=await import(base+'firebase-app.js');A=await import(base+'firebase-auth.js');F=await import(base+'firebase-firestore.js');
  const instance=app.initializeApp(cfg);auth=A.getAuth(instance);db=F.getFirestore(instance);
  await A.setPersistence(auth,A.browserSessionPersistence);
  A.onAuthStateChanged(auth,u=>{user=u;ready=true;remoteRevision=null;
   if(u&&local.uid!==u.uid){if(local.busy){message('경기 종료 후 계정 메뉴에서 다시 연결하세요.');draw();return}local.switchAccount(u.uid);return}
   if(!u&&local.uid){if(!local.busy)local.switchAccount(null);return}
   const btn=$('cloud-account');if(btn)btn.textContent=u?'내 계정':'로그인';draw();
  });
 }catch(e){message('Firebase 연결 실패: '+(e.code||e.message));draw()}
}
boot();
