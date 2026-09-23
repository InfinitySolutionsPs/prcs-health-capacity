import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const hospitals = sqliteTable(
  "hospitals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("idx_hospitals_name").on(t.name)],
);

export const administrations = sqliteTable(
  "administrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    hospitalId: integer("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_administrations_hospital_name").on(t.hospitalId, t.name),
  ],
);

export const departments = sqliteTable(
  "departments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    hospitalId: integer("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "cascade" }),
    administrationId: integer("administration_id").references(
      () => administrations.id,
      { onDelete: "set null" },
    ),
    division: text("division").notNull().default("غير محدد"),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_departments_hospital_division_name").on(
      t.hospitalId,
      t.division,
      t.name,
    ),
  ],
);

export const jobTitles = sqliteTable(
  "job_titles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    mainAdministration: text("main_administration"),
    categoryCode: text("category_code"),
    jobCode: text("job_code"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_job_titles_name").on(t.name),
    uniqueIndex("idx_job_titles_job_code").on(t.jobCode),
  ],
);

export const staffing = sqliteTable(
  "staffing",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    jobTitleId: integer("job_title_id").references(() => jobTitles.id, {
      onDelete: "set null",
    }),
    jobTitle: text("job_title").notNull(),
    required: integer("required").notNull().default(0),
    available: integer("available").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_staffing_department_job").on(t.departmentId, t.jobTitle),
  ],
);

export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const systemUsers = sqliteTable(
  "system_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authUserId: text("auth_user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "editor", "viewer"] })
      .notNull()
      .default("viewer"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_system_users_email").on(t.email),
    uniqueIndex("idx_system_users_auth_user_id").on(t.authUserId),
  ],
);

export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeNo: text("employee_no").notNull(),
    firstName: text("first_name"),
    fatherName: text("father_name"),
    grandfatherName: text("grandfather_name"),
    familyName: text("family_name"),
    employeeCode: text("employee_code"),
    jobCode: text("job_code"),
    categoryCode: text("category_code"),
    mainAdministration: text("main_administration"),
    fullName: text("full_name").notNull(),
    nationalId: text("national_id"),
    gender: text("gender"),
    birthDate: text("birth_date"),
    cadreType: text("cadre_type"),
    phone: text("phone"),
    maritalStatus: text("marital_status"),
    hireDate: text("hire_date"),
    jobTitle: text("job_title").notNull(),
    facility: text("facility").notNull(),
    administration: text("administration"),
    department: text("department"),
    qualification: text("qualification"),
    specialty: text("specialty"),
    governorate: text("governorate"),
    city: text("city"),
    contractStart: text("contract_start"),
    contractEnd: text("contract_end"),
    endReason: text("end_reason"),
    endDate: text("end_date"),
    status: text("status").notNull().default("على رأس عمله"),
    dualWorkplace: text("dual_workplace"),
    salary: text("salary"),
    jobGrade: text("job_grade"),
    project: text("project"),
    projectCoverage: text("project_coverage"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_employees_employee_no").on(t.employeeNo),
    uniqueIndex("idx_employees_employee_code").on(t.employeeCode),
  ],
);

export const payrollEntries = sqliteTable(
  "payroll_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeNo: text("employee_no").notNull(),
    employeeName: text("employee_name").notNull(),
    period: text("period").notNull(),
    project: text("project").notNull(),
    facility: text("facility"),
    administration: text("administration"),
    gross: text("gross").notNull().default("0"),
    deductions: text("deductions").notNull().default("0"),
    net: text("net").notNull().default("0"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("idx_payroll_employee_period_project").on(
      t.employeeNo,
      t.period,
      t.project,
    ),
  ],
);

