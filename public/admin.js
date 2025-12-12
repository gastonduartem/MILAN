const loginCard = document.getElementById("loginCard");
const panelCard = document.getElementById("panelCard");

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");

const adminBody = document.getElementById("adminBody");
const adminMsg = document.getElementById("adminMsg");
const logoutBtn = document.getElementById("logoutBtn");

async function tryLoadAdmin() {
  const res = await fetch("/api/admin/orders");
  if (res.status === 401) return false;

  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    adminMsg.textContent = out.error || "Error cargando pedidos";
    adminMsg.className = "msg err";
    return false;
  }

  render(out);
  return true;
}

function render(data) {
  adminBody.innerHTML = data.map(o => `
    <tr data-id="${o.id}">
      <td><input class="in num" type="number" min="1" max="99" value="${o.number}"></td>
      <td><input class="in" value="${esc(o.real_name)}"></td>
      <td><input class="in" maxlength="15" value="${esc(o.back_text)}"></td>
      <td>
        <select class="in">
          ${["XS","S","M","L","XL","XXL","XXXL","XXXXL"].map(s => `
            <option ${o.size===s?"selected":""}>${s}</option>
          `).join("")}
        </select>
      </td>
      <td class="actions">
        <button class="save">Guardar</button>
        <button class="del danger">Borrar</button>
      </td>
    </tr>
  `).join("");
}

adminBody.addEventListener("click", async (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;

  if (e.target.classList.contains("save")) {
    adminMsg.textContent = "";
    adminMsg.className = "msg";

    const inputs = tr.querySelectorAll(".in");
    const payload = {
      number: Number(inputs[0].value),
      real_name: inputs[1].value.trim(),
      back_text: inputs[2].value.trim(),
      size: inputs[3].value
    };

    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      adminMsg.textContent = out.error || "Error";
      adminMsg.className = "msg err";
      return;
    }

    adminMsg.textContent = "Guardado.";
    adminMsg.className = "msg ok";
    await reload();
  }

  if (e.target.classList.contains("del")) {
    const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      adminMsg.textContent = out.error || "Error";
      adminMsg.className = "msg err";
      return;
    }
    adminMsg.textContent = "Borrado.";
    adminMsg.className = "msg ok";
    await reload();
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  loginMsg.className = "msg";

  const fd = new FormData(loginForm);
  const payload = Object.fromEntries(fd.entries());

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    loginMsg.textContent = out.error || "Error";
    loginMsg.className = "msg err";
    return;
  }

  loginCard.classList.add("hidden");
  panelCard.classList.remove("hidden");
  await reload();
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  location.reload();
});

async function reload() {
  const res = await fetch("/api/admin/orders");
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    adminMsg.textContent = out.error || "Error cargando pedidos";
    adminMsg.className = "msg err";
    return;
  }
  render(out);
}

function esc(s){ return String(s).replace(/"/g, "&quot;"); }

tryLoadAdmin().then(ok => {
  if (ok) {
    loginCard.classList.add("hidden");
    panelCard.classList.remove("hidden");
  }
});
