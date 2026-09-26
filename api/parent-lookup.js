import { db } from "./_hatchable.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){
 await db.load();
 const reg=String(req.query.register_number||"").trim();
 if(!reg)return res.status(400).json({error:"Register number is required"});
 const complaints = db.data.complaints.filter(x => x.student_register === reg).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const student = db.data.student_directory.find(x => x.register_number === reg) || null;
 res.json({student, complaints});
}