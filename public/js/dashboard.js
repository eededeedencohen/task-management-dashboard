let tasks = [];
let network = null;
let currentUser = localStorage.getItem("currentUser");
let nodesDataSet, edgesDataSet;

let interactionState = {
  isDragging: false,
  startNode: null,
  endNode: null,
  dragPos: { x: 0, y: 0 },
};
let selectedEdgeId = null;

if (!currentUser) window.location.href = "login.html";
if (document.getElementById("user-display"))
  document.getElementById("user-display").innerText = currentUser;

async function initGraph() {
  try {
    tasks = await API.getTasks();
    const container = document.getElementById("mynetwork");

    // --- מיפוי צמתים עם Tooltip מתוקן ---
    const nodesArray = tasks.map((t) => ({
      id: t.TaskID,
      label: formatLabel(t.TaskName),
      title: buildTooltipHTML(t), // קריאה לפונקציה החדשה
      shape: "ellipse",
      color: getStatusColor(t.Status),
      font: { color: "white", face: "Segoe UI", size: 14 },
      margin: 15,
      widthConstraint: { maximum: 160 },
      shadow: true,
      x: t.x,
      y: t.y,
    }));

    const edgesArray = [];
    tasks.forEach((t) => {
      if (t.Dependencies) {
        t.Dependencies.forEach((depId) => {
          edgesArray.push({
            id: `${depId}-${t.TaskID}`,
            from: depId,
            to: t.TaskID,
            arrows: "to",
            color: { color: "rgba(255,255,255,0.4)" },
            width: 2,
            smooth: { type: "cubicBezier" },
          });
        });
      }
    });

    nodesDataSet = new vis.DataSet(nodesArray);
    edgesDataSet = new vis.DataSet(edgesArray);
    const data = { nodes: nodesDataSet, edges: edgesDataSet };

    const options = {
      physics: { enabled: false },
      layout: { hierarchical: false },
      interaction: {
        hover: true, // חובה ל-Tooltip
        navigationButtons: true,
        keyboard: true,
        selectConnectedEdges: false,
        multiselect: true,
      },
      manipulation: { enabled: false },
    };

    network = new vis.Network(container, data, options);

    // --- אירועים וציור ---
    network.on("beforeDrawing", function (ctx) {
      drawGroupBackgrounds(ctx);
    });

    network.on("afterDrawing", function (ctx) {
      const hoverNode = network.getNodeAt(interactionState.dragPos);
      if (hoverNode && !interactionState.isDragging) {
        const nodePos = network.getPositions([hoverNode])[hoverNode];
        const box = network.getBoundingBox(hoverNode);
        ctx.beginPath();
        ctx.arc(box.right, nodePos.y, 6, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#10b981";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.stroke();
      }

      if (interactionState.isDragging && interactionState.startNode) {
        const startPos = network.getPositions([interactionState.startNode])[
          interactionState.startNode
        ];
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        const domPos = interactionState.dragPos;
        const canvasPos = network.DOMtoCanvas({ x: domPos.x, y: domPos.y });
        ctx.lineTo(canvasPos.x, canvasPos.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const targetNode = network.getNodeAt(interactionState.dragPos);
        if (targetNode && targetNode !== interactionState.startNode) {
          const tPos = network.getPositions([targetNode])[targetNode];
          const gradient = ctx.createRadialGradient(
            tPos.x,
            tPos.y,
            20,
            tPos.x,
            tPos.y,
            50
          );
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
          ctx.beginPath();
          ctx.arc(tPos.x, tPos.y, 50, 0, 2 * Math.PI);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }
    });

    network.on("click", function (params) {
      if (params.event.srcEvent.altKey && params.nodes.length > 0)
        selectCluster(params.nodes[0]);
      hideContextMenu();
    });

    container.addEventListener("mousemove", function (e) {
      const rect = container.getBoundingClientRect();
      interactionState.dragPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      network.redraw();
    });

    container.addEventListener("mousedown", function (e) {
      if (e.button === 2) {
        const nodeId = network.getNodeAt({ x: e.layerX, y: e.layerY });
        if (nodeId) {
          interactionState.isDragging = true;
          interactionState.startNode = nodeId;
          container.style.cursor = "crosshair";
          e.preventDefault();
        }
      }
    });

    container.addEventListener("mouseup", async function (e) {
      if (e.button === 2 && interactionState.isDragging) {
        const endNodeId = network.getNodeAt({ x: e.layerX, y: e.layerY });
        if (endNodeId && endNodeId !== interactionState.startNode) {
          await addDependency(interactionState.startNode, endNodeId);
        }
        interactionState.isDragging = false;
        interactionState.startNode = null;
        container.style.cursor = "default";
        network.redraw();
      }
    });

    container.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      if (!interactionState.isDragging) {
        const edgeId = network.getEdgeAt({ x: e.layerX, y: e.layerY });
        if (edgeId) {
          selectedEdgeId = edgeId;
          showContextMenu(e.clientX, e.clientY);
        } else {
          hideContextMenu();
        }
      }
      return false;
    });

    network.on("doubleClick", function (params) {
      if (params.nodes.length > 0) openTaskModal(params.nodes[0]);
    });
  } catch (error) {
    console.error("Error initGraph:", error);
  }
}

// --- פונקציית ה-Tooltip המתוקנת והמעוצבת ---
function buildTooltipHTML(t) {
  // מכינים משתנים לתצוגה
  const start = t.StartDatePlanned
    ? new Date(t.StartDatePlanned).toLocaleDateString("he-IL")
    : "לא נקבע";
  const dead = t.DeathLine
    ? new Date(t.DeathLine).toLocaleDateString("he-IL")
    : "-";

  // צבע סטטוס
  let statusText = t.Status;
  let statusColor = "#fff";
  switch (t.Status) {
    case "Completed":
      statusText = "הושלם";
      statusColor = "#4ade80";
      break;
    case "In Progress":
      statusText = "בביצוע";
      statusColor = "#facc15";
      break;
    case "Stuck":
      statusText = "תקוע";
      statusColor = "#f87171";
      break;
    default:
      statusText = "ממתין";
      statusColor = "#94a3b8";
  }

  // תיאור עם טיפול בירידת שורות
  const description = t.Description
    ? t.Description.replace(/\n/g, "<br/>")
    : '<span style="color:#64748b; font-style:italic;">אין פירוט נוסף למשימה זו</span>';

  // יצירת אלמנט DOM אמיתי
  const container = document.createElement("div");
  container.className = "tooltip-container";

  container.innerHTML = `
        <div class="tooltip-header">
            <div class="tooltip-title">${t.TaskName}</div>
            <div class="tooltip-id">ID: #${t.TaskID}</div>
        </div>
        <div class="tooltip-body">
            <div class="tooltip-desc">${description}</div>
            <div class="tooltip-grid">
                <div class="tooltip-item">
                    <span class="tooltip-label">סטטוס</span>
                    <span class="tooltip-value" style="color:${statusColor}">${statusText}</span>
                </div>
                <div class="tooltip-item">
                    <span class="tooltip-label">תאריך יעד</span>
                    <span class="tooltip-value">${dead}</span>
                </div>
                <div class="tooltip-item">
                    <span class="tooltip-label">התחלה</span>
                    <span class="tooltip-value">${start}</span>
                </div>
                <div class="tooltip-item">
                    <span class="tooltip-label">שעות</span>
                    <span class="tooltip-value">${t.EstimatedHours || 0}</span>
                </div>
            </div>
        </div>
    `;

  return container; // מחזירים אלמנט DOM, לא טקסט!
}

function drawGroupBackgrounds(ctx) {
  const nodeIds = nodesDataSet.getIds();
  if (nodeIds.length === 0) return;
  const visited = new Set();
  const clusters = [];
  const adj = {};
  nodeIds.forEach((id) => (adj[id] = []));
  edgesDataSet.get().forEach((e) => {
    if (adj[e.from]) adj[e.from].push(e.to);
    if (adj[e.to]) adj[e.to].push(e.from);
  });
  nodeIds.forEach((startNode) => {
    if (!visited.has(startNode)) {
      const cluster = [];
      const queue = [startNode];
      visited.add(startNode);
      while (queue.length > 0) {
        const u = queue.shift();
        cluster.push(u);
        if (adj[u]) {
          adj[u].forEach((v) => {
            if (!visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          });
        }
      }
      clusters.push(cluster);
    }
  });
  const positions = network.getPositions();
  clusters.forEach((cluster) => {
    if (cluster.length < 2) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    cluster.forEach((id) => {
      if (positions[id]) {
        const pos = positions[id];
        minX = Math.min(minX, pos.x - 80);
        maxX = Math.max(maxX, pos.x + 80);
        minY = Math.min(minY, pos.y - 40);
        maxY = Math.max(maxY, pos.y + 40);
      }
    });
    const padding = 20;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.roundRect(
      minX - padding,
      minY - padding,
      maxX - minX + padding * 2,
      maxY - minY + padding * 2,
      20
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function selectCluster(startNodeId) {
  const visited = new Set();
  const queue = [startNodeId];
  visited.add(startNodeId);
  const adj = {};
  const allIds = nodesDataSet.getIds();
  allIds.forEach((id) => (adj[id] = []));
  edgesDataSet.get().forEach((e) => {
    if (adj[e.from]) adj[e.from].push(e.to);
    if (adj[e.to]) adj[e.to].push(e.from);
  });
  while (queue.length > 0) {
    const u = queue.shift();
    if (adj[u]) {
      adj[u].forEach((v) => {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      });
    }
  }
  network.selectNodes(Array.from(visited));
}

function autoLayout() {
  if (!network) return;
  network.setOptions({
    layout: {
      hierarchical: {
        enabled: true,
        direction: "LR",
        sortMethod: "directed",
        nodeSpacing: 150,
        levelSeparation: 250,
      },
    },
    physics: { enabled: false },
  });
  setTimeout(() => {
    network.setOptions({
      layout: { hierarchical: { enabled: false } },
      physics: { enabled: false },
    });
    network.fit();
  }, 500);
}

async function addDependency(fromId, toId) {
  const targetTask = tasks.find((t) => t.TaskID == toId);
  if (!targetTask) return;
  if (!targetTask.Dependencies.includes(fromId)) {
    targetTask.Dependencies.push(fromId);
    await API.saveTask(targetTask);
    edgesDataSet.add({
      id: `${fromId}-${toId}`,
      from: fromId,
      to: toId,
      arrows: "to",
      color: { color: "rgba(255,255,255,0.4)" },
      width: 2,
      smooth: { type: "cubicBezier" },
    });
  }
}

window.deleteSelectedEdge = async function () {
  if (!selectedEdgeId) return;
  const [from, to] = selectedEdgeId.split("-").map(Number);
  const targetTask = tasks.find((t) => t.TaskID == to);
  if (targetTask) {
    targetTask.Dependencies = targetTask.Dependencies.filter((d) => d != from);
    await API.saveTask(targetTask);
    edgesDataSet.remove(selectedEdgeId);
    hideContextMenu();
  }
};

function formatLabel(name) {
  if (!name) return "משימה";
  const words = name.split(" ");
  let lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + words[i].length < 15) {
      currentLine += " " + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines.join("\n");
}

function getStatusColor(status) {
  switch (status) {
    case "Completed":
      return { background: "#10b981", border: "#047857" };
    case "In Progress":
      return { background: "#f59e0b", border: "#b45309" };
    case "Stuck":
      return { background: "#ef4444", border: "#b91c1c" };
    default:
      return { background: "#3b82f6", border: "#1d4ed8" };
  }
}

window.saveTask = async function () {
  const idVal = document.getElementById("task-id").value;
  const isNew = !idVal;
  let newTask = {};
  if (!isNew) {
    const oldTask = tasks.find((t) => t.TaskID == idVal);
    newTask = { ...oldTask };
  } else {
    newTask.TaskID = tasks.length
      ? Math.max(...tasks.map((t) => t.TaskID)) + 1
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
  initGraph();
};

window.deleteTask = async function () {
  if (confirm("למחוק?")) {
    await API.deleteTask(document.getElementById("task-id").value);
    window.closeModal();
    initGraph();
  }
};

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
    setVal("task-shape", "ellipse");
    setVal("task-status", "Pending");
  } else {
    const t = tasks.find((x) => x.TaskID == taskId);
    if (!t) return;
    document.getElementById("modal-title").innerText = `עריכה: ${t.TaskName}`;
    setVal("task-id", t.TaskID);
    setVal("task-name", t.TaskName);
    setVal("task-status", t.Status);
    setVal("task-shape", t.Shape || "ellipse");
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

function showContextMenu(x, y) {
  const menu = document.getElementById("context-menu");
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.classList.remove("hidden");
}
window.hideContextMenu = function () {
  document.getElementById("context-menu").classList.add("hidden");
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

initGraph();
