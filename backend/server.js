import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Try importing productRoutes with error handling
let productRoutes;
try {
  const productRoutesModule = await import("./routes/productRoutes.js");
  productRoutes = productRoutesModule.default;
  console.log("Product routes imported successfully");
} catch (error) {
  console.error("Error importing product routes:", error);
}
import { sql } from "./config/db.js";
import { aj } from "./lib/arcjet.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
); // helmet is a security middleware that helps you protect your app by setting various HTTP headers
app.use(morgan("dev")); // log the requests

// apply arcjet rate-limit to all routes
app.use(async (req, res, next) => {
  // Only allow bypass in local/dev environment
  const ua = req.headers['user-agent'] || '';
  if (process.env.NODE_ENV !== 'production' && ua.toLowerCase().includes('postman')) {
    return next();
  }
  try {
    const decision = await aj.protect(req, {
      requested: 1, // specifies that each request consumes 1 token
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        res.status(429).json({ error: "Too Many Requests" });
      } else if (decision.reason.isBot()) {
        res.status(403).json({ error: "Bot access denied" });
      } else {
        res.status(403).json({ error: "Forbidden" });
      }
      return;
    }

    // check for spoofed bots
    if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
      res.status(403).json({ error: "Spoofed bot detected" });
      return;
    }

    next();
  } catch (error) {
    console.log("Arcjet error", error);
    next(error);
  }
});

// Debug: Log the current directory and expected dist path
console.log("Current __dirname:", __dirname);
console.log("Looking for dist at:", path.join(__dirname, "../frontend/dist"));

// Add a test route to verify the path (before API routes)
app.get("/test-path", (req, res) => {
  const indexPath = path.join(__dirname, "../frontend/dist/index.html");
  const exists = fs.existsSync(indexPath);
  res.json({
    __dirname,
    distPath: path.join(__dirname, "../frontend/dist"),
    indexPath,
    exists,
    files: exists ? fs.readdirSync(path.dirname(indexPath)) : []
  });
});

// API routes
console.log("About to register product routes...");
app.use("/api/products", productRoutes);
console.log("Product routes registered successfully");

// Test API route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Serve static files from the frontend dist directory (AFTER API routes)
console.log("Setting up static file serving...");
const distPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(distPath));
console.log("Static file serving set up successfully");

// We'll set up the catch-all route after DB initialization

async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log("Database initialized successfully");
  } catch (error) {
    console.log("Error initDB", error);
  }
}

/* initDB().then(() => {
  // Set up catch-all route after DB is initialized - using middleware approach
  console.log("Setting up catch-all route...");
  app.use((req, res, next) => {
    // If it's an API request or test-path, skip this middleware
    if (req.path.startsWith('/api/') || req.path === '/test-path') {
      return next();
    }
    
    // For all other requests, serve index.html
    const indexPath = path.join(__dirname, "../frontend/dist/index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Frontend build not found");
    }
  });
  console.log("Catch-all route set up successfully");

  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
}); */

initDB().then(() => {
  if (process.env.NODE_ENV === "production") {
    // Set up catch-all route only in production
    console.log("Setting up catch-all route (production only)...");
    app.use((req, res, next) => {
      // Skip API and test-path requests
      if (req.path.startsWith('/api/') || req.path === '/test-path') {
        return next();
      }

      // Serve index.html for all other requests
      const indexPath = path.join(__dirname, "../frontend/dist/index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend build not found");
      }
    });
    console.log("Catch-all route set up successfully");
  }

  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
});


// import express from "express";
// import helmet from "helmet";
// import morgan from "morgan";
// import cors from "cors";
// import dotenv from "dotenv";
// import path from "path";

// import productRoutes from "./routes/productRoutes.js";
// import { sql } from "./config/db.js";
// import { aj } from "./lib/arcjet.js";

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 3005;
// const __dirname = path.resolve();

// app.use(express.json());
// app.use(cors());
// app.use(
//   helmet({
//     contentSecurityPolicy: false,
//   })
// ); // helmet is a security middleware that helps you protect your app by setting various HTTP headers
// app.use(morgan("dev")); // log the requests

// // apply arcjet rate-limit to all routes
// app.use(async (req, res, next) => {
//   // Only allow bypass in local/dev environment
//   const ua = req.headers['user-agent'] || '';
//   if (process.env.NODE_ENV !== 'production' && ua.toLowerCase().includes('postman')) {
//     return next();
//   }
//   try {
//     const decision = await aj.protect(req, {
//       requested: 1, // specifies that each request consumes 1 token
//     });

//     if (decision.isDenied()) {
//       if (decision.reason.isRateLimit()) {
//         res.status(429).json({ error: "Too Many Requests" });
//       } else if (decision.reason.isBot()) {
//         res.status(403).json({ error: "Bot access denied" });
//       } else {
//         res.status(403).json({ error: "Forbidden" });
//       }
//       return;
//     }

//     // check for spoofed bots
//     if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
//       res.status(403).json({ error: "Spoofed bot detected" });
//       return;
//     }

//     next();
//   } catch (error) {
//     console.log("Arcjet error", error);
//     next(error);
//   }
// });

// app.use("/api/products", productRoutes);

// /* if (process.env.NODE_ENV === "production") {
//   // server our react app
//   app.use(express.static(path.join(__dirname,"/frontend/dist")));

//   app.get("*", (req, res) => {
//     res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
//   });
// } */

// if (process.env.NODE_ENV === "production") {
//   // Serve static files from frontend/dist
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   // Serve React app for all routes
//   app.get("*", (req, res) => {
//     res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

// async function initDB() {
//   try {
//     await sql`
//       CREATE TABLE IF NOT EXISTS products (
//         id SERIAL PRIMARY KEY,
//         name VARCHAR(255) NOT NULL,
//         image VARCHAR(255) NOT NULL,
//         price DECIMAL(10, 2) NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `;

//     console.log("Database initialized successfully");
//   } catch (error) {
//     console.log("Error initDB", error);
//   }
// }

// initDB().then(() => {
//   app.listen(PORT, () => {
//     console.log("Server is running on port " + PORT);
//   });
// });



