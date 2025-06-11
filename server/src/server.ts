import express from "express";
import codeRoutes from "./routes/router";
import { corsMiddleware, handleCorsErrors } from "./middlewares/cors";
import FileContext from "./services/fileSessions"; 

const app = express();

app.use(corsMiddleware);
app.use(express.json());
app.use(handleCorsErrors);

app.use("/api", codeRoutes);

const PORT = process.env.PORT || 4000;

const EXPIRY_TIME_MS = 60000 * 60; // 60 minutes
const CLEANUP_INTERVAL_MS = 60000 * 10; // 10 minutes

setInterval(() => {
    FileContext.cleanupExpiredContexts(EXPIRY_TIME_MS);
    console.log("Expired file contexts cleaned up.");
}, CLEANUP_INTERVAL_MS);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
