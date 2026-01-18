const API = {
  getTasks: async () => {
    try {
      return await (await fetch("/api/tasks")).json();
    } catch (e) {
      return [];
    }
  },
  saveTask: async (task) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
  },
  deleteTask: async (id) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  },
  getNotes: async (taskId) => {
    try {
      return await (await fetch(`/api/notes?taskId=${taskId}`)).json();
    } catch (e) {
      return [];
    }
  },
  addNote: async (note) => {
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
  },
};
