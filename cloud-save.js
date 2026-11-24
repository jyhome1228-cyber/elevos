// ELEVOS private cloud-save beta. No credentials beyond public Firebase Web config.
const cfg=window.ELEVOS_FIREBASE_CONFIG||{};
const local=window.ElevosLocal;
let auth,db,A,F,user=null,ready=false,busy=false,notice='',remoteRevision=null,registering=false,activationRun=0;
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
  p.insertAdjacentHTML('beforeend','<div class="auth-brand"><img src="./elevos-wordmark.svg" alt="ELEVOS"><strong>'+(register?'회원가입':'로그인')+'</strong><p>현재 ELEVOS는 베타테스트 기간입니다.</p></div><div class="auth-tabs"><button class="btn '+(register?'sub':'')+'" id="auth-login-tab">로그인</button><button class="btn '+(register?'':'sub')+'" id="auth-register-tab">회원가입</button></div><form id="auth-form">'+(register?'<label for="cloud-real-name">성함</label><input type="text" id="cloud-real-name" autocomplete="name" maxlength="50" placeholder="실제 성함 입력" required><label for="cloud-username">아이디</label><input type="text" id="cloud-username" autocomplete="username" pattern="[A-Za-z0-9]{4,20}" maxlength="20" placeholder="영문·숫자 4~20자" required>':'<label for="cloud-login-email">이메일</label><input type="email" id="cloud-login-email" autocomplete="email" maxlength="254" placeholder="가입 이메일" required>')+'<label for="cloud-password">비밀번호</label><input type="password" id="cloud-password" autocomplete="'+(register?'new-password':'current-password')+'" minlength="'+(register?8:6)+'" placeholder="비밀번호 입력" required>'+(register?'<label for="cloud-password-confirm">비밀번호 확인</label><input type="password" id="cloud-password-confirm" autocomplete="new-password" minlength="8" required><label for="cloud-email">이메일</label><input type="email" id="cloud-email" autocomplete="email" placeholder="name@example.com" maxlength="254" required><label for="cloud-phone">휴대전화 번호</label><input type="tel" id="cloud-phone" autocomplete="tel-national" inputmode="tel" placeholder="010-1234-5678" maxlength="16" required><p class="auth-note">성함, 이메일, 휴대전화 번호는 회원 관리 및 계정 문의에 사용됩니다.</p><label style="display:flex;align-items:center;gap:8px"><input style="width:auto;flex:none" type="checkbox" id="cloud-beta-contact">베타테스트 안내 및 의견 수집 연락에 동의합니다 (선택)</label>':'')+'<button class="btn auth-primary" type="submit">'+(register?'회원가입':'로그인')+'</button></form>'+(!register?'<button class="auth-text" id="cloud-reset">비밀번호 찾기</button>':'')+'<p class="auth-note">회원가입 후 감독 프로필을 설정할 수 있습니다.</p>');
  $('auth-login-tab').onclick=()=>{accountMode='login';notice='';draw()};
  $('auth-register-tab').onclick=()=>{accountMode='register';notice='';draw()};
  $('auth-form').onsubmit=e=>{e.preventDefault();const password=$('cloud-password').value;if(!register){entryLogin($('cloud-login-email').value.trim(),password);return}const realName=$('cloud-real-name').value.trim(),betaContactConsent=$('cloud-beta-contact').checked;const username=$('cloud-username').value.trim().toLowerCase();if(!realName||realName.length>50){message('성함을 입력하세요.');return}const confirmPassword=$('cloud-password-confirm').value,email=$('cloud-email').value.trim(),phone=$('cloud-phone').value.trim().replace(/[\s-]/g,'');if(!/^[a-z0-9]{4,20}$/.test(username)){message('아이디는 영문과 숫자 4~20자로 입력하세요.');return}if(password.length<8){message('비밀번호는 8자 이상으로 입력하세요.');return}if(password!==confirmPassword){message('비밀번호가 일치하지 않습니다.');return}if(!/^01[016789][0-9]{7,8}$/.test(phone)){message('올바른 휴대전화 번호를 입력하세요.');return}registerMember(username,email,phone,password,realName,betaContactConsent)};
  if($('cloud-reset'))$('cloud-reset').onclick=()=>entryReset($('cloud-login-email').value.trim());
  if(!configured)message('회원 인증 서비스 연결 준비 중입니다.');
  else if(!ready)message('계정 서비스 연결 중입니다.');
 }else{
  p.querySelector('h2').textContent='내 계정';
  let legacy=false;try{legacy=local.guestSnapshot()?.save?.manager!=null}catch(e){}
  p.insertAdjacentHTML('beforeend','<div class="account-simple"><div class="account-email"><small>로그인 이메일</small><strong id="cloud-identity"></strong></div><div class="account-auto"><span class="account-auto-dot"></span><div><strong>자동 저장</strong><p>주요 경기 진행 시 자동 저장하며 로그아웃할 때 최종 저장합니다.</p></div></div><button class="btn sub account-signout" id="cloud-logout">게임 로그아웃</button><details class="account-recovery"><summary>저장 및 복원 관리</summary><div class="cloud-actions"><button class="btn sub" id="cloud-upload">지금 저장</button><button class="btn sub" id="cloud-download">저장 기록 불러오기</button>'+(legacy?'<button class="btn sub" id="cloud-migrate">이전 테스트 기록 가져오기</button>':'')+'</div></details></div>');
  $('cloud-identity').textContent=user.email||'회원 계정';
  mountPersonalProfile();
  const profile52=document.createElement('div');profile52.id='cloud-coach-profile52';if(typeof window.coachProfileControl52==='function')profile52.innerHTML=window.coachProfileControl52();$('cloud-identity').closest('.account-email').after(profile52);
  $('cloud-upload').onclick=()=>act(upload);
  $('cloud-download').onclick=()=>act(download);
  if($('cloud-migrate'))$('cloud-migrate').onclick=()=>act(migrate);
  $('cloud-logout').onclick=()=>{$('cloud-modal')?.remove();if(typeof requestGameLogout==='function')requestGameLogout()};

 }
 message(notice);
}

