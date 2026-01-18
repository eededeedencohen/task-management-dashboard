function handleLogin() {
  const user = document.getElementById("user-select").value;
  if (!user) return alert("נא לבחור משתמש מהרשימה");
  localStorage.setItem("currentUser", user);
  window.location.href = "dashboard.html";
}
