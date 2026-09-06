require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'db.json');
const LEGACY_BOT_URL = String(process.env.LEGACY_BOT_URL || '').trim();
const LEGACY_API_KEY = String(process.env.LEGACY_API_KEY || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')).trim();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_WEBHOOK_URL = String(process.env.TELEGRAM_WEBHOOK_URL || '').trim();
const PROVIDER_API_URL = String(process.env.PROVIDER_API_URL || '').trim();
const PROVIDER_API_KEY = String(process.env.PROVIDER_API_KEY || '').trim();

if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set. Login will return a configuration error.');

const emptyState = () => ({
  version: 1, updatedAt: new Date().toISOString(),
  appData: {users:[],orders:[],payments:[],services:[],tickets:[],trash:[],apiLogs:[],referrals:[],messages:[],profits:[]},
  activityLog: [], broadcastHistory: [], backupHistory: [], blacklist: [], whitelist: [], faqs: [], campaigns: [],
  settings: {}, auth: { passwordHash: null, passwordSalt: null }, uiOverrides: {}
});
function loadDb(){
  try { if(!fs.existsSync(DB_FILE)){const d=emptyState();fs.writeFileSync(DB_FILE,JSON.stringify(d,null,2));return d;} const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); return {...emptyState(),...d,appData:{...emptyState().appData,...(d.appData||{})},settings:d.settings||{},auth:d.auth||emptyState().auth,uiOverrides:d.uiOverrides||{}}; }
  catch(e){ console.error('DB load failed:',e); return emptyState(); }
}
let db=loadDb();
let writeChain=Promise.resolve();
function persist(){
  db.updatedAt=new Date().toISOString();
  const tmp=DB_FILE+'.tmp'; const data=JSON.stringify(db,null,2);
  writeChain=writeChain.then(async()=>{await fs.promises.writeFile(tmp,data,'utf8');await fs.promises.rename(tmp,DB_FILE);}).catch(e=>console.error('DB write failed:',e));
  return writeChain;
}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')};}
function validPassword(password){
  if(db.auth?.passwordHash && db.auth?.passwordSalt){try{return crypto.timingSafeEqual(Buffer.from(db.auth.passwordHash,'hex'),Buffer.from(hashPassword(password,db.auth.passwordSalt).hash,'hex'));}catch(_){return false;}}
  return ADMIN_PASSWORD && password===ADMIN_PASSWORD;
}
function signSession(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');return body+'.'+sig;}
function verifySession(token){try{const [body,sig]=String(token||'').split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!p.exp||p.exp<Date.now())return null;return p;}catch(_){return null;}}
function setCookie(res,token,maxAge=8*60*60*1000){res.setHeader('Set-Cookie',`bihari_admin=${token}; Max-Age=${Math.floor(maxAge/1000)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV==='production'?' ; Secure':''}`);}
function clearCookie(res){res.setHeader('Set-Cookie','bihari_admin=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');}
function cookies(req){const out={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
function auth(req,res,next){const s=verifySession(cookies(req).bihari_admin);if(!s)return res.status(401).json({success:false,error:'Unauthorized'});req.admin=s;next();}

app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'","https://cdnjs.cloudflare.com"],styleSrc:["'self'","'unsafe-inline'","https://cdnjs.cloudflare.com","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com","https://cdnjs.cloudflare.com"],imgSrc:["'self'","data:","blob:","https:"],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"]}}}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
const loginLimiter=rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{success:false,error:'Too many login attempts. Try again later.'}});

app.get('/api/health',(req,res)=>res.json({success:true,status:'ok',server_ok:true,time:new Date().toISOString(),legacy_configured:!!LEGACY_BOT_URL}));
app.get('/api', (req,res,next)=>{if(req.query.action==='session')return res.json({success:true,authenticated:!!verifySession(cookies(req).bihari_admin)});next();});
app.post('/api', (req,res,next)=>{if(req.query.action==='login')return next();next();});
app.post('/api/auth/login',loginLimiter,(req,res)=>loginHandler(req,res));
app.post('/api',loginLimiter,(req,res,next)=>{if(req.query.action==='login')return loginHandler(req,res);next();});
function loginHandler(req,res){const password=String(req.body.password||'');if(!ADMIN_PASSWORD && !db.auth?.passwordHash)return res.status(503).json({success:false,error:'ADMIN_PASSWORD is not configured on the server.'});if(!validPassword(password))return res.status(401).json({success:false,error:'Invalid password'});const token=signSession({sub:'admin',iat:Date.now(),exp:Date.now()+8*60*60*1000});setCookie(res,token);res.json({success:true,message:'Login successful'});}
app.post('/api/logout',(req,res)=>{clearCookie(res);res.json({success:true});});