function mountPersonalProfile(){
 const account=auth?.currentUser,identity=$('cloud-identity');if(!account||!identity)return;
 const section=document.createElement('details');section.className='account-recovery';section.innerHTML='<summary>개인정보 수정</summary><form id="personal-profile-form" style="display:grid;gap:8px;margin-top:12px"><label for="personal-name">성함</label><input id="personal-name" autocomplete="name" maxlength="50" required><label for="personal-phone">연락처</label><input id="personal-phone" type="tel" autocomplete="tel-national" maxlength="16" required><label for="personal-email">로그인 이메일</label><input id="personal-email" type="email" readonly><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="personal-consent" style="width:auto;flex:none">베타테스트 안내 및 의견 수집 연락 동의 (선택)</label><button class="btn" type="submit" disabled>개인정보 저장</button></form><details class="account-recovery"><summary>이메일 변경</summary><form id="personal-email-form" style="display:grid;gap:8px;margin-top:12px"><label for="personal-new-email">새 이메일</label><input id="personal-new-email" type="email" maxlength="254" required><label for="personal-current-password">현재 비밀번호</label><input id="personal-current-password" type="password" autocomplete="current-password" required><button type="submit" class="btn sub">인증 메일 보내기</button><p>새 이메일의 인증 링크를 확인한 뒤 다시 로그인하면 변경된 주소가 회원 정보에 반영됩니다.</p></form></details><button class="btn sub" type="button" id="personal-reset" style="margin-top:10px">비밀번호 재설정 이메일 보내기</button><p id="personal-status" role="status"></p>';
 identity.closest('.account-email').after(section);
 const q=id=>section.querySelector('#'+id),status=t=>{q('personal-status').textContent=t},ref=F.doc(db,'users',account.uid),same=()=>auth.currentUser?.uid===account.uid;
 q('personal-email').value=account.email||'';
 const form=q('personal-profile-form'),saveButton=form.querySelector('button');
 let loaded=false,working=false;
 async function loadProfile(){
  try{const snap=await F.getDocFromServer(ref);if(!same()||!section.isConnected)return;if(!snap.exists())throw Error('회원 프로필이 없습니다.');const v=snap.data();
   q('personal-name').value=v.realName||v.fullName||'';q('personal-phone').value=v.phone||'';q('personal-consent').checked=v.betaContactConsent===true;loaded=true;saveButton.disabled=false;
   if(!q('personal-name').value||!q('personal-phone').value){section.open=true;status('미등록 개인정보를 입력해 주세요.')}
   if(v.email!==account.email&&account.email){section.open=true;status('로그인 이메일이 변경되었습니다. 개인정보 저장을 눌러 회원 정보를 동기화해 주세요.')}
  }catch(e){status('회원 정보를 불러오지 못했습니다. 다시 계정 메뉴를 열어 주세요.');section.open=true}
 }
 form.onsubmit=async e=>{e.preventDefault();if(!same()||!loaded||working)return;const realName=q('personal-name').value.trim(),phone=q('personal-phone').value.replace(/[\\s-]/g,'');if(!realName||realName.length>50||!/^01[016789][0-9]{7,8}$/.test(phone)){status('성함과 올바른 휴대전화 번호를 입력해 주세요.');return}working=true;saveButton.disabled=true;try{await account.getIdToken(true);if(!same())throw Error('계정 변경');await F.updateDoc(ref,{realName,phone,email:account.email,betaContactConsent:q('personal-consent').checked});if(same())status('개인정보가 저장되었습니다.')}catch(e){status('저장 실패. Firestore 규칙 또는 연결 상태를 확인해 주세요.')}finally{working=false;saveButton.disabled=!loaded}};
 q('personal-email-form').onsubmit=async e=>{e.preventDefault();if(!same()||working)return;const email=q('personal-new-email').value.trim(),password=q('personal-current-password').value,button=e.currentTarget.querySelector('button');if(!email||email.toLowerCase()===String(account.email).toLowerCase()){status('현재와 다른 이메일을 입력하세요.');return}working=true;button.disabled=true;try{await A.reauthenticateWithCredential(account,A.EmailAuthProvider.credential(account.email,password));if(!same())throw Error('계정 변경');await A.verifyBeforeUpdateEmail(account,email);status('새 이메일로 인증 메일 발송을 요청했습니다.')}catch(e){status('이메일 변경 요청 실패. 비밀번호와 이메일을 확인해 주세요.')}finally{q('personal-current-password').value='';working=false;button.disabled=false}};
 q('personal-reset').onclick=async()=>{if(!same()||working)return;working=true;try{await A.sendPasswordResetEmail(auth,account.email);status('비밀번호 재설정 이메일 발송을 요청했습니다.')}catch(e){status('재설정 요청에 실패했습니다.')}finally{working=false}};
 loadProfile();
}

