/* ELEVOS Q10: local, allowlisted diagnostics. No raw error messages, URLs, account identifiers or game data. */
(function(){
'use strict';
const EVENTS=['runtime','promise','asset','auth','signup','coach-check','coach-claim','local-save','cloud-save','cloud-conflict','logout','restore','backup','summary','offline','online'];
const CODES=['unknown','timeout','network','quota','permission-denied','unauthenticated','unavailable','deadline-exceeded','aborted','resource-exhausted','invalid-argument','failed-precondition','not-found','auth/invalid-credential','auth/email-already-in-use','auth/network-request-failed','auth/too-many-requests','auth/weak-password','auth/invalid-email','auth/wrong-password','auth/user-not-found','conflict','temporary','connected','disconnected'];
const PAGES=['game','login','signup','home','other'];
function safeCodeQ10(error){const raw=typeof error==='string'?error:error?.code;const code=String(raw||'').replace(/^firestore\//,'');if(CODES.includes(code))return code;if(error?.name==='QuotaExceededError')return 'quota';const msg=typeof error?.message==='string'?error.message:'';if(/시간 초과|응답이 지연|deadline|timed? out/i.test(msg))return 'timeout';if(/다른 기기의 저장/.test(msg))return 'conflict';if(/네트워크|network|offline/i.test(msg))return 'network';return 'unknown'}
function cleanRowQ10(row){if(!row||!EVENTS.includes(row.event)||!CODES.includes(row.code)||!PAGES.includes(row.page)||!Number.isFinite(row.at)||row.at<0||row.at>8640000000000000||!['online','offline','unknown'].includes(row.connection))return null;return {at:row.at,event:row.event,code:row.code,page:row.page,connection:row.connection,count:Math.min(9999,Math.max(1,Math.floor(Number(row.count)||1)))}}
function addRowQ10(rows,row,now){const clean=cleanRowQ10(row);if(!clean)return rows;const list=rows.map(cleanRowQ10).filter(x=>x&&x.at>=now-7*86400000&&x.at<=now+60000).slice(-200);const last=list.at(-1);if(last&&last.event===clean.event&&last.code===clean.code&&last.page===clean.page&&last.connection===clean.connection&&clean.at-last.at>=0&&clean.at-last.at<=5000){last.at=clean.at;last.count=Math.min(9999,last.count+1)}else list.push(clean);return list.slice(-200)}

const KEY='elevos-diagnostics-q10';let memory=[];
function getRows(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(raw))return raw.slice(-200).map(cleanRowQ10).filter(Boolean)}catch{}return memory.slice()}
function page(){const path=location.pathname.split('/').pop();return path==='login.html'?'login':path==='signup.html'?'signup':path==='home.html'?'home':!path||path==='index.html'?'game':'other'}
function record(event,error){try{if(!EVENTS.includes(event))return;const now=Date.now(),row={at:now,event,code:safeCodeQ10(error),page:page(),connection:typeof navigator.onLine==='boolean'?(navigator.onLine?'online':'offline'):'unknown',count:1};memory=addRowQ10(getRows(),row,now);try{localStorage.setItem(KEY,JSON.stringify(memory))}catch{}}catch{}}
function report(){const now=Date.now();return {format:'ELEVOS_DIAGNOSTICS_Q10',version:1,entries:getRows().filter(x=>x.at>=now-7*86400000&&x.at<=now+60000)}}
function download(){const blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='elevos-diagnostics-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
window.ElevosDiagnosticsQ10={record,download};
window.addEventListener('error',e=>{if(e.target&&e.target!==window){if(['SCRIPT','LINK'].includes(e.target.tagName))record('asset','unknown');return}record('runtime',e.error)},true);
window.addEventListener('unhandledrejection',e=>record('promise',e.reason));
window.addEventListener('offline',()=>record('offline','disconnected'));
window.addEventListener('online',()=>record('online','connected'));
window.addEventListener('elevos-save-status',e=>{if(e.detail==='failed')record('cloud-save','unknown');else if(e.detail==='conflict')record('cloud-conflict','conflict');else if(e.detail==='temporary')record('local-save','temporary');else if(e.detail==='localfailed')record('local-save','unknown')});
})();
