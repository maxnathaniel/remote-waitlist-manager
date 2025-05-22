import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

export async function ensureDatabaseTablesExist(): Promise<void> {
  try {
    await pool.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE TABLE IF NOT EXISTS parties (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                client_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                party_size INTEGER NOT NULL,
                status VARCHAR(50) NOT NULL,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ready_at TIMESTAMP WITH TIME ZONE,
                checked_in_at TIMESTAMP WITH TIME ZONE,
                service_ends_at TIMESTAMP WITH TIME ZONE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_client_id_active ON parties (client_id)
            WHERE status IN ('queued', 'ready_to_checkin', 'seated');
            CREATE INDEX IF NOT EXISTS idx_parties_joined_at ON parties (joined_at);
        `);
    console.log("Parties table and indexes ensured to exist.");
  } catch (err) {
    console.error("Error ensuring database tables exist:", err);
    throw err;
  }
}
