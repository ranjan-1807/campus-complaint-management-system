import { db } from "./_hatchable.js";
export const access = "member";
export const methods = ["GET","POST"];
export default async function(req,res){
 await db.load();
 const u=req.member;
 if(req.method==="POST"){
  const {name,role,register_number,department}=req.body||{};
  if(!name||!role) return res.status(400).json({error:"Name and role are required"});
  const safeRole=["student","staff","admin"].includes(role)?role:"student";
  let finalName=name, finalDepartment=department||null, finalRegister=register_number||null;
  if(safeRole==="student"){
   if(!finalRegister) return res.status(400).json({error:"Student register number is required"});
   const d = db.data.student_directory.find(x => x.register_number === finalRegister);
   if(!d) return res.status(404).json({error:"Register number is not in the student database"});
   finalName=d.name; finalDepartment=d.department;
  }
  let p = db.data.profiles.find(x => x.id === u.id);
  if(!p){
   p = {id:u.id, email:u.email, name:finalName, role:safeRole, register_number:finalRegister, department:finalDepartment, account_status:'Approved'};
   db.data.profiles.push(p);
  } else {
   p.email = u.email;
   p.name = finalName;
   p.role = safeRole;
   p.register_number = finalRegister;
   p.department = finalDepartment;
  }
  await db.save();
  return res.json({id:p.id,email:p.email,name:p.name,role:p.role,register_number:p.register_number,department:p.department});
 }
 const p = db.data.profiles.find(x => x.id === u.id);
 res.json(p ? {id:p.id,email:p.email,name:p.name,role:p.role,register_number:p.register_number,department:p.department} : null);
}