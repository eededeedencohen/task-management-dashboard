const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// יצירת קבצים אם חסרים
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, "[]", "utf8");
if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, "[]", "utf8");

// הפניה לדף התחברות
app.get("/", (req, res) => res.redirect("/login.html"));

// --- API ---
app.get("/api/tasks", (req, res) => {
  fs.readFile(TASKS_FILE, "utf8", (err, data) =>
    res.json(err ? [] : JSON.parse(data))
  );
});

app.post("/api/tasks", (req, res) => {
  const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
  const newTask = req.body;
  const index = tasks.findIndex((t) => t.TaskID == newTask.TaskID);
  if (index > -1) tasks[index] = newTask;
  else tasks.push(newTask);
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  res.json({ success: true, tasks });
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id);
  let tasks = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
  tasks = tasks.filter((t) => t.TaskID !== id);
  // מחיקת תלויות
  tasks.forEach(
    (t) => (t.Dependencies = t.Dependencies.filter((d) => d !== id))
  );
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  res.json({ success: true });
});

// הערות
app.get("/api/notes", (req, res) => {
  const taskId = req.query.taskId;
  fs.readFile(NOTES_FILE, "utf8", (err, data) => {
    let notes = err ? [] : JSON.parse(data);
    if (taskId) notes = notes.filter((n) => n.TaskID == taskId);
    res.json(notes);
  });
});

app.post("/api/notes", (req, res) => {
  const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
  const newNote = {
    ...req.body,
    NoteID: Date.now(),
    Date: new Date().toISOString(),
  };
  notes.push(newNote);
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  res.json({ success: true, note: newNote });
});

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
