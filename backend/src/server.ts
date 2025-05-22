import express, { Application } from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import { pool, ensureDatabaseTablesExist } from "./db";
import { WaitlistController } from "./controllers/WaitlistController";
import { WaitlistService } from "./services/WaitlistService";
import { SocketHandlers } from "./sockets/SockerHandlers";
import { PartyRepository } from "./repositories/PartyRepository";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 4000;

async function startServer() {
  const app: Application = express();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: FRONTEND_URL,
      methods: ["GET", "POST"],
    },
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: FRONTEND_URL,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );

  const partyRepository = new PartyRepository(pool);
  const waitlistService = new WaitlistService(partyRepository, io);

  WaitlistController(app, waitlistService);
  SocketHandlers(io, waitlistService);

  try {
    await ensureDatabaseTablesExist();
    await waitlistService.initialize();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Failed to start server due to database or initialization error:",
      error
    );
    process.exit(1);
  }
}

startServer();
