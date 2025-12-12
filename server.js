require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const ExcelJS = require("exceljs");
const { pool } = require("./db");

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  console.error("❌ SESSION_SECRET no está definido en variables de entorno.");
  process.exit(1);
}

app.use(
  session({
    name: "milan.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ---------- Helpers ----------
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "No autorizado" });
}

function validateOrder(body) {
  const sizes = new Set(["XS","S","M","L","XL","XXL","XXXL","XXXXL"]);

  const real_name = String(body.real_name || "").trim();
  const back_text = String(body.back_text || "").trim();
  const number = Number(body.number);
  const size = String(body.size || "").trim().toUpperCase();

  if (!real_name) return { ok: false, error: "Nombre obligatorio" };
  if (!Number.isInteger(number) || number <= 0 || number > 99)
    return { ok: false, error: "Número inválido (1-99)" };
  if (!back_text) return { ok: false, error: "Texto atrás obligatorio" };
  if (back_text.length > 15) return { ok: false, error: "Texto atrás máximo 15 caracteres" };
  if (!sizes.has(size)) return { ok: false, error: "Talle inválido" };

  return { ok: true, data: { real_name, number, back_text, size } };
}

async function safeQuery(res, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("DB ERROR:", err);
    return res.status(500).json({ error: "Error de base de datos" });
  }
}

// ---------- Public API ----------
app.get("/api/orders", async (req, res) => {
  return safeQuery(res, async () => {
    const { rows } = await pool.query(
      "select id, real_name, number, back_text, size, created_at from public.orders order by number asc"
    );
    res.json(rows);
  });
});

app.post("/api/orders", async (req, res) => {
  const v = validateOrder(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  return safeQuery(res, async () => {
    try {
      const { real_name, number, back_text, size } = v.data;
      const { rows } = await pool.query(
        `insert into public.orders (real_name, number, back_text, size)
         values ($1,$2,$3,$4)
         returning id, real_name, number, back_text, size, created_at`,
        [real_name, number, back_text, size]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (String(err.code) === "23505") {
        return res.status(409).json({ error: "Ese número ya está ocupado" });
      }
      console.error(err);
      return res.status(500).json({ error: "Error del servidor" });
    }
  });
});

// ---------- Admin API ----------
app.post("/api/admin/login", async (req, res) => {
  const user = String(req.body.user || "");
  const pass = String(req.body.pass || "");

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS_HASH) {
    console.error("❌ ADMIN_USER o ADMIN_PASS_HASH no están configurados en env.");
    return res.status(500).json({ error: "Admin no configurado" });
  }

  if (user !== process.env.ADMIN_USER) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const ok = await bcrypt.compare(pass, process.env.ADMIN_PASS_HASH || "");
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  return safeQuery(res, async () => {
    const { rows } = await pool.query(
      "select id, real_name, number, back_text, size, created_at from public.orders order by number asc"
    );
    res.json(rows);
  });
});

app.put("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;

  const v = validateOrder(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  return safeQuery(res, async () => {
    try {
      const { real_name, number, back_text, size } = v.data;
      const { rows } = await pool.query(
        `update public.orders
         set real_name=$1, number=$2, back_text=$3, size=$4
         where id=$5
         returning id, real_name, number, back_text, size, created_at`,
        [real_name, number, back_text, size, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "No existe" });
      res.json(rows[0]);
    } catch (err) {
      if (String(err.code) === "23505") {
        return res.status(409).json({ error: "Ese número ya está ocupado" });
      }
      console.error(err);
      return res.status(500).json({ error: "Error del servidor" });
    }
  });
});

app.delete("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;

  return safeQuery(res, async () => {
    const { rowCount } = await pool.query("delete from public.orders where id=$1", [id]);
    if (!rowCount) return res.status(404).json({ error: "No existe" });
    res.json({ ok: true });
  });
});

app.get("/api/admin/export.xlsx", requireAdmin, async (req, res) => {
  return safeQuery(res, async () => {
    const { rows } = await pool.query(
      "select real_name, number, back_text, size, created_at from public.orders order by number asc"
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedidos");

    ws.columns = [
      { header: "Nombre", key: "real_name", width: 28 },
      { header: "Numero", key: "number", width: 10 },
      { header: "Atras", key: "back_text", width: 18 },
      { header: "Talle", key: "size", width: 10 },
      { header: "Creado", key: "created_at", width: 22 }
    ];

    rows.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"milan_pedidos.xlsx\"");
    await wb.xlsx.write(res);
    res.end();
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MILAN app corriendo en puerto", process.env.PORT || 3000);
});
