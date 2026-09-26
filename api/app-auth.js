import { db, admin } from "./_hatchable.js";
export const access = "public";
export const methods = ["GET","POST","PUT"];

const enc=new TextEncoder();
function b64u(buf){let s="";for(const b of new Uint8Array(buf))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
async function randomB64(n=32){const a=new Uint8Array(n);crypto.getRandomValues(a);return b64u(a)}
async function sha256(s){return b64u(await crypto.subtle.digest("SHA-256",enc.encode(s)))}
async function hashPassword(password,salt){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromB64(salt),iterations:210000,hash:"SHA-256"},key,256);return b64u(bits)}
async function verifyPassword(password,salt,hash){return (await hashPassword(password,salt))===hash}
function cookies(req){const h=req.headers?.cookie||"";return Object.fromEntries(h.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function setSessionCookie(res,token,maxAge=604800){res.setHeader("set-cookie",`campus_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`)}
function clearSessionCookie(res){res.setHeader("set-cookie","campus_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax")}

async function sessionUser(req){
 const token=cookies(req).campus_session;if(!token)return null;
 const h=await sha256(token);
 await db.load();
 const s = db.data.campus_sessions.find(x => x.token_hash === h && new Date(x.expires_at) > new Date());
 if(!s) return null;
 const p = db.data.profiles.find(x => x.id === s.profile_id && x.account_status === 'Approved');
 if(!p) return null;
 return { id: p.id, email: p.email, name: p.name, role: p.role, register_number: p.register_number, department: p.department, account_status: p.account_status, expires_at: s.expires_at };
}

function cleanPassword(p){return typeof p==="string"&&p.length>=8&&p.length<=128}
function cleanReg(r){return String(r||"").trim().toUpperCase()}

async function makeSession(res,profileId){
 const token=await randomB64(32),hash=await sha256(token);
 await db.load();
 db.data.campus_sessions = db.data.campus_sessions.filter(x => new Date(x.expires_at) > new Date());
 const exp = new Date();
 exp.setDate(exp.getDate() + 7);
 db.data.campus_sessions.push({ id: crypto.randomUUID(), profile_id: profileId, token_hash: hash, expires_at: exp.toISOString() });
 await db.save();
 setSessionCookie(res,token);
 return token;
}

async function profileById(id){
 await db.load();
 const p = db.data.profiles.find(x => x.id === id);
 return p ? { id: p.id, email: p.email, name: p.name, role: p.role, register_number: p.register_number, department: p.department, account_status: p.account_status } : null;
}

export default async function(req,res){
 await db.load();
 const action=String(req.query?.action||"me");
 if(req.method==="POST"&&action==="register"){
  const b=req.body||{}, reg=cleanReg(b.register_number), password=b.password;
  if(!reg||!cleanPassword(password))return res.status(400).json({error:"Enter a valid register number and a password of at least 8 characters."});
  const d = db.data.student_directory.find(x => x.register_number.toUpperCase() === reg);
  if(!d)return res.status(404).json({error:"Register number is not in the student database."});
  const exists = db.data.profiles.find(x => x.register_number && x.register_number.toUpperCase() === reg);
  if(exists)return res.status(409).json({error:exists.account_status==="Rejected"?"This registration was rejected. Contact the administrator.":"This register number is already registered or awaiting approval."});
  const salt=await randomB64(16),hash=await hashPassword(password,salt),id=crypto.randomUUID();
  const email=String(b.email||"").trim().toLowerCase()||null;
  const newProfile = {id,email,name:d.name,role:'student',register_number:reg,department:d.department,account_status:'Pending',password_salt:salt,password_hash:hash,created_at:new Date().toISOString()};
  db.data.profiles.push(newProfile);
  await db.save();
  return res.status(201).json({message:"Registration submitted. Wait for admin approval before logging in.",profile:{id,register_number:reg,name:d.name,department:d.department,account_status:'Pending'}});
 }
 if(req.method==="POST"&&action==="login"){
  const b=req.body||{},identifier=String(b.identifier??b.register_number??"").trim(),reg=cleanReg(identifier),password=b.password;
  if(!identifier||!password)return res.status(400).json({error:"Login ID, Register Number, or Email and password are required."});
  const p = db.data.profiles.find(x => (x.register_number && x.register_number.toUpperCase() === reg) || (x.email && x.email.toLowerCase() === identifier.toLowerCase()));
  if(!p)return res.status(401).json({error:"Invalid register number or password."});
  if(p.account_status!=="Approved")return res.status(403).json({error:p.account_status==="Pending"?"Your registration is waiting for admin approval.":"Your registration is not approved."});
  if(!p.password_hash||!(await verifyPassword(password,p.password_salt,p.password_hash)))return res.status(401).json({error:"Invalid register number or password."});
  const out=await profileById(p.id);await makeSession(res,p.id);return res.json({profile:out});
 }
 if(req.method==="POST"&&action==="logout"){
  const token=cookies(req).campus_session;
  if(token){
   const h = await sha256(token);
   db.data.campus_sessions = db.data.campus_sessions.filter(x => x.token_hash !== h);
   await db.save();
  }
  clearSessionCookie(res);return res.json({ok:true})
 }
 if(req.method==="POST"&&action==="provision"){
  if(!(await admin.check(req)))return res.status(403).json({error:"Owner access required."});
  const b=req.body||{},role=b.role==="staff"?"staff":"admin",name=String(b.name||"").trim(),reg=cleanReg(b.register_number),password=b.password,email=String(b.email||"").trim().toLowerCase()||null;
  if(!name||!cleanPassword(password))return res.status(400).json({error:"Name and password (8+ characters) are required."});
  if(role==="admin"&&!reg)return res.status(400).json({error:"Admin register/login ID is required."});
  const key=reg||email;
  const exists=db.data.profiles.find(x => (x.register_number && x.register_number.toUpperCase() === reg) || (x.email && x.email.toLowerCase() === email?.toLowerCase()));
  if(exists)return res.status(409).json({error:"An account with this login ID already exists."});
  const salt=await randomB64(16),hash=await hashPassword(password,salt),id=crypto.randomUUID();
  const newProfile = {id,email,name,role,register_number:reg,department:b.department||null,account_status:'Approved',password_salt:salt,password_hash:hash,created_at:new Date().toISOString()};
  db.data.profiles.push(newProfile);
  await db.save();
  return res.status(201).json({message:`${role} account created.`,profile:{id,name,role,register_number:reg,email,account_status:'Approved'}});
 }
 const u=await sessionUser(req);
 if(action==="me")return res.json({profile:u});
 if(!u)return res.status(401).json({error:"Please log in."});
 if(action==="users"&&u.role==="admin"){
  const r = db.data.profiles.filter(x => ['student','staff','admin'].includes(x.role)).map(x => ({id:x.id,name:x.name,role:x.role,register_number:x.register_number,email:x.email,department:x.department,account_status:x.account_status,created_at:x.created_at})).sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name));
  return res.json(r);
 }
 if(action==="pending"&&u.role==="admin"){
  const r = db.data.profiles.filter(x => x.role === 'student' && x.account_status === 'Pending').map(x => ({id:x.id,name:x.name,register_number:x.register_number,department:x.department,account_status:x.account_status,created_at:x.created_at})).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  return res.json(r);
 }
 if(action==="manage"&&req.method==="PUT"&&u.role==="admin"){
  const b=req.body||{},op=String(b.operation||"");
  if(op==="remove"){
   const id=String(b.id||"");
   if(!id)return res.status(400).json({error:"Account ID is required."});
   const target = db.data.profiles.find(x => x.id === id);
   if(!target)return res.status(404).json({error:"Account not found."});
   if(target.role==="admin")return res.status(400).json({error:"Admin accounts cannot be removed here."});
   db.data.profiles = db.data.profiles.filter(x => x.id !== id);
   await db.save();
   return res.json({message:"Account removed.",id});
  }
  if(op==="add"){
   const role=b.role==="admin"?"admin":b.role==="staff"?"staff":"student",name=String(b.name||"").trim(),reg=cleanReg(b.register_number),email=String(b.email||"").trim().toLowerCase()||null,password=b.password;
   const department=String(b.department||"").trim()||"Information Technology";
   if(!name||!cleanPassword(password))return res.status(400).json({error:"Name and password (8+ characters) are required."});
   if(!reg)return res.status(400).json({error:role==="student"?"Student register number is required.":role==="admin"?"Admin login ID is required.":"Staff login ID is required."});
   const exists = db.data.profiles.find(x => (x.register_number && x.register_number.toUpperCase() === reg) || (x.email && x.email.toLowerCase() === email?.toLowerCase()));
   if(exists)return res.status(409).json({error:"An account with this login ID or email already exists."});
   if(role==="student"){
    const year=String(b.year||"").trim()||"Not specified",semester=String(b.semester||"").trim()||"Not specified",batch=String(b.batch||"").trim()||"Not specified";
    const existingStd = db.data.student_directory.find(x => x.register_number === reg);
    if(existingStd){
     Object.assign(existingStd, {name,department,year,semester,batch,academic_year:String(b.academic_year||"2026-2027").trim()});
    }else{
     db.data.student_directory.push({register_number:reg,name,year,semester,batch,department,academic_year:String(b.academic_year||"2026-2027").trim()});
    }
   }
   const salt=await randomB64(16),hash=await hashPassword(password,salt),id=crypto.randomUUID();
   const newProfile = {id,email,name,role,register_number:reg,department,account_status:'Approved',password_salt:salt,password_hash:hash,created_at:new Date().toISOString()};
   db.data.profiles.push(newProfile);
   await db.save();
   return res.status(201).json({message:`${role} account added.`,profile:{id,name,role,register_number:reg,email,department,account_status:'Approved'}});
  }
  return res.status(400).json({error:"Unsupported management operation."});
 }
 if(action==="decision"&&req.method==="PUT"&&u.role==="admin"){
  const b=req.body||{},id=String(b.id||""),status=b.status==="Approved"?"Approved":"Rejected";
  const p = db.data.profiles.find(x => x.id === id && x.role === 'student' && x.account_status === 'Pending');
  if(!p)return res.status(404).json({error:"Pending registration not found."});
  p.account_status = status;
  await db.save();
  return res.json({id:p.id,name:p.name,register_number:p.register_number,department:p.department,account_status:p.account_status});
 }
 return res.status(400).json({error:"Unsupported action."});
}