function bindLocalBackup(){const exp=$('cloud-export'),imp=$('cloud-import'),file=$('cloud-file');if(!exp||!imp||!file)return;exp.onclick=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 백업하세요.');const data=local.snapshot();if(!data.save||data.save.manager==null)throw Error('저장할 커리어가 없습니다.');const blob=new Blob([JSON.stringify({format:'ELEVOS_BACKUP_V1',...data})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elevos-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('백업 파일을 생성했습니다.')});imp.onclick=()=>file.click();file.onchange=()=>act(async()=>{if(local.busy)throw Error('경기 종료 후 복원하세요.');const f=file.files[0];if(!f)return;if(f.size>30000000)throw Error('파일 크기 제한 초과');const d=JSON.parse(await f.text());if(d.format!=='ELEVOS_BACKUP_V1'||d.save?.version!==2||!Array.isArray(d.save.players)||!Array.isArray(d.save.clubs)||!d.save.clubs.some(c=>c.id===d.save.manager)||!d.archive||typeof d.archive!=='object'||Array.isArray(d.archive))throw Error('올바른 ELEVOS 백업 파일이 아닙니다.');if(!confirm('현재 게스트 기록을 백업 파일로 교체할까요?'))return;local.restoreGuest(d)})}
function open(mode='login'){accountMode=mode==='register'?'register':'login';if($('cloud-modal')){draw();return;}if(!$('elevos-auth-style')){const style=document.createElement('style');style.id='elevos-auth-style';style.textContent=".cloud-panel{background:linear-gradient(145deg,#303d4e,#17212c 65%,#151b24)!important;border:1px solid #758aa3!important;border-radius:8px!important;box-shadow:0 20px 80px #0009}.auth-brand{text-align:center;margin:22px 0}.auth-brand img{width:145px;max-width:60%;display:block;margin:0 auto 18px;filter:brightness(0) invert(1)}.auth-brand strong{font-size:19px;color:#f0f5fc}.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 18px}.cloud-panel #auth-form input{box-sizing:border-box;border-radius:4px;padding:12px}.auth-primary,.auth-google{width:100%;min-height:44px;margin-top:16px!important}.auth-text{background:none;border:0;color:#c6d6e8;cursor:pointer;display:block;margin:16px auto!important}.auth-note{text-align:center;margin:16px 0 0;color:#bccbdb!important}.account-simple{display:grid;gap:16px;margin-top:14px}.account-email{display:grid;gap:6px;padding:13px 0;border-bottom:1px solid #62758b44}.account-email small{color:#b3c2d4;font-size:12px}.account-email strong{font-size:16px;color:#edf3fb;overflow-wrap:anywhere}.account-auto{display:flex;gap:10px;align-items:flex-start;background:#10192377;border:1px solid #52667e66;border-radius:5px;padding:14px}.account-auto-dot{width:8px;height:8px;background:#86c5a7;border-radius:50%;flex:none;margin-top:5px}.account-auto strong{font-size:14px}.account-auto p{margin:5px 0 0;font-size:13px!important}.account-signout{width:100%;min-height:42px;margin:0!important}.account-recovery{border-top:1px solid #62758b44;padding-top:12px;color:#c7d4e3;font-size:13px}.account-recovery summary{cursor:pointer;padding:6px 0}.account-recovery .cloud-actions{margin-top:8px}.cloud-panel .cloud-status:empty{display:none}";document.head.appendChild(style)};const el=document.createElement('div');el.id='cloud-modal';el.className='cloud-modal';if(window.ElevosEntry?.isOpen())el.style.zIndex='100001';el.innerHTML='<section id="cloud-panel" class="cloud-panel" role="dialog" aria-modal="true" aria-label="계정"></section>';document.body.appendChild(el);draw()}
function authProgress(label){let el=$('auth-processing-screen');if(!el){el=document.createElement('div');el.id='auth-processing-screen';el.className='auth-processing-screen';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<div class="auth-processing-inner"><img src="./elevos-intro.svg" alt="ELEVOS"><div class="auth-spinner" aria-hidden="true"></div><p></p></div>';document.body.appendChild(el)}const p=el.querySelector('p');if(p)p.textContent=label}
function clearAuthProgress(){$('auth-processing-screen')?.remove()}
function bounded(p,label,ms=18000){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' 시간 초과. 네트워크를 확인하고 다시 시도해 주세요.')),ms)})]).finally(()=>clearTimeout(timer))}
function restoreMarker(uid,rev){try{localStorage.setItem(local.guestKey+':uid:'+uid+':cloud-revision',rev)}catch(e){}sessionStorage.setItem('elevos-restored-revision:'+uid,rev)}
function authLoadFailure(error){clearAuthProgress();sessionStorage.removeItem('elevos-auth-progress');const el=document.createElement('div');el.id='auth-processing-screen';el.className='auth-processing-screen';el.innerHTML='<section class="auth-processing-inner" role="dialog" aria-modal="true"><h2>게임 기록을 불러오지 못했습니다.</h2><p></p><button class="btn" data-retry>다시 시도</button><button class="btn sub" data-back>로그인 화면으로</button></section>';el.querySelector('p').textContent=error?.message||'연결 상태를 확인해 주세요.';document.body.appendChild(el);el.querySelector('[data-retry]').onclick=()=>{clearAuthProgress();if(auth?.currentUser)activateAccount(auth.currentUser).catch(authLoadFailure);else location.reload()};el.querySelector('[data-back]').onclick=async()=>{try{if(auth)await A.signOut(auth)}catch(e){el.querySelector('p').textContent='로그아웃하지 못했습니다. 다시 시도해 주세요.';return}sessionStorage.removeItem('elevos-active-uid');sessionStorage.removeItem('elevos-auth-progress');location.replace(location.pathname)};el.querySelector('[data-retry]').focus()}

