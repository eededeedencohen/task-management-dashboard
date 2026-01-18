let allTasks = []; // כל הנתונים מהשרת
let displayedTasks = []; // הנתונים שמוצגים כרגע (אחרי פילטר)
let currentUser = localStorage.getItem("currentUser");
let sortConfig = { key: "TaskID", direction: "asc" }; // הגדרות מיון נוכחיות

if (!currentUser) window.location.href = "login.html";
document.getElementById("user-display").innerText = currentUser;

// --- אתחול ---
async function initTable() {
  try {
    allTasks = await API.getTasks();
    displayedTasks = [...allTasks]; // בהתחלה מציגים הכל
    applyFilters(); // החלת פילטרים (אם יש ברירת מחדל) ורינדור
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

// --- לוגיקה ראשית: פילטור ומיון ---
function applyFilters() {
  const searchText = document
    .getElementById("search-input")
    .value.toLowerCase();
  const statusFilter = document.getElementById("filter-status").value;
  const shapeFilter = document.getElementById("filter-shape").value;
  const dateStart = document.getElementById("filter-date-start").value;
  const dateEnd = document.getElementById("filter-date-end").value;

  displayedTasks = allTasks.filter((t) => {
    // חיפוש טקסט (בשם או בתיאור)
    const matchText =
      (t.TaskName && t.TaskName.toLowerCase().includes(searchText)) ||
      (t.Description && t.Description.toLowerCase().includes(searchText)) ||
      t.TaskID.toString().includes(searchText);

    // סטטוס
    const matchStatus = statusFilter === "all" || t.Status === statusFilter;

    // צורה (קטגוריה)
    const matchShape = shapeFilter === "all" || t.Shape === shapeFilter;

    // תאריכים (בודק חפיפה בין טווח המשימה לטווח הפילטר)
    let matchDate = true;
    if (dateStart) {
      matchDate = matchDate && t.EndDatePlanned >= dateStart;
    }
    if (dateEnd) {
      matchDate = matchDate && t.StartDatePlanned <= dateEnd;
    }

    return matchText && matchStatus && matchShape && matchDate;
  });

  // אחרי סינון, עושים מיון
  sortData();

  // ולבסוף ציור
  renderTable();
}

function sortTable(key) {
  // אם לוחצים על אותה עמודה - הופכים כיוון
  if (sortConfig.key === key) {
    sortConfig.direction = sortConfig.direction === "asc" ? "desc" : "asc";
  } else {
    sortConfig.key = key;
    sortConfig.direction = "asc";
  }
  applyFilters(); // קורא ל-sortData ול-render
}

function sortData() {
  const key = sortConfig.key;
  const dir = sortConfig.direction === "asc" ? 1 : -1;

  displayedTasks.sort((a, b) => {
    let valA = a[key] ? a[key] : "";
    let valB = b[key] ? b[key] : "";

    // טיפול במספרים
    if (key === "TaskID" || key === "EstimatedHours") {
      return (valA - valB) * dir;
    }
    // טיפול במחרוזות ותאריכים
    return valA.toString().localeCompare(valB.toString()) * dir;
  });
}

function resetFilters() {
  document.getElementById("search-input").value = "";
  document.getElementById("filter-status").value = "all";
  document.getElementById("filter-shape").value = "all";
  document.getElementById("filter-date-start").value = "";
  document.getElementById("filter-date-end").value = "";
  applyFilters();
}

// --- רינדור הטבלה (HTML Generation) ---
function renderTable() {
  const tbody = document.getElementById("tasks-body");
  const noRes = document.getElementById("no-results");
  tbody.innerHTML = "";

  if (displayedTasks.length === 0) {
    noRes.classList.remove("hidden");
    return;
  }
  noRes.classList.add("hidden");

  const today = new Date().toISOString().split("T")[0];

  displayedTasks.forEach((t) => {
    const tr = document.createElement("tr");

    // בדיקת איחור (אדום): אם עבר הדדליין והמשימה לא הושלמה
    const isOverdue =
      t.DeathLine && t.DeathLine < today && t.Status !== "Completed";
    if (isOverdue) tr.classList.add("overdue");

    // עיבוד תלויות לשמות
    const depsHtml =
      t.Dependencies && t.Dependencies.length > 0
        ? t.Dependencies.map((depId) => {
            const depTask = allTasks.find((x) => x.TaskID == depId);
            const name = depTask
              ? depTask.TaskName.substring(0, 10) + ".."
              : depId;
            return `<span class="dep-tag" title="${
              depTask?.TaskName || depId
            }">#${name}</span>`;
          }).join("")
        : '<span style="color:#666">-</span>';

    // פורמט תאריך
    const formatDate = (d) => (d ? d.split("-").reverse().join("/") : "-");

    // מחלקה לצבע הסטטוס (למשל status-In ל-In Progress)
    const statusClass = "status-" + t.Status.split(" ")[0];

    tr.innerHTML = `
            <td><strong>#${t.TaskID}</strong></td>
            <td>
                <div style="font-weight:bold;">${t.TaskName}</div>
                <div style="font-size:0.8rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:250px;">${
                  t.Description || ""
                }</div>
            </td>
            <td><span class="status-pill ${statusClass}">${translateStatus(
      t.Status
    )}</span></td>
            <td>${formatDate(t.StartDatePlanned)}</td>
            <td style="${
              isOverdue ? "color:#f87171; font-weight:bold;" : ""
            }">${formatDate(t.DeathLine)}</td>
            <td>${t.EstimatedHours || 0}</td>
            <td>${depsHtml}</td>
            <td>
                <button class="btn-secondary small" onclick="openTaskModal(${
                  t.TaskID
                })"><i class="fas fa-edit"></i></button>
            </td>
        `;

    // לחיצה כפולה על השורה גם תפתח עריכה
    tr.ondblclick = () => openTaskModal(t.TaskID);

    tbody.appendChild(tr);
  });
}

function translateStatus(s) {
  if (s === "Completed") return "הושלם";
  if (s === "In Progress") return "בביצוע";
  if (s === "Stuck") return "תקוע";
  return "ממתין";
}

// --- מודל (Modal) - זהה לדשבורד ---
// העתקתי את הלוגיקה כדי שתהיה זמינה גם כאן

window.openTaskModal = async function (taskId) {
  const isNew = taskId === "NEW";
  const modal = document.getElementById("task-modal");
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : "";
  };
  setVal("task-id", "");
  setVal("task-name", "");
  setVal("task-hours", "");
  setVal("task-deadline", "");
  setVal("task-desc", "");
  document.getElementById("chat-list").innerHTML = "";

  if (isNew) {
    document.getElementById("modal-title").innerText = "משימה חדשה";
    document.getElementById("btn-delete").style.display = "none";
    setVal("task-shape", "box");
    setVal("task-status", "Pending");
  } else {
    const t = allTasks.find((x) => x.TaskID == taskId);
    if (!t) return;
    document.getElementById("modal-title").innerText = `עריכה: #${t.TaskID}`;
    setVal("task-id", t.TaskID);
    setVal("task-name", t.TaskName);
    setVal("task-status", t.Status);
    setVal("task-shape", t.Shape || "box");
    setVal("task-deadline", t.DeathLine);
    setVal("task-hours", t.EstimatedHours);
    setVal("task-desc", t.Description);
    document.getElementById("btn-delete").style.display = "block";
    loadChat(taskId);
  }
  modal.classList.remove("hidden");
};

window.closeModal = function () {
  document.getElementById("task-modal").classList.add("hidden");
};

window.saveTask = async function () {
  const idVal = document.getElementById("task-id").value;
  const isNew = !idVal;
  let newTask = {};
  if (!isNew) {
    const oldTask = allTasks.find((t) => t.TaskID == idVal);
    newTask = { ...oldTask };
  } else {
    newTask.TaskID = allTasks.length
      ? Math.max(...allTasks.map((t) => t.TaskID)) + 1
      : 100;
    newTask.Dependencies = [];
  }

  newTask.TaskName = document.getElementById("task-name").value;
  newTask.Description = document.getElementById("task-desc").value;
  newTask.Status = document.getElementById("task-status").value;
  newTask.Shape = document.getElementById("task-shape").value;
  newTask.DeathLine = document.getElementById("task-deadline").value;
  newTask.EstimatedHours = document.getElementById("task-hours").value;

  if (!newTask.TaskName) return alert("חובה להזין שם משימה");
  await API.saveTask(newTask);
  window.closeModal();
  initTable(); // רענון הטבלה
};

window.deleteTask = async function () {
  if (confirm("למחוק?")) {
    await API.deleteTask(document.getElementById("task-id").value);
    window.closeModal();
    initTable();
  }
};

window.logout = function () {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
};

async function loadChat(taskId) {
  const list = document.getElementById("chat-list");
  if (!list) return;
  list.innerHTML = "טוען...";
  try {
    const notes = await API.getNotes(taskId);
    list.innerHTML = "";
    notes.forEach((n) => {
      const d = document.createElement("div");
      d.className = "chat-msg";
      d.innerHTML = `<strong>${n.Responder}:</strong> ${n.Text}`;
      list.appendChild(d);
    });
  } catch (e) {
    list.innerHTML = "";
  }
}

window.sendNote = async function () {
  const txtInput = document.getElementById("chat-msg");
  const txt = txtInput.value;
  const id = document.getElementById("task-id").value;
  if (!txt || !id) return;
  await API.addNote({ TaskID: id, Responder: currentUser, Text: txt });
  txtInput.value = "";
  loadChat(id);
};

// הפעלה
initTable();
