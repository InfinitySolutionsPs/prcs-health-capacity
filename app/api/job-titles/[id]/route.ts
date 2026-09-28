import{NextResponse}from"next/server";import{getRawDb}from"@/db";import{ensureNormalizedSettings}from"@/db/seed";import{requireRole}from"@/lib/authorization";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!await requireRole(["admin"]))return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  try{
    await ensureNormalizedSettings();
    const id=Number((await params).id),body=await req.json() as Record<string,unknown>,name=String(body.name||"").trim(),categoryCode=String(body.categoryCode||"").trim(),db=getRawDb();
    if(!Number.isInteger(id)||name.length<2)return NextResponse.json({error:"أدخل اسم المسمى بشكل صحيح"},{status:400});
    const current=await db.prepare("SELECT name FROM job_titles WHERE id=?").bind(id).first<{name:string}>();
    if(!current)return NextResponse.json({error:"المسمى غير موجود"},{status:404});
    if(Array.isArray(body.administrationIds)){
      const requestedIds=[...new Set(body.administrationIds.map(Number).filter((value:number)=>Number.isInteger(value)&&value>0))];
      if(!requestedIds.length)return NextResponse.json({error:"حدد دائرة واحدة على الأقل"},{status:400});
      const administrations=await db.prepare(`SELECT id,name FROM administrations WHERE id IN (${requestedIds.map(()=>"?").join(",")})`).bind(...requestedIds).all<{id:number;name:string}>();
      if(administrations.results.length!==requestedIds.length)return NextResponse.json({error:"تأكد من الدوائر المحددة"},{status:400});
      const titles=await db.prepare("SELECT id FROM job_titles WHERE LOWER(TRIM(name))=LOWER(?)").bind(current.name).all<{id:number}>();
      const titleIds=titles.results.map(row=>row.id);
      const batch=[
        db.prepare(`UPDATE job_titles SET name=?,category_code=COALESCE(NULLIF(?,''),category_code) WHERE id IN (${titleIds.map(()=>"?").join(",")})`).bind(name,categoryCode,...titleIds),
        db.prepare(`DELETE FROM job_title_administrations WHERE job_title_id IN (${titleIds.map(()=>"?").join(",")})`).bind(...titleIds),
        db.prepare(`UPDATE staffing SET job_title=? WHERE job_title_id IN (${titleIds.map(()=>"?").join(",")})`).bind(name,...titleIds),
      ];
      for(const titleId of titleIds)for(const administrationId of requestedIds)batch.push(db.prepare("INSERT OR IGNORE INTO job_title_administrations (job_title_id,administration_id) VALUES (?,?)").bind(titleId,administrationId));
      await db.batch(batch);
      return NextResponse.json({id,name,mainAdministration:administrations.results[0].name,categoryCode,administrationIds:requestedIds});
    }
    const mainAdministration=String(body.mainAdministration||"").trim();
    if(!mainAdministration||!categoryCode)return NextResponse.json({error:"بيانات الدائرة والتصنيف غير مكتملة"},{status:400});
    await db.batch([db.prepare("UPDATE job_titles SET name=?,department_id=NULL,main_administration=?,category_code=? WHERE id=?").bind(name,mainAdministration,categoryCode,id),db.prepare("UPDATE staffing SET job_title=? WHERE job_title_id=?").bind(name,id)]);
    const administration=await db.prepare("SELECT id FROM administrations WHERE name=? ORDER BY id LIMIT 1").bind(mainAdministration).first<{id:number}>();
    if(administration)await db.prepare("INSERT OR IGNORE INTO job_title_administrations (job_title_id,administration_id) VALUES (?,?)").bind(id,administration.id).run();
    return NextResponse.json({id,name,mainAdministration,categoryCode});
  }catch(e){console.error(e);return NextResponse.json({error:"تعذر تعديل المسمى أو ارتباطاته"},{status:409})}
}
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  if(!await requireRole(["admin"]))return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  try{
    await ensureNormalizedSettings();
    const id=Number((await params).id),db=getRawDb();
    const row=await db.prepare("SELECT name FROM job_titles WHERE id=?").bind(id).first<{name:string}>();
    if(!row)return NextResponse.json({error:"السجل غير موجود"},{status:404});
    const linkedEmployees=await db.prepare("SELECT COUNT(*) AS count FROM employees e JOIN job_titles j ON (e.job_code=j.job_code OR ((e.job_code IS NULL OR e.job_code='') AND e.job_title=j.name AND COALESCE(e.main_administration,'')=COALESCE(j.main_administration,''))) WHERE LOWER(TRIM(j.name))=LOWER(TRIM(?))").bind(row.name).first<{count:number}>();
    const linkedStaffing=await db.prepare("SELECT COUNT(*) AS count FROM staffing s JOIN job_titles j ON j.id=s.job_title_id WHERE LOWER(TRIM(j.name))=LOWER(TRIM(?))").bind(row.name).first<{count:number}>();
    const linkedProjects=await db.prepare("SELECT COUNT(*) AS count FROM project_jobs pj JOIN job_titles j ON j.id=pj.job_title_id WHERE LOWER(TRIM(j.name))=LOWER(TRIM(?))").bind(row.name).first<{count:number}>();
    if(Number(linkedEmployees?.count||0)+Number(linkedStaffing?.count||0)+Number(linkedProjects?.count||0)>0)return NextResponse.json({error:`لا يمكن حذف «${row.name}». يوجد موظفون أو سجلات احتياج أو مشاريع مرتبطة بهذا المسمى.`},{status:409});
    await db.prepare("DELETE FROM job_title_administrations WHERE job_title_id IN (SELECT id FROM job_titles WHERE LOWER(TRIM(name))=LOWER(TRIM(?)))").bind(row.name).run();
    await db.prepare("DELETE FROM job_titles WHERE LOWER(TRIM(name))=LOWER(TRIM(?))").bind(row.name).run();
    return NextResponse.json({ok:true});
  }catch(e){console.error(e);return NextResponse.json({error:"تعذر حذف المسمى الوظيفي"},{status:409})}
}
