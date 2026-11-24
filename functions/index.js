const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {createHash}=require("node:crypto");
initializeApp();
const db=getFirestore(),auth=getAuth();
const opts={region:"asia-northeast3",maxInstances:3,timeoutSeconds:30,cors:["https://jyhome1228-cyber.github.io"]};
const normalize=v=>typeof v==="string"?v.trim().toLowerCase():"";
const usernameOf=v=>{const s=normalize(v);if(!/^[a-z0-9]{4,20}$/.test(s))throw new HttpsError("invalid-argument","아이디는 영문·숫자 4~20자입니다.");return s};
async function throttle(req,action,limit){const ip=req.rawRequest.ip||"unknown",key=createHash("sha256").update(action+":"+ip).digest("hex"),ref=db.collection("authThrottle").doc(key),now=Date.now();await db.runTransaction(async tx=>{const doc=await tx.get(ref),v=doc.data()||{},start=Number(v.start)||0,count=now-start<60000?Number(v.count)||0:0;if(count>=limit)throw new HttpsError("resource-exhausted","잠시 후 다시 시도해 주세요.");tx.set(ref,{start:now-start<60000?start:now,count:count+1,expiresAt:new Date(now+120000)})})}
exports.checkUsername=onCall(opts,async req=>{await throttle(req,"check",12);const username=usernameOf(req.data?.username);return {available:!(await db.collection("usernames").doc(username).get()).exists}});
exports.registerMember=onCall(opts,async req=>{await throttle(req,"register",4);const username=usernameOf(req.data?.username),email=normalize(req.data?.email),phone=typeof req.data?.phone==="string"?req.data.phone.replace(/[\s-]/g,""):"",password=req.data?.password;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!/^01[016789][0-9]{7,8}$/.test(phone)||typeof password!=="string"||password.length<8||password.length>4096)throw new HttpsError("invalid-argument","가입 정보를 확인해 주세요.");const index=db.collection("usernames").doc(username);let account;try{account=await auth.createUser({email,password,displayName:username});const profile=db.collection("users").doc(account.uid);await db.runTransaction(async tx=>{if((await tx.get(index)).exists)throw new HttpsError("already-exists","이미 사용 중인 아이디입니다.");tx.create(index,{uid:account.uid,createdAt:FieldValue.serverTimestamp()});tx.create(profile,{username,email,phone,createdAt:FieldValue.serverTimestamp()})});return {ok:true}}catch(e){if(account){const linked=await index.get().catch(()=>null);if(linked&&!linked.exists||linked&&linked.data()?.uid!==account.uid)await auth.deleteUser(account.uid).catch(()=>{});}if(e instanceof HttpsError)throw e;if(e.code==="auth/email-already-exists")throw new HttpsError("already-exists","이미 가입된 이메일입니다.");throw new HttpsError("internal","회원가입을 완료하지 못했습니다.")}});
exports.loginMember=onCall(opts,async req=>{await throttle(req,"login",10);const username=usernameOf(req.data?.username),password=req.data?.password;if(typeof password!=="string"||password.length<8||password.length>4096)throw new HttpsError("unauthenticated","아이디 또는 비밀번호를 확인해 주세요.");const failure=()=>new HttpsError("unauthenticated","아이디 또는 비밀번호를 확인해 주세요.");const index=await db.collection("usernames").doc(username).get();if(!index.exists)throw failure();const uid=index.data().uid,account=await auth.getUser(uid).catch(()=>null);if(!account||account.disabled||!account.email)throw failure();const key=process.env.FIREBASE_WEB_API_KEY;if(!key)throw new HttpsError("failed-precondition","인증 서버 설정이 필요합니다.");const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password,returnSecureToken:true}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw failure();const verified=await response.json();if(verified.localId!==uid||!verified.idToken)throw failure();return {token:await auth.createCustomToken(uid)}});

 // Read-only administrative directory. Custom claims are assigned only by a trusted operator.
exports.adminListMembers=onCall(opts,async req=>{
  if(!req.auth)throw new HttpsError("unauthenticated","관리자 로그인이 필요합니다.");
  const operator=await auth.getUser(req.auth.uid);
  if(operator.disabled||operator.customClaims?.admin!==true)throw new HttpsError("permission-denied","관리자 권한이 필요합니다.");
  const cursor=req.data?.pageToken;
  if(cursor!==undefined&&cursor!==null&&(typeof cursor!=="string"||cursor.length>4096))throw new HttpsError("invalid-argument","잘못된 페이지입니다.");
  const result=await auth.listUsers(100,cursor||undefined);
  return {members:result.users.map(u=>({uid:u.uid,email:u.email||"",name:u.displayName||"",createdAt:u.metadata.creationTime||"",lastSignInAt:u.metadata.lastSignInTime||"",disabled:u.disabled,emailVerified:u.emailVerified})),nextPageToken:result.pageToken||null};
});