function confirmRegistration(){return new Promise(resolve=>{clearAuthProgress();const el=document.createElement('div');el.id='auth-processing-screen';el.className='auth-processing-screen';el.innerHTML='<section class="auth-processing-inner" role="dialog" aria-modal="true" aria-label="회원가입 완료"><img src="./elevos-intro.svg" alt="ELEVOS"><div class="auth-success-mark" aria-hidden="true">✓</div><h2>회원가입 완료</h2><p>ELEVOS 회원가입이 완료되었습니다.</p><button class="btn">확인</button></section>';document.body.appendChild(el);const button=el.querySelector('button');button.onclick=()=>{clearAuthProgress();resolve()};button.focus()})}

async function registerMember(username,email,phone,password,realName,betaContactConsent){
 if(!configured||!ready){message('회원 인증 서비스 연결을 확인해 주세요.');return}
 return act(async()=>{registering=true;let account=null;authProgress('회원 정보를 등록하고 있습니다.');
 try{
  const credential=await A.createUserWithEmailAndPassword(auth,email,password);account=credential.user;
  const profile=F.doc(db,'users',account.uid),handle=F.doc(db,'usernames',username);
  await F.runTransaction(db,async tx=>{
   const existing=await tx.get(handle);if(existing.exists())throw Error('이미 사용 중인 아이디입니다.');
   tx.set(handle,{uid:account.uid});
   tx.set(profile,{username,email:account.email,phone,realName,betaContactConsent,createdAt:F.serverTimestamp()});
  });
 }catch(e){if(account){const profile=await F.getDocFromServer(F.doc(db,'users',account.uid)).catch(()=>null);if(profile&&!profile.exists())await A.deleteUser(account).catch(()=>{});await A.signOut(auth).catch(()=>{})}throw e}
 finally{registering=false}
 await confirmRegistration();sessionStorage.setItem('elevos-auth-progress','1');authProgress('게임에 접속하고 있습니다.');await activateAccount(account);
 });
}
function entryLogin(email,password){if(!configured){message('회원 인증 서비스 연결 준비 중입니다.');return}if(!ready){message('계정 서비스 연결 중입니다.');return}if(!email.includes('@')){message('가입한 이메일 주소를 입력해 주세요.');return}return act(async()=>{sessionStorage.setItem('elevos-auth-progress','1');authProgress('로그인하고 있습니다.');await A.signInWithEmailAndPassword(auth,email,password)})}
function entryReset(email){if(!configured||!ready){message('계정 서비스가 연결되지 않았습니다.');return}if(!email||!email.includes('@')){message('비밀번호 재설정을 위해 가입 이메일을 입력해 주세요.');return}return act(async()=>{await A.sendPasswordResetEmail(auth,email);message('비밀번호 재설정 이메일 발송을 요청했습니다.')})}
let autoTimer=null,autoPending=false,autoFlight=null,autoBlocked=false;
function autoStatusV10(state){window.dispatchEvent(new CustomEvent('elevos-save-status',{detail:state}));}
function queueCareerSaveV10(){if(!ready||!user||local.uid!==user.uid)return;autoPending=true;autoStatusV10('pending');clearTimeout(autoTimer);autoTimer=setTimeout(flushCareerSaveV10,1200)}
async function flushCareerSaveV10(){if(!autoPending||autoBlocked||!ready||!user||local.uid!==user.uid)return;if(busy||autoFlight){autoTimer=setTimeout(flushCareerSaveV10,2000);return}autoPending=false;busy=true;autoStatusV10('saving');autoFlight=upload({automatic:true,background:true});try{await autoFlight;autoStatusV10(autoPending?'pending':'saved')}catch(e){autoPending=true;autoBlocked=e.message==='다른 기기의 저장이 감지되었습니다.';autoStatusV10(autoBlocked?'conflict':'failed');console.warn('자동 저장 실패',e)}finally{autoFlight=null;busy=false;if(autoPending&&!autoBlocked)autoTimer=setTimeout(flushCareerSaveV10,15000)}}
window.addEventListener('online',()=>{if(autoPending&&!autoBlocked)queueCareerSaveV10()});
async function manualSave136(){if(autoFlight)await autoFlight.catch(()=>{});if(busy)throw Error('다른 계정 작업이 진행 중입니다.');if(!configured||!ready||!user||local.uid!==user.uid)throw Error('로그인 상태를 확인해 주세요.');busy=true;try{await upload({automatic:true});autoBlocked=false;autoStatusV10('saved')}finally{busy=false}}
window.ElevosCloud={open,entryLogin,entryReset,logoutSavedGame,manualSave136,queueCareerSaveV10,isAuthenticatedCareer(uid){const u=auth?.currentUser;return !!(ready&&u&&user?.uid===uid&&u.uid===uid&&local.uid===uid)},isTestAccount(uid){const u=auth?.currentUser;return !!(ready&&u&&user?.uid===uid&&u.uid===uid&&local.uid===uid&&['info@9works.kr','hhs0579@naver.com','kimdanbi1226@naver.com'].includes(String(u.email||'').trim().toLowerCase()))},isOriginalTestAccount(uid){const u=auth?.currentUser;return !!(ready&&u&&user?.uid===uid&&u.uid===uid&&local.uid===uid&&String(u.email||'').trim().toLowerCase()==='info@9works.kr')}};
async function act(fn){
 if(busy)return;busy=true;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=true);
 try{await fn()}catch(e){clearAuthProgress();sessionStorage.removeItem('elevos-auth-progress');message(({'auth/invalid-credential':'이메일 또는 비밀번호를 확인해 주세요.','auth/email-already-in-use':'이미 가입된 이메일입니다. 로그인해 주세요.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.','auth/invalid-email':'이메일 형식을 확인해 주세요.','auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 시도해 주세요.','auth/network-request-failed':'네트워크 연결을 확인해 주세요.','auth/too-many-requests':'요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'})[e.code]||('처리 실패: '+(e.message||'다시 시도하세요.')))}finally{busy=false;document.querySelectorAll('#cloud-panel button').forEach(b=>b.disabled=false)}
}
function requireAccount(){if(!user||local.uid!==user.uid)throw Error('계정 연결을 완료하세요.');if(local.busy)throw Error('경기 종료 후 실행하세요.');return user.uid}
let activityRecordedDay='',activityPending=false;
async function recordGameActivity(uid){
 if(auth.currentUser?.uid!==uid||local.uid!==uid||document.visibilityState==='hidden'||activityPending)return;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const key=uid+':'+day;if(activityRecordedDay===key)return;
 activityPending=true;try{await F.setDoc(F.doc(db,'users',uid,'activity',day),{lastSeenAt:F.serverTimestamp()});activityRecordedDay=key}catch(e){console.warn('활동 기록 실패',e)}finally{activityPending=false}
}
let activityTimer=null;
function startGameActivity(uid){clearInterval(activityTimer);recordGameActivity(uid);activityTimer=setInterval(()=>recordGameActivity(uid),60000)}

