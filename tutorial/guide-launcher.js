/* Call after authenticated career load. No automatic auth detection or game writes. */
(function(){
'use strict';
const version=1;let active=null,pending=false;
const key=uid=>'elevos:manager-guide:v'+version+':'+uid;
function localRead(uid){try{return JSON.parse(localStorage.getItem(key(uid))||'null')}catch{return null}}
function localWrite(uid,status){try{localStorage.setItem(key(uid),JSON.stringify({status,version,at:Date.now()}))}catch{}}
async function launch({uid,isNew=false,force=false,readStatus,writeStatus}={}){
 if(!uid||typeof uid!=='string'||active||pending)return false;
 pending=true;
 try{
 if(!force){if(!isNew)return false;let saved=localRead(uid);if(!saved&&typeof readStatus==='function'){try{saved=await readStatus(uid,version)}catch{}}if(saved&&['completed','skipped'].includes(saved.status))return false}
 const previous=document.activeElement, modal=document.createElement('dialog'),frame=document.createElement('iframe');
 modal.setAttribute('aria-label','신규 감독 가이드');modal.style.cssText='width:min(1200px,96vw);height:min(820px,94dvh);max-width:96vw;max-height:94dvh;padding:0;border:0;background:#10151d;border-radius:14px;overflow:hidden';
 frame.title='ELEVOS 신규 감독 가이드';frame.style.cssText='width:100%;height:100%;border:0;display:block';frame.src='/tutorial/';modal.append(frame);document.body.append(modal);
 let ended=false;
 function cleanup(status){if(ended)return;ended=true;window.removeEventListener('message',receive);if(modal.open)modal.close();modal.remove();active=null;if(previous&&previous.isConnected)previous.focus();if(['completed','skipped'].includes(status)){localWrite(uid,status);if(typeof writeStatus==='function')Promise.resolve().then(()=>writeStatus(uid,{status,version,at:Date.now()})).catch(()=>{})}}
 function receive(e){if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='elevos-guide-exit'||e.data.version!==version)return;const status=e.data.status;if(['completed','skipped','dismissed'].includes(status))cleanup(status)}
 modal.addEventListener('cancel',e=>{e.preventDefault();cleanup('dismissed')});modal.addEventListener('close',()=>cleanup('dismissed'));window.addEventListener('message',receive);active={close:()=>cleanup('dismissed')};try{modal.showModal()}catch(e){cleanup('dismissed');return false}return true;
 }finally{pending=false}
}
window.ElevosManagerGuide=Object.freeze({launch,close:()=>active?.close()});
})();
