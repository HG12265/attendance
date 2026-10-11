import bcrypt from "bcryptjs";
import {
  User,
  Department,
  Class,
  Subject,
  Assignment,
  Enrollment,
  Timetable,
  Session,
  Attendance,
  Settings,
} from "./models.js";
export async function createFixtures(password) {
  const hash = await bcrypt.hash(password, 12);
  const department = await Department.create({
    name: "Computer Science",
    code: "CS",
  });
  const cls = await Class.create({
    name: "MCA · II Year · A",
    departmentId: department._id,
    academicYear: "2026-2027",
    semester: 3,
  });
  const admin = await User.create({
    name: "Admin",
    email: "admin@attendly.example",
    code: "ADM001",
    role: "admin",
    passwordHash: hash,
    mustChangePassword: false,
  });
  const faculty = await User.create({
    name: "Dr. Priya Raman",
    email: "faculty@attendly.example",
    code: "FAC001",
    role: "faculty",
    departmentId: department._id,
    passwordHash: hash,
    mustChangePassword: false,
  });
  const names = [
    "Arun Kumar",
    "Divya S",
    "Karthik R",
    "Nandhini M",
    "Rahul S",
    "Sneha P",
    "Vignesh K",
    "Meena R",
    "Sanjay V",
    "Harini S",
    "Dhanush R",
    "Keerthana B",
  ];
  const students = await User.insertMany(
    names.map((name, i) => ({
      name,
      email: `student${i + 1}@attendly.example`,
      code: `MCA${String(i + 1).padStart(3, "0")}`,
      role: "student",
      classId: cls._id,
      departmentId: department._id,
      passwordHash: hash,
      mustChangePassword: false,
    })),
  );
  const subjects = await Subject.insertMany(
    [
      { name: "Data Structures", code: "CS301" },
      { name: "Database Management", code: "CS302" },
      { name: "Web Technology", code: "CS303" },
    ].map((s) => ({ ...s, departmentId: department._id })),
  );
  const assignments = await Assignment.insertMany(
    subjects.map((subject) => ({
      facultyId: faculty._id,
      subjectId: subject._id,
      classId: cls._id,
    })),
  );
  for (const a of assignments) {
    await Enrollment.insertMany(
      students.map((s) => ({ studentId: s._id, assignmentId: a._id })),
    );
    await Timetable.create({
      assignmentId: a._id,
      day: 1,
      startTime: `${9 + assignments.indexOf(a) * 2}:00`.padStart(5, "0"),
      endTime: `${10 + assignments.indexOf(a) * 2}:00`,
      room: "CS Lab 02",
    });
  }
  for (let d = 14; d > 0; d--) {
    const a = assignments[d % 3],
      start = new Date(Date.now() - d * 86400000);
    const session = await Session.create({
      assignmentId: a._id,
      facultyId: faculty._id,
      subjectId: a.subjectId,
      classId: cls._id,
      title: subjects[d % 3].name,
      startsAt: start,
      endsAt: new Date(+start + 3600000),
      lateAt: new Date(+start + 600000),
      closedAt: new Date(+start + 3600000),
      status: "closed",
      roster: students.map((s) => s._id),
      policy: { qrSeconds: 30, threshold: 75, lateCounts: true },
    });
    await Attendance.insertMany(
      students.map((student, i) => ({
        sessionId: session._id,
        studentId: student._id,
        status:
          (i + d) % 7 === 0 ? "absent" : (i + d) % 9 === 0 ? "late" : "present",
        method: "manual",
        markedAt: start,
        reason: "Synthetic demonstration data",
      })),
    );
  }
  await Settings.findByIdAndUpdate(
    "global",
    { collegeName: "Periyar University · Sample workspace" },
    { upsert: true },
  );
  return { admin, faculty, students, assignments, cls };
}