async function syncPlaySummary(uid,save){
 if(auth.currentUser?.uid!==uid||local.uid!==uid||!save||save.manager==null)return;
 const rewards=Array.isArray(save.coachProgress?.rewards)?save.coachProgress.rewards:[];
 const state=id=>{const r=rewards.find(x=>x.id===id);return !r?'absent':r.claimed===true?'claimed':'pending'};
 const count=a=>Array.isArray(a)?a.length:0;
 const matches=Number.isSafeInteger(save.coachProgress?.total)&&save.coachProgress.total>=0?save.coachProgress.total:0;
 const wallet=Number.isFinite(save.walletGBP)?Math.max(0,Math.min(1000000000000000,save.walletGBP)):0;
 const summary={matches,wallet,squad:Array.isArray(save.players)?save.players.filter(p=>p.club===save.manager).length:0,cards:count(save.coachCards),packs:count(save.coachPacks),supply:state('all-member-supply-20261124-v1'),beta1:state('beta-support-v20261124'),beta2:state('beta-support-v2-20261124'),collection:state('beta-collection-2026'),updatedAt:F.serverTimestamp()};
 try{await bounded(F.setDoc(F.doc(db,'users',uid,'summary','play'),summary),'플레이 현황 동기화',8000)}catch(e){console.warn('플레이 요약 동기화 실패',e)}
}

