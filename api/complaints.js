import { db } from "./_hatchable.js";
export const access = "public";
export const methods = ["GET","POST","PUT"];
function cookies(req){const h=req.headers?.cookie||"";return Object.fromEntries(h.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
async function sha256(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));let x="";for(const v of new Uint8Array(b))x+=String.fromCharCode(v);return btoa(x).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}

async function current(req){
 const t=cookies(req).campus_session;if(!t)return null;
 const h=await sha256(t);
 await db.load();
 const s = db.data.campus_sessions.find(x => x.token_hash === h && new Date(x.expires_at) > new Date());
 if(!s) return null;
 const p = db.data.profiles.find(x => x.id === s.profile_id && x.account_status === 'Approved');
 return p ? {id:p.id,name:p.name,role:p.role,register_number:p.register_number,department:p.department} : null;
}

export default async function(req,res){
 await db.load();
 const p=await current(req);if(!p)return res.status(401).json({error:"Please log in."});
 if(req.method==="POST"){
  const b=req.body||{},title=String(b.title||"").trim(),description=String(b.description||"").trim();
  if(!title||!description)return res.status(400).json({error:"Title and description are required"});
  let targetType=b.target_type||"student",targetName=b.target_name||null,targetId=b.target_id||null,studentRegister=b.student_register||null,studentName=null;
  if(p.role==="student"){
   if(!["staff","student"].includes(targetType))return res.status(400).json({error:"Students can complain about staff or other students"});
   if(targetType==="student"){
    const lookup=(studentRegister||targetId||targetName||"").toLowerCase();
    const x=db.data.student_directory.find(d => d.register_number.toLowerCase() === lookup || d.name.toLowerCase() === lookup);
    if(!x)return res.status(404).json({error:"Student not found in the student database"});
    studentRegister=x.register_number;targetName=targetName||x.name;studentName=x.name;
   }else{studentRegister=p.register_number;studentName=p.name}
   const newComplaint = {id:crypto.randomUUID(),student_register:p.register_number,student_name:p.name,title,description,category:b.category||"General",severity:b.severity||"Medium",created_by:p.id,created_by_name:p.name,target_type:targetType,target_name:targetName,target_id:targetId,status:'Open',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   db.data.complaints.push(newComplaint);
   await db.save();
   return res.json(newComplaint);
  }
  if(!["staff","admin"].includes(p.role))return res.status(403).json({error:"Only staff/admin can create this type of complaint"});
  if(!b.student_register)return res.status(400).json({error:"Student register number is required"});
  const sr=db.data.student_directory.find(x => x.register_number === b.student_register);
  if(!sr)return res.status(404).json({error:"Student register number not found"});
  const newComplaint = {id:crypto.randomUUID(),student_register:b.student_register,student_name:sr.name,title,description,category:b.category||"General",severity:b.severity||"Medium",created_by:p.id,created_by_name:p.name,target_type:'student',target_name:sr.name,target_id:null,status:'Open',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  db.data.complaints.push(newComplaint);
  await db.save();
  return res.json(newComplaint);
 }
 if(req.method==="PUT"){
  if(p.role!=="admin"&&p.role!=="staff")return res.status(403).json({error:"Only staff or admin can update complaints"});
  const {id,status,rejection_reason}=req.body||{};if(!id||!status)return res.status(400).json({error:"id and status required"});
  if(status==="Rejected"&&!String(rejection_reason||"").trim())return res.status(400).json({error:"Rejection reason is required"});
  if(p.role==="staff"){
   const own=db.data.complaints.find(x => x.id === id && x.created_by === p.id);
   if(!own)return res.status(403).json({error:"You can only update your own complaints"});
  }
  const complaint = db.data.complaints.find(x => x.id === id);
  if(!complaint)return res.status(404).json({error:"Complaint not found"});
  complaint.status = status;
  complaint.rejection_reason = status==="Rejected"?String(rejection_reason).trim():null;
  complaint.updated_at = new Date().toISOString();
  await db.save();
  return res.json(complaint);
 }
 if(p.role==="student"){
  const r = db.data.complaints.filter(x => x.student_register === (p.register_number||"")).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return res.json(r);
 }
 if(req.query?.id){
  const complaint = db.data.complaints.find(x => x.id === req.query.id);
  if(!complaint)return res.status(404).json({error:"Complaint not found"});
  if(p.role==="staff"&&complaint.created_by!==p.id)return res.status(403).json({error:"You can only view your own complaints"});
  if(p.role==="admin"&&complaint.status==="Open"){
   complaint.status = 'In Review';
   complaint.updated_at = new Date().toISOString();
   await db.save();
   return res.json(complaint);
  }
  return res.json(complaint);
 }
 if(p.role==="staff"){
  const r = db.data.complaints.filter(x => x.created_by === p.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return res.json(r);
 }
 const r = [...db.data.complaints].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 res.json(r);
}