import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const hospitals=sqliteTable("hospitals",{
  id:integer("id").primaryKey({autoIncrement:true}),
  name:text("name").notNull(),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("idx_hospitals_name").on(t.name)]);

export const administrations=sqliteTable("administrations",{
  id:integer("id").primaryKey({autoIncrement:true}),
  hospitalId:integer("hospital_id").notNull().references(()=>hospitals.id,{onDelete:"cascade"}),
  name:text("name").notNull(),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("idx_administrations_hospital_name").on(t.hospitalId,t.name)]);

export const departments=sqliteTable("departments",{
  id:integer("id").primaryKey({autoIncrement:true}),
  hospitalId:integer("hospital_id").notNull().references(()=>hospitals.id,{onDelete:"cascade"}),
  administrationId:integer("administration_id").references(()=>administrations.id,{onDelete:"set null"}),
  division:text("division").notNull().default("غير محدد"),
  name:text("name").notNull(),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("idx_departments_hospital_division_name").on(t.hospitalId,t.division,t.name)]);

export const jobTitles=sqliteTable("job_titles",{
  id:integer("id").primaryKey({autoIncrement:true}),
  name:text("name").notNull(),
  active:integer("active",{mode:"boolean"}).notNull().default(true),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("idx_job_titles_name").on(t.name)]);

export const staffing=sqliteTable("staffing",{
  id:integer("id").primaryKey({autoIncrement:true}),
  departmentId:integer("department_id").notNull().references(()=>departments.id,{onDelete:"cascade"}),
  jobTitleId:integer("job_title_id").references(()=>jobTitles.id,{onDelete:"set null"}),
  jobTitle:text("job_title").notNull(),
  required:integer("required").notNull().default(0),
  available:integer("available").notNull().default(0),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex("idx_staffing_department_job").on(t.departmentId,t.jobTitle)]);

export const systemMetadata=sqliteTable("system_metadata",{
  key:text("key").primaryKey(),
  value:text("value").notNull(),
});

export const systemUsers=sqliteTable("system_users",{
  id:integer("id").primaryKey({autoIncrement:true}),
  authUserId:text("auth_user_id"),
  email:text("email").notNull(),
  name:text("name").notNull(),
  role:text("role",{enum:["admin","editor","viewer"]}).notNull().default("viewer"),
  active:integer("active",{mode:"boolean"}).notNull().default(true),
  createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[
  uniqueIndex("idx_system_users_email").on(t.email),
  uniqueIndex("idx_system_users_auth_user_id").on(t.authUserId),
]);
