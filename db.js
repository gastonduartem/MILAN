const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL no está definido en variables de entorno.");
  process.exit(1);
}

/**
 * En redes corporativas o algunos proveedores, la cadena TLS puede fallar verificación.
 * Para este proyecto (Milan), forzamos SSL y desactivamos validación del certificado.
 * En proyectos “serios”, lo ideal es configurar el CA correcto.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = { pool };
