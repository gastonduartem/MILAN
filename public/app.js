const body = document.getElementById("ordersBody");
const count = document.getElementById("count");
const form = document.getElementById("orderForm");
const msg = document.getElementById("msg");

async function load() {
  const res = await fetch("/api/orders");
  const data = await res.json();

  body.innerHTML = data.map(o => `
    <tr>
      <td class="num">${o.number}</td>
      <td>${escapeHtml(o.real_name)}</td>
      <td>${escapeHtml(o.back_text)}</td>
      <td>${o.size}</td>
    </tr>
  `).join("");

  count.textContent = `Total: ${data.length}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  msg.className = "msg";

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.number = Number(payload.number);

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json();
  if (!res.ok) {
    msg.textContent = out.error || "Error";
    msg.className = "msg err";
    return;
  }

  form.reset();
  msg.textContent = "Listo. Ya está en la tabla.";
  msg.className = "msg ok";
  await load();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

load();