function getAction(req){return String(req.query.action||req.body.action||'').trim();}
function legacyHeaders(){return {'Accept':'application/json','X-API-Key':LEGACY_API_KEY};}
function legacyParams(req){const p=new URLSearchParams();for(const [k,v] of Object.entries(req.method==='GET'?req.query:req.body)){if(k==='action'||k==='api_key')continue;if(v===undefined||v===null)continue;p.set(k,typeof v==='object'?JSON.stringify(v):String(v));}p.set('action',getAction(req));if(LEGACY_API_KEY)p.set('api_key',LEGACY_API_KEY);return p;}
async function proxyLegacy(req,res){
  if(!LEGACY_BOT_URL) return null;
  const method=req.method==='GET'?'GET':'POST';
  const url=new URL(LEGACY_BOT_URL);
  const body=legacyParams(req);
  if(method==='GET') for(const [k,v] of body) url.searchParams.set(k,v);
  const opts={method,headers:legacyHeaders()}; if(method==='POST'){opts.headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';opts.body=body.toString();}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Number(process.env.LEGACY_TIMEOUT_MS||12000));
  try{const r=await fetch(url,{...opts,signal:controller.signal});const text=await r.text();let data;try{data=text?JSON.parse(text):{};}catch(_){data={success:false,error:'Legacy backend returned non-JSON response'};}if(!r.ok)data.success=false;return data;}catch(e){return {success:false,error:e.name==='AbortError'?'Legacy backend timeout':e.message};}finally{clearTimeout(timer);}
}
function mergeLocalData(data){
  const d={...data}; const a=db.appData||{};
  d.users=Array.isArray(d.users)?d.users:[];d.orders=Array.isArray(d.orders)?d.orders:[];d.payments=Array.isArray(d.payments)?d.payments:[];d.services=Array.isArray(d.services)?d.services:[];d.tickets=Array.isArray(d.tickets)?d.tickets:[];d.messages=Array.isArray(d.messages)?d.messages:[];d.apiLogs=Array.isArray(d.apiLogs)?d.apiLogs:[];d.referrals=Array.isArray(d.referrals)?d.referrals:[];d.profits=Array.isArray(d.profits)?d.profits:[];d.trash=Array.isArray(d.trash)?d.trash:[];
  const ov=db.uiOverrides||{};
  if(ov.blacklist && Array.isArray(db.blacklist)) d.blacklist=db.blacklist;
  if(ov.whitelist && Array.isArray(db.whitelist)) d.whitelist=db.whitelist;
  if(ov.faqs && Array.isArray(db.faqs)) d.faqs=db.faqs;
  if(ov.campaigns && Array.isArray(db.campaigns)) d.campaigns=db.campaigns;
  if(ov.activityLog && Array.isArray(db.activityLog)) d.activity=db.activityLog;
  if(ov.broadcastHistory && Array.isArray(db.broadcastHistory)) d.broadcastHistory=db.broadcastHistory;
  if(ov.backupHistory && Array.isArray(db.backupHistory)) d.backups=db.backupHistory;
  if(db.settings && Object.keys(db.settings).length) d.settings={...(d.settings||{}),...db.settings};
  return d;
}

app.all('/api',(req,res)=>{const action=getAction(req);if(!action)return res.status(400).json({success:false,error:'Missing action'});if(action==='login')return loginHandler(req,res);if(action==='session')return res.json({success:true,authenticated:!!verifySession(cookies(req).bihari_admin)});const s=verifySession(cookies(req).bihari_admin);if(!s)return res.status(401).json({success:false,error:'Unauthorized'});handleAction(req,res,action).catch(e=>{console.error(action,e);res.status(500).json({success:false,error:e.message||'Server error'});});});

async function handleAction(req,res,action){
  if(action==='saveState'){
    let state=req.body.state; if(typeof state==='string'){try{state=JSON.parse(state)}catch(_){return res.status(400).json({success:false,error:'Invalid state JSON'})}}
    if(!state||typeof state!=='object')return res.status(400).json({success:false,error:'State required'});
    for(const k of ['appData','activityLog','broadcastHistory','backupHistory','blacklist','whitelist','faqs','campaigns']) if(state[k]!==undefined) db[k]=state[k];
    db.uiOverrides={...(db.uiOverrides||{}),activityLog:true,broadcastHistory:true,backupHistory:true,blacklist:true,whitelist:true,faqs:true,campaigns:true};
    await persist(); return res.json({success:true,message:'State persisted'});
  }
  if(action==='getData'){
    const legacy=await proxyLegacy(req,res);
    if(legacy?.success && legacy.data) return res.json({success:true,data:mergeLocalData(legacy.data),source:'legacy'});
    const d={...db.appData,blacklist:db.blacklist,whitelist:db.whitelist,faqs:db.faqs,campaigns:db.campaigns,activity:db.activityLog,broadcastHistory:db.broadcastHistory,backups:db.backupHistory,settings:db.settings};
    return res.json({success:true,data:d,source:'local',warning:legacy?.error||'Legacy backend unavailable'});
  }
  // Settings are kept locally too, so they survive legacy outages. Password is never returned.
  if(action==='updateSetting'){
    const key=String(req.body.key||'').trim();const value=req.body.value??'';if(!key)return res.status(400).json({success:false,error:'Key required'});
    if(key==='admin_password'){const p=String(value);if(p.length<8)return res.status(400).json({success:false,error:'Password must be at least 8 characters'});const h=hashPassword(p);db.auth={passwordHash:h.hash,passwordSalt:h.salt};delete db.settings.admin_password;await persist();
      if(LEGACY_BOT_URL){const lr=await proxyLegacy(req,res); if(lr?.success)return res.json(lr);}
      return res.json({success:true,message:'Admin password updated securely'});
    }
    db.settings[key]=value;await persist();
    const lr=await proxyLegacy(req,res); if(lr?.success)return res.json(lr);return res.json({success:true,message:'Setting saved locally'});
  }
  // When the legacy bot backend is configured, preserve its complete existing logic/data.
  // If it is not configured, use the built-in JSON database so the admin panel is still fully usable.
  if(!LEGACY_BOT_URL){
    if(action==='getDiagnostics'){return diagnostics(res);}
    if(action==='createBackup'){return createBackup(res);}
    const local=await localAction(req,res,action); if(local!==null) return res.json(local);
  }
  const forwarded=await proxyLegacy(req,res);
  if(forwarded && (forwarded.success || action!=='botStatus')){
    if(action==='getData'&&forwarded.data) forwarded.data=mergeLocalData(forwarded.data);
    return res.status(forwarded.success===false && forwarded.error?.startsWith('Unauthorized')?401:200).json(forwarded);
  }
  if(action==='botStatus') return botStatus(res);
  if(action==='getDiagnostics') return diagnostics(res);
  if(action==='getApiBalance') return apiBalance(res);
  if(action==='sync') return syncProvider(res);
  if(action==='createBackup') return createBackup(res);
  if(action==='logout') {clearCookie(res);return res.json({success:true});}
  return res.json({success:true,message:'Action completed locally'});
}


async function localAction(req,res,action){
  const b=req.body||{}; const now=()=>new Date().toISOString();
  const arr=(k)=>Array.isArray(db.appData[k])?db.appData[k]:(db.appData[k]=[]);
  const idNum=v=>Number(v);
  const findById=(list,id)=>list.find(x=>String(x.id)===String(id));
  if(action==='addActivity'){db.activityLog.unshift({id:Date.now(),user:b.user||'Admin',action:b.action||'',icon:b.icon||'fa-circle',color:b.color||'',time:now()});db.activityLog=db.activityLog.slice(0,200);await persist();return {success:true};}
  if(action==='addUser'){const users=arr('users');const uid=String(b.user_id||'').trim();if(!uid)return {success:false,error:'User ID required'};if(users.some(x=>String(x.user_id)===uid))return {success:false,error:'User already exists'};users.unshift({id:Date.now(),user_id:uid,first_name:b.first_name||'User',last_name:b.last_name||'',username:b.username||'',phone:b.phone||'',balance:Number(b.balance||0),is_vip:Number(b.is_vip||0),is_banned:0,total_orders:0,total_spent:0,referrals:0,join_date:now(),last_active:now()});await persist();return {success:true,message:'User added'};}
  if(action==='updateUser'){const users=arr('users');const u=users.find(x=>String(x.user_id)===String(b.id)||String(x.id)===String(b.id));if(!u)return {success:false,error:'User not found'};const allowed=['first_name','last_name','username','phone','balance','is_vip','is_banned','notes','full_name','city','email'];if(!allowed.includes(String(b.field)))return {success:false,error:'Invalid field'};u[b.field]=['balance','is_vip','is_banned'].includes(b.field)?Number(b.value):b.value;u.last_active=now();await persist();return {success:true,message:'User updated'};}
  if(action==='adjustBalance'){const users=arr('users');const u=users.find(x=>String(x.user_id)===String(b.id));const amount=Number(b.amount);if(!u||!Number.isFinite(amount)||amount<=0)return {success:false,error:'Invalid user or amount'};u.balance=Math.max(0,Number(u.balance||0)+(b.type==='deduct'?-amount:amount));u.last_active=now();await persist();return {success:true,balance:u.balance};}
  if(action==='updateService'){const list=arr('services');const x=findById(list,b.id);if(!x)return {success:false,error:'Service not found'};const allowed=['name','category','api_rate','selling_price','profit_per_1000','min_order','max_order','is_active','description','subcategory'];if(!allowed.includes(String(b.field)))return {success:false,error:'Invalid field'};x[b.field]=['api_rate','selling_price','profit_per_1000'].includes(b.field)?Number(b.value):(['min_order','max_order','is_active'].includes(b.field)?Number(b.value):b.value);if(b.field==='selling_price'&&x.api_rate!==undefined)x.profit_per_1000=Number(x.selling_price)-Number(x.api_rate||0);x.updated_at=now();await persist();return {success:true,message:'Service updated'};}
  if(action==='addService'){const list=arr('services');const name=String(b.name||'').trim();if(!name)return {success:false,error:'Name required'};const x={id:Date.now(),api_service_id:String(b.api_service_id||Date.now()),name,category:b.category||'Others',api_rate:Number(b.api_rate||0),selling_price:Number(b.selling_price||0),profit_per_1000:Number(b.selling_price||0)-Number(b.api_rate||0),min_order:Number(b.min_order||1),max_order:Number(b.max_order||100000),is_active:1,created_at:now(),updated_at:now()};list.push(x);await persist();return {success:true,message:'Service added',id:x.id};}
  if(action==='deleteService'){const list=arr('services');const i=list.findIndex(x=>String(x.id)===String(b.id));if(i<0)return {success:false,error:'Service not found'};const x=list.splice(i,1)[0];db.appData.trash.unshift({id:Date.now(),type:'service',ref_id:x.id,name:x.name,original_data:JSON.stringify(x),deleted_by:'admin',deleted_at:now()});await persist();return {success:true,message:'Service deleted'};}
  if(action==='updateOrderStatus'){const list=arr('orders');const o=findById(list,b.id);if(!o)return {success:false,error:'Order not found'};o.status=b.status;o.completed_at=['completed','cancelled','failed'].includes(b.status)?now():o.completed_at;await persist();return {success:true,message:'Order status updated'};}
  if(action==='approvePayment'||action==='rejectPayment'){const list=arr('payments');const p=findById(list,b.id);if(!p)return {success:false,error:'Payment not found'};p.status=action==='approvePayment'?'approved':'rejected';if(b.reason)p.reject_reason=b.reason;p.updated_at=now();await persist();return {success:true,message:'Payment updated'};}
  if(action==='getProfitSettings')return {success:true,data:Array.isArray(db.appData.profits)?db.appData.profits:[]};
  if(action==='updateProfitSetting'){const list=arr('profits');const category=String(b.category||'').trim();if(!category)return {success:false,error:'Category required'};let x=list.find(z=>z.category===category&&String(z.subcategory||'')===String(b.subcategory||''));if(!x){x={id:Date.now(),category,subcategory:b.subcategory||'',profit_per_1000:Number(b.profit_per_1000||0)};list.push(x);}else x.profit_per_1000=Number(b.profit_per_1000||0);await persist();return {success:true,message:'Profit setting saved'};}
  if(action==='deleteProfitSetting'){const list=arr('profits');db.appData.profits=list.filter(x=>String(x.id)!==String(b.id));await persist();return {success:true};}
  if(action==='broadcast'){db.broadcastHistory.unshift({id:Date.now(),date:new Date().toLocaleString(),channel:b.channel||'telegram',message:String(b.message||'').slice(0,100),recipients:0,status:'Saved'});await persist();return {success:true,message:'Broadcast saved locally'};}
  if(action==='checkOrders')return {success:true,message:'No provider order checker configured'};
  if(action==='syncToGitHub'||action==='restoreFromGitHub')return {success:false,error:'GitHub backup is not configured in this standalone mode'};
  if(action==='set_webhook')return {success:false,error:'Telegram bot token/webhook is not configured'};
  if(action==='getApiBalance')return {success:false,error:'Provider API is not configured'};
  if(action==='getDiagnostics')return null;
  if(action==='createBackup')return null;
  return null;
}

async function telegram(pathname,body){if(!TELEGRAM_BOT_TOKEN)throw new Error('TELEGRAM_BOT_TOKEN not configured');const r=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${pathname}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.description||'Telegram API error');return d;}
async function botStatus(res){
  const out={success:true,server_ok:true,telegram_api_ok:false,telegram_getme_ok:false,webhook_configured:false,webhook_url_matches:true,active_service_count:(db.appData.services||[]).filter(s=>s.is_active).length};
  if(TELEGRAM_BOT_TOKEN){try{const me=await telegram('getMe',{});out.telegram_api_ok=!!me.ok;out.telegram_getme_ok=!!me.ok;const wi=await telegram('getWebhookInfo',{});out.webhook_configured=!!wi.result?.url;out.webhook_url_matches=TELEGRAM_WEBHOOK_URL?wi.result?.url===TELEGRAM_WEBHOOK_URL:true;out.webhook_url=wi.result?.url||'';out.last_webhook_error=wi.result?.last_error_message||'';out.pending_update_count=wi.result?.pending_update_count||0;}catch(e){out.last_error_message=e.message;}}
  res.json(out);
}
async function diagnostics(res){const health={db_ok:true,telegram_getme_ok:false,webhook_url:'',webhook_url_matches:true,pending_update_count:0};if(TELEGRAM_BOT_TOKEN){try{const me=await telegram('getMe',{});health.telegram_getme_ok=!!me.ok;const wi=await telegram('getWebhookInfo',{});health.webhook_url=wi.result?.url||'';health.webhook_url_matches=TELEGRAM_WEBHOOK_URL?health.webhook_url===TELEGRAM_WEBHOOK_URL:true;health.pending_update_count=wi.result?.pending_update_count||0;health.webhook_last_error=wi.result?.last_error_message||'';}catch(e){health.internal_error=e.message;}}res.json({success:true,health,report:JSON.stringify({generated_at:new Date().toISOString(),health},null,2)});}
async function apiBalance(res){if(!PROVIDER_API_URL||!PROVIDER_API_KEY)return res.json({success:false,error:'Provider API is not configured'});try{const p=new URLSearchParams({key:PROVIDER_API_KEY,action:'balance'});const r=await fetch(PROVIDER_API_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p});const d=await r.json();return res.json({success:true,balance:Number(d.balance||0),currency:d.currency||'INR'});}catch(e){res.json({success:false,error:e.message});}}
async function syncProvider(res){if(!PROVIDER_API_URL||!PROVIDER_API_KEY)return res.json({success:false,error:'PROVIDER_API_URL and PROVIDER_API_KEY are required for service sync'});try{const p=new URLSearchParams({key:PROVIDER_API_KEY,action:'services'});const r=await fetch(PROVIDER_API_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:p});const list=await r.json();if(!Array.isArray(list))throw new Error('Provider did not return a service list');const old=db.appData.services||[];const byExt=new Map(old.map(x=>[String(x.api_service_id??x.provider_service_id??x.provider_id??x.service_id??x.external_id??''),x]));db.appData.services=list.map(x=>{const ext=String(x.service||x.service_id||x.id||'');const prev=byExt.get(ext)||{};const apiRate=Number(x.rate||x.api_rate||prev.api_rate||0);const sell=Number(prev.selling_price||apiRate);return {...prev,id:prev.id||Date.now()+Math.floor(Math.random()*100000),api_service_id:ext,name:x.name||prev.name||('Service '+ext),category:x.category||prev.category||'Others',api_rate:apiRate,selling_price:sell,profit_per_1000:sell-apiRate,min_order:Number(x.min||x.min_order||prev.min_order||1),max_order:Number(x.max||x.max_order||prev.max_order||100000),is_active:prev.is_active===0?0:1,provider_raw:x};});await persist();res.json({success:true,message:'Services synced',services:db.appData.services});}catch(e){res.json({success:false,error:e.message});}}
async function createBackup(res){const filename=`bihari-smm-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;const payload={version:1,exported_at:new Date().toISOString(),...db,auth:undefined};const dir=path.join(__dirname,'backups');fs.mkdirSync(dir,{recursive:true});const fp=path.join(dir,filename);fs.writeFileSync(fp,JSON.stringify(payload,null,2));db.backupHistory.unshift({file:filename,size:fs.statSync(fp).size,date:new Date().toLocaleString()});db.backupHistory=db.backupHistory.slice(0,100);await persist();res.json({success:true,filename,size:fs.statSync(fp).size,file:`/backups/${filename}`});}

app.use('/backups',auth,express.static(path.join(__dirname,'backups')));
app.use(express.static(PUBLIC,{extensions:['html']}));
app.get('*',(req,res)=>res.sendFile(path.join(PUBLIC,'index.html')));
app.listen(PORT,HOST,()=>console.log(`Bihari SMM Pro listening on ${HOST}:${PORT}`));
