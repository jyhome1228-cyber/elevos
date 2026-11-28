import './diagnostics-q10.js?v=1';
import{initializeApp,getApps,getApp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import{getAuth,setPersistence,browserSessionPersistence,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import{getFirestore,doc,runTransaction,getDocFromServer,serverTimestamp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const $=id=>document.getElementById(id),app=(getApps().some(a=>a.name==='[DEFAULT]')?getApp():initializeApp(window.ELEVOS_FIREBASE_CONFIG)),auth=getAuth(app),db=getFirestore(app),join=document.body.dataset.mode==='signup';
let busy=false,resetBusy=false;const status=t=>$('auth-status').textContent=t;
const destination=()=>new URLSearchParams(location.search).get('next')==='community'?'./community.html':'./home.html';
async function finishProfileQ05(api,account,fields){
 const uid=account.uid,profile=api.doc('users',uid),handle=api.doc('usernames',fields.username);
 return api.transaction(async tx=>{
  if(api.uid()!==uid)throw Error('로그인 계정이 변경되었습니다.');
  const existingProfile=await tx.get(profile),existingHandle=await tx.get(handle);
  if(existingProfile.exists()){
   if(existingProfile.data().username===fields.username&&existingHandle.exists()&&existingHandle.data().uid===uid)return 'existing';
   throw Error('이미 가입된 계정입니다. 로그인해 주세요.');
  }
  if(existingHandle.exists()&&existingHandle.data().uid!==uid)throw Error('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');
  if(!existingHandle.exists())tx.set(handle,{uid});
  tx.set(profile,{...fields,email:account.email,createdAt:api.timestamp()});
  return 'created';
 });
}
async function signupAccountQ05(api,email,password){
 try{return (await api.create(email,password)).user}catch(e){
  if(e.code!=='auth/email-already-in-use')throw e;
  try{return (await api.signIn(email,password)).user}catch(err){
   if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(err.code))throw Error('이미 가입된 이메일입니다. 기존 비밀번호로 가입을 이어가거나 로그인해 주세요.');
   throw err;
  }
 }
}
const api={uid:()=>auth.currentUser?.uid,doc:(...path)=>doc(db,...path),transaction:fn=>runTransaction(db,fn),timestamp:()=>serverTimestamp()};
function boundedQ05(p,label,ms=25000){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' 응답이 지연되고 있습니다. 같은 이메일로 다시 시도해 주세요.')),ms)})]).finally(()=>clearTimeout(timer))}
function enableQ05(){$('submit').disabled=false;if($('reset'))$('reset').disabled=resetBusy}
try{await setPersistence(auth,browserSessionPersistence);onAuthStateChanged(auth,async u=>{
 if(busy)return;
 if(!u){enableQ05();return}
 try{
  const profile=await boundedQ05(getDocFromServer(doc(db,'users',u.uid)),'회원 정보 확인',15000);
  if(busy||auth.currentUser?.uid!==u.uid)return;
  if(profile.exists()){location.replace(destination());return}
  if(!join){location.replace('./signup.html'+location.search);return}
  status('미완료 회원가입입니다. 기존 이메일과 비밀번호로 등록을 이어서 진행하세요.');$('email').value=u.email||'';
 }catch(e){if(!busy&&auth.currentUser?.uid===u.uid)status('회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.')}
 finally{if(!busy)enableQ05()}
})}catch{status('인증 연결 실패. 새로고침해 주세요.')}
$('auth-form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;$('submit').disabled=true;let account=null;
 try{
  const email=$('email').value.trim(),password=$('password').value;
  if(join){
   const realName=$('realName').value.trim(),username=$('username').value.trim().toLowerCase(),phone=$('phone').value.replace(/[\s-]/g,'');
   if(!realName||realName.length>50||!/^[a-z0-9]{4,20}$/.test(username)||!/^01[016789][0-9]{7,8}$/.test(phone)||password.length<8||password!==$('confirm').value)throw Error('성함, 아이디, 연락처 및 비밀번호 확인을 확인하세요.');
   status('회원 정보를 등록하고 있습니다.');
   account=await signupAccountQ05({create:(e,p)=>createUserWithEmailAndPassword(auth,e,p),signIn:(e,p)=>signInWithEmailAndPassword(auth,e,p)},email,password);
   await boundedQ05(finishProfileQ05(api,account,{realName,username,phone,betaContactConsent:$('consent').checked}),'회원 정보 등록');
   status('회원가입 완료. 홈페이지로 이동합니다.');
  }else{
   status('로그인 중...');account=(await signInWithEmailAndPassword(auth,email,password)).user;
   const profile=await boundedQ05(getDocFromServer(doc(db,'users',account.uid)),'회원 정보 확인',15000);
   if(auth.currentUser?.uid!==account.uid)throw Error('로그인 계정이 변경되었습니다.');
   if(!profile.exists()){location.replace('./signup.html'+location.search);return}
   status('로그인 완료. 홈페이지로 이동합니다.');
  }
  location.replace(destination());
 }catch(e){
  window.ElevosDiagnosticsQ10?.record(join?'signup':'auth',e);
  if(account&&auth.currentUser?.uid===account.uid)await signOut(auth).catch(()=>{});
  status(({'auth/invalid-credential':'이메일 또는 비밀번호를 확인하세요.','auth/email-already-in-use':'이미 가입된 이메일입니다.','auth/network-request-failed':'인터넷 연결을 확인하고 다시 시도해 주세요.','auth/too-many-requests':'요청이 많습니다. 잠시 후 다시 시도해 주세요.','permission-denied':'회원 등록 권한을 확인하세요. 관리자에게 문의해 주세요.'})[e.code]||(e.code?'처리 실패. 연결 및 입력 정보를 확인하세요.':e.message||'다시 시도해 주세요.'));
 }finally{busy=false;enableQ05();$('password').value='';if($('confirm'))$('confirm').value=''}
};
if($('reset'))$('reset').onclick=async()=>{if(busy||resetBusy)return;const email=$('email').value.trim();if(!$('email').checkValidity()){status('가입 이메일을 입력하세요.');return}resetBusy=true;$('reset').disabled=true;try{await sendPasswordResetEmail(auth,email);status('비밀번호 재설정 이메일 발송을 요청했습니다.')}catch{status('재설정 요청을 처리하지 못했습니다. 이메일을 확인하세요.')}finally{resetBusy=false;$('reset').disabled=busy}};

{const statusNode=$('auth-status'),button=document.createElement('button');button.type='button';button.textContent='오류 진단 파일 내보내기';button.style.cssText='background:transparent;border:0;padding:8px 0;color:inherit;text-decoration:underline;font-size:13px';button.onclick=()=>window.ElevosDiagnosticsQ10?.download();statusNode?.after(button)}