async function syncCareerSummary(uid,save){
 if(auth.currentUser?.uid!==uid||local.uid!==uid||!save||save.manager==null)return;
 const club=save.clubs?.find(c=>c.id===save.manager);if(!club)return;
 const level=save.coachProgress?.level,portrait=save.coachPortraitId52;
 const summary={coachName:String(save.coachName||'').slice(0,80),level:Number.isInteger(level)&&level>=1&&level<=100000?level:1,portraitId:Number.isInteger(portrait)&&portrait>=0&&portrait<=35?portrait:-1,clubName:String(club.nameKo||club.name||'').slice(0,100),season:String(save.season??'').slice(0,40),round:Number.isInteger(save.round)&&save.round>=0&&save.round<=100000?save.round:0,updatedAt:F.serverTimestamp()};
 try{await bounded(F.setDoc(F.doc(db,'users',uid,'summary','current'),summary),'감독 정보 동기화',8000)}catch(e){console.warn('감독 요약 동기화 실패',e)}
}

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
 if(base&&remoteRevision!==base){if(options.background)throw Error('다른 기기의 저장이 감지되었습니다.');message('기존 클라우드 기록이 있습니다. 저장 여부를 확인하세요.');if(!confirm('현재 기록을 클라우드에 저장할까요? 이전 리비전은 보존됩니다.')){if(automatic)throw Error('클라우드 저장이 취소되었습니다. 로그아웃하지 않았습니다.');return}}
 const rev=crypto.randomUUID(),counts={};
 for(const key of parts){const list=chunks(groups[key]);counts[key]=list.length;if(list.length>200)throw Error('저장 용량 제한을 초과했습니다.');for(let i=0;i<list.length;i++){if(auth.currentUser?.uid!==uid)throw Error('계정이 변경되었습니다.');message('게임 기록을 저장하고 있습니다.');if($('game-logout-message'))$('game-logout-message').textContent='게임 기록을 저장하고 있습니다.';await F.setDoc(partRef(uid,rev,key,i),{data:list[i]})}}
 await F.runTransaction(db,async tx=>{const current=await tx.get(ptr(uid));if((current.exists()?current.data().revision:null)!==base)throw Error('다른 기기의 저장이 감지되었습니다.');tx.set(ptr(uid),{revision:rev,counts,schema:1,updatedAt:F.serverTimestamp()})});
 remoteRevision=rev;await Promise.all([syncCareerSummary(uid,snapshot.save),syncPlaySummary(uid,snapshot.save)]);try{if(!options.background)localStorage.setItem(local.guestKey+':uid:'+uid+':cloud-revision',rev);else localStorage.setItem(local.guestKey+':uid:'+uid+':cloud-revision',rev)}catch(e){console.warn('클라우드 저장 완료, 기기 캐시 갱신 실패',e);try{localStorage.removeItem(local.guestKey+':uid:'+uid+':cloud-revision')}catch(_){}}message('클라우드 저장 완료');
}
async function logoutSavedGame(){clearTimeout(autoTimer);if(autoFlight)await autoFlight.catch(()=>{});if(busy)throw Error('다른 계정 작업을 완료한 뒤 다시 시도하세요.');if(!configured||!ready||!user||local.uid!==user.uid)throw Error('로그인 상태를 확인해 주세요.');busy=true;try{await upload({automatic:true});sessionStorage.setItem('elevos-signed-out','1');sessionStorage.removeItem('elevos-beta-session');await A.signOut(auth)}finally{busy=false}}
async function download(){
 const uid=requireAccount();if(!confirm('현재 계정의 로컬 기록을 클라우드 기록으로 교체할까요?'))return;
 const snap=await F.getDocFromServer(ptr(uid));if(!snap.exists()){message('클라우드 저장 기록이 없습니다.');return}
 const data=await readCloudCareer(uid,snap);if(auth.currentUser?.uid!==uid||local.busy)throw Error('계정 또는 경기 상태가 변경되었습니다.');restoreMarker(uid,snap.data().revision);local.switchAccount(uid,data);
}
async function readCloudCareer(uid,snap){
 const {revision,counts,schema}=snap.data(),groups={};if(schema!==1||typeof revision!=='string')throw Error('지원하지 않는 저장 형식');
 const jobs=[];for(const key of parts){const n=counts?.[key];if(!Number.isInteger(n)||n<1||n>200)throw Error('저장 데이터 오류');groups[key]=Array(n);for(let i=0;i<n;i++)jobs.push([key,i])}
 let done=0;for(let j=0;j<jobs.length;j+=12){await bounded(Promise.all(jobs.slice(j,j+12).map(async ([key,i])=>{const d=await F.getDocFromServer(partRef(uid,revision,key,i));if(!d.exists()||typeof d.data().data!=='string')throw Error('저장 데이터 일부 누락: '+key);groups[key][i]=d.data().data;done++;if(window.ElevosEntry?.isOpen())authProgress('게임 기록 불러오는 중 · '+done+' / '+jobs.length)})),'게임 기록 불러오기',20000)}
 for(const key of parts)groups[key]=JSON.parse(groups[key].join(''));
 const data=join(groups);if(!data.save||data.save.version!==2||!Array.isArray(data.save.players)||!Array.isArray(data.save.clubs)||!data.save.clubs.some(c=>c.id===data.save.manager))throw Error('저장 데이터 형식 오류');if(auth.currentUser?.uid!==uid)throw Error('계정 상태가 변경되었습니다.');return data;
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
  const [app,authModule,firestoreModule]=await bounded(Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]),'Firebase 연결');A=authModule;F=firestoreModule;
  const instance=app.initializeApp(cfg);auth=A.getAuth(instance);db=F.getFirestore(instance);
  await bounded(A.setPersistence(auth,A.browserSessionPersistence),'인증 초기화');
  A.onAuthStateChanged(auth,u=>{ready=true;if(registering)return;activateAccount(u).catch(authLoadFailure)});
 }catch(e){authLoadFailure(e)}
}
async function activateAccount(u){
 const run=++activationRun;user=u;remoteRevision=null;
 if(!u){clearInterval(activityTimer);clearAuthProgress();sessionStorage.removeItem('elevos-auth-progress');if(local.uid){sessionStorage.removeItem('elevos-active-uid');sessionStorage.setItem('elevos-signed-out','1');location.replace(location.pathname)}return}
 if(!window.ElevosEntry?.isOpen())return;
 authProgress('회원 정보 확인 중');
 sessionStorage.removeItem('elevos-beta-session');sessionStorage.removeItem('elevos-signed-out');
 const uid=u.uid,localKey=local.guestKey+':uid:'+uid;
 const [profile,snap]=await bounded(Promise.all([F.getDocFromServer(F.doc(db,'users',uid)),F.getDocFromServer(ptr(uid))]),'회원 및 저장 기록 확인');
 if(run!==activationRun||auth.currentUser?.uid!==uid)return;
 if(!profile.exists())throw Error('회원 정보 등록이 완료되지 않았습니다. 관리자에게 문의해 주세요.');
 let career=null;try{career=local.readCareerCache(uid)}catch(e){}
 if(snap.exists()){
  remoteRevision=snap.data().revision;
  let marker=null;try{marker=localStorage.getItem(localKey+':cloud-revision')}catch(e){}
  const restored=sessionStorage.getItem('elevos-restored-revision:'+uid);
  const valid=career&&career.manager!=null&&Array.isArray(career.players)&&Array.isArray(career.clubs)&&career.clubs.some(c=>c.id===career.manager);
  const needsRestore=!valid||((marker!==remoteRevision&&restored!==remoteRevision)&&confirm('서버에 저장된 게임 기록을 불러올까요? 취소하면 현재 기기 기록을 유지합니다.'));
  if(needsRestore){if(restored===remoteRevision&&!valid)throw Error('이 기기에 저장 기록을 복원하지 못했습니다. 기록은 서버에 보존되어 있습니다.');const data=await readCloudCareer(uid,snap);if(run!==activationRun||auth.currentUser?.uid!==uid)return;restoreMarker(uid,remoteRevision);local.switchAccount(uid,data);return}
  if(marker!==remoteRevision&&restored!==remoteRevision)remoteRevision=null;
 }
 if(local.uid!==uid){sessionStorage.setItem('elevos-auth-progress','1');local.switchAccount(uid);return}
 const btn=$('cloud-account');if(btn)btn.textContent='내 계정';$('cloud-modal')?.remove();clearAuthProgress();sessionStorage.removeItem('elevos-auth-progress');window.ElevosEntry?.release();
 startGameActivity(uid);
 if(career){syncCareerSummary(uid,career);syncPlaySummary(uid,career)}
}

if(sessionStorage.getItem('elevos-auth-progress')==='1'&&window.ElevosEntry?.isOpen())authProgress('게임 기록을 불러오고 있습니다.');
boot();
