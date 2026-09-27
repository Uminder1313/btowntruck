const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
require("dotenv").config();

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app = express();

app.use(cors({
  origin: [
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:5173",
  ],
}));

app.use(express.json());

// Serve the React production build
const DIST_DIR = path.join(__dirname, "..", "dist");
app.use(express.static(DIST_DIR));

const SITE_MEDIA_DIR = path.join(__dirname, "uploads", "site-media");

// Serve uploaded site images
app.use("/site-media", express.static(SITE_MEDIA_DIR));

const siteMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, SITE_MEDIA_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 60);

    cb(null, `${Date.now()}-${base || "image"}${ext}`);
  },
});


const uploadSiteMedia = multer({
  storage: siteMediaStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WebP and SVG images are allowed."));
    }

    cb(null, true);
  },
});

app.use(
  "/site-media",
  express.static(SITE_MEDIA_DIR, {
    maxAge: "1h",
  }),
);

const SUPER_ADMIN_EMAIL = "uminder1313@gmail.com";

async function isSuperAdmin(userId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM "prj_-jPU4p7xAmeh".profiles
    WHERE id = $1
      AND LOWER(email) = LOWER($2)
    LIMIT 1
    `,
    [userId, SUPER_ADMIN_EMAIL]
  );

  return result.rowCount > 0;
}
app.post("/api/admin/users/:userId/status", async (req, res) => {
  try {
    // 1. Read the JWT
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify the logged-in user's session
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const actorId = decoded.user_id;

    if (!actorId) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    // 3. Only the superadmin can change account status
    const superAdmin = await isSuperAdmin(actorId);

    if (!superAdmin) {
      return res.status(403).json({
        error: "Only the super administrator can change user status",
      });
    }

    // 4. Get requested status
    const { userId } = req.params;
    const { is_active } = req.body;

    const targetSuperAdmin = await isSuperAdmin(userId);

if (targetSuperAdmin) {
  return res.status(403).json({
    error: "The super administrator account cannot be modified",
  });
}

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        error: "is_active must be true or false",
      });
    }

    // 5. Prevent the superadmin from deactivating their own account
    if (userId === actorId && is_active === false) {
      return res.status(400).json({
        error: "You cannot deactivate your own account",
      });
    }

    // 6. Update the user's status
    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".profiles
      SET is_active = $1
      WHERE id = $2
      RETURNING id, is_active
      `,
      [is_active, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });

  } catch (error) {
    console.error("User status update error:", error);

    res.status(500).json({
      error: "Failed to update user status",
    });
  }
});


// Update user roles

app.post("/api/admin/users/:userId/roles", async (req, res) => {
  try {
    // 1. Read the JWT from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify the logged-in user's JWT
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const actorId = decoded.user_id;

    if (!actorId) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    // 3. Only the superadmin can change user roles
    const superAdmin = await isSuperAdmin(actorId);

    if (!superAdmin) {
      return res.status(403).json({
        error: "Only the super administrator can change user roles",
      });
    }

    // 4. Get target user and requested roles
    const { userId } = req.params;
    const { roles } = req.body;

    const targetSuperAdmin = await isSuperAdmin(userId);

if (targetSuperAdmin) {
  return res.status(403).json({
    error: "The super administrator account cannot be modified",
  });
}

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        error: "At least one role is required",
      });
    }

    // 5. Only allow legitimate application roles
    const allowedRoles = [
      "admin",
      "dispatcher",
      "viewer",
      "customer",
    ];

    const validRoles = [
      ...new Set(
        roles.filter((role) => allowedRoles.includes(role))
      ),
    ];

    if (validRoles.length === 0) {
      return res.status(400).json({
        error: "No valid roles provided",
      });
    }

    // 6. Make sure target user exists
    const targetResult = await pool.query(
      `
      SELECT id
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // 7. Remove existing roles
    await pool.query(
      `
      DELETE FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [userId]
    );

    // 8. Add selected roles
    for (const role of validRoles) {
      await pool.query(
        `
        INSERT INTO "prj_-jPU4p7xAmeh".user_roles
          (user_id, role)
        VALUES ($1, $2)
        `,
        [userId, role]
      );
    }

    // 9. Keep profiles.role synchronized
    const primaryRole =
      validRoles.includes("admin")
        ? "admin"
        : validRoles.includes("dispatcher")
        ? "dispatcher"
        : validRoles.includes("viewer")
        ? "viewer"
        : "customer";

    await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".profiles
      SET role = $1
      WHERE id = $2
      `,
      [primaryRole, userId]
    );

    res.json({
      success: true,
      roles: validRoles,
    });

  } catch (error) {
    console.error("Role update error:", error);

    res.status(500).json({
      error: "Failed to update roles",
    });
  }
});


// Validate local JWT session
app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing authentication token",
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(`
      SELECT id, email, full_name, role, is_active
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE id = $1
      LIMIT 1
    `, [decoded.user_id]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: "Account is inactive",
      });
    }

    const rolesResult = await pool.query(`
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      ORDER BY role
    `, [user.id]);

    const roles = rolesResult.rows.map(row => row.role);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        roles,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error("Session validation error:", error);

    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
});

// app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  port: process.env.DATABASE_URL ? undefined : process.env.DB_PORT,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: false }
  : undefined,
});
// Database health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].time,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      database: "connection failed",
    });
  }
});

// Local authentication
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, door } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const userResult = await pool.query(`
      SELECT id, email, full_name, role, is_active, password_hash
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: "Account is inactive",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const rolesResult = await pool.query(`
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      ORDER BY role
    `, [user.id]);

    const roles = rolesResult.rows.map(row => row.role);

    if (door === "admin") {
      const staffRoles = ["admin", "dispatcher", "viewer", "pending_staff"];

      if (!roles.some(role => staffRoles.includes(role))) {
        return res.status(403).json({
          error: "This account is not authorized for staff login",
        });
      }
    }

    // Create local session token
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        roles,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      token,
     user: {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    roles,
    is_active: user.is_active,
  },
      roles,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

// Test imported admin record
app.get("/api/test-admin", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, full_name, role, is_active
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE email = 'testadmin@gmail.com'
    `);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    // 1. Read the JWT
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify the session
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const actorId = decoded.user_id;

    if (!actorId) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    // 3. Only administrators can view the Users administration page
    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [actorId]
    );

    const actorRoles = actorRolesResult.rows.map((row) => row.role);

    if (!actorRoles.includes("admin")) {
      return res.status(403).json({
        error: "Only administrators can access users",
      });
    }

    // 4. Load users
    const usersResult = await pool.query(
      `
      SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM "prj_-jPU4p7xAmeh".profiles
      ORDER BY created_at DESC
      `
    );

    // 5. Load roles
    const rolesResult = await pool.query(
      `
      SELECT user_id, role
      FROM "prj_-jPU4p7xAmeh".user_roles
      `
    );

    const rolesByUser = {};

    for (const row of rolesResult.rows) {
      if (!rolesByUser[row.user_id]) {
        rolesByUser[row.user_id] = [];
      }

      rolesByUser[row.user_id].push(row.role);
    }

    const users = usersResult.rows.map((user) => ({
      ...user,
      roles: rolesByUser[user.id] || [],
    }));

    res.json({
      success: true,
      users,
    });

  } catch (error) {
    console.error("Users load error:", error);

    res.status(500).json({
      error: "Failed to load users",
    });
  }
});

app.post("/api/admin/users", async (req, res) => {
  try {
    // 1. Read the JWT
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify the logged-in user's session
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const actorId = decoded.user_id;

    if (!actorId) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    // 3. Only administrators can create users
    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [actorId]
    );

    const actorRoles = actorRolesResult.rows.map((row) => row.role);

    if (!actorRoles.includes("admin")) {
      return res.status(403).json({
        error: "Only administrators can create users",
      });
    }

    // 4. Read the new user's information
    const {
      full_name,
      email,
      role,
      password,
    } = req.body;

    if (!full_name || !email || !role || !password) {
      return res.status(400).json({
        error: "All user fields are required",
      });
    }

    // 5. Validate the role
    const allowedRoles = [
      "admin",
      "dispatcher",
      "viewer",
      "customer",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
      });
    }

    // 6. Check whether the email already exists
    const existingUser = await pool.query(
      `
      SELECT id
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        error: "A user with that email already exists",
      });
    }

    // 7. Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // 8. Create the profile
    const userResult = await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".profiles
        (email, full_name, role, is_active, password_hash)
      VALUES
        ($1, $2, $3, true, $4)
      RETURNING id, email, full_name, role, is_active, created_at
      `,
      [
        email.toLowerCase(),
        full_name,
        role,
        passwordHash,
      ]
    );

    const newUser = userResult.rows[0];

    // 9. Add the user's role
    await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".user_roles
        (user_id, role, granted_by)
      VALUES
        ($1, $2, $3)
      `,
      [newUser.id, role, actorId]
    );

    res.status(201).json({
      success: true,
      user: newUser,
      roles: [role],
    });

  } catch (error) {
    console.error("User creation error:", error);

    res.status(500).json({
      error: "Failed to create user",
    });
  }
});

// Public customer registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { full_name, email, password, confirm, honeypot } = req.body;

    // Bot trap
    if (honeypot) {
      return res.status(200).json({
        success: true,
        message: "Account created — please sign in",
      });
    }

    // Validate required fields
    if (!full_name || !email || !password || !confirm) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    // Password confirmation
    if (password !== confirm) {
      return res.status(400).json({
        error: "Passwords do not match",
        field: "confirm",
      });
    }

    // Check whether email already exists
    const existingUser = await pool.query(
      `
      SELECT id
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        error: "A user with that email already exists",
        field: "email",
      });
    }

    // Hash password using the same bcrypt library as login/admin creation
    const passwordHash = await bcrypt.hash(password, 10);

    // Create customer profile
    const userResult = await pool.query(
      `
     INSERT INTO "prj_-jPU4p7xAmeh".profiles
  (id, email, full_name, role, is_active, password_hash)
VALUES
  (gen_random_uuid(), $1, $2, 'customer', true, $3)
RETURNING id, email, full_name, role, is_active, created_at
      `,
      [
        email.toLowerCase(),
        full_name,
        passwordHash,
      ]
    );

    const newUser = userResult.rows[0];

    // // Add customer role
    // await pool.query(
    //   `
    //   INSERT INTO "prj_-jPU4p7xAmeh".user_roles
    //     (user_id, role)
    //   VALUES
    //     ($1, 'customer')
    //   `,
    //   [newUser.id]
    // );

    res.status(200).json({
      success: true,
      role: "customer",
      message: "Account created — please sign in",
    });

  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      error: "Failed to create account",
    });
  }
});

// Generate a one-time local password reset link
app.post("/api/auth/reset-link", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    let actor;

    try {
      actor = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [actor.user_id]
    );

    const actorRoles = actorRolesResult.rows.map((row) => row.role);

    if (!actorRoles.includes("admin")) {
      return res.status(403).json({
        error: "Administrator permission required",
      });
    }

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, email, role
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE id = $1
      `,
      [user_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".password_reset_tokens
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [user.id]
    );

    await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".password_reset_tokens
        (user_id, email, token_hash, scope, created_by, expires_at)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      `,
      [
        user.id,
        user.email,
        tokenHash,
        user.role === "admin" ? "admin" : "customer",
        actor.user_id,
        expiresAt,
      ]
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const frontendOrigin =
      req.headers.origin ||
      "http://localhost:8081";

const resetUrl =
  `${frontendOrigin}/reset-password?token=${rawToken}` +
  `${tokenScope === "admin" ? "&scope=admin" : ""}`;

await mailTransporter.sendMail({
  from: `"${process.env.SMTP_FROM_NAME || "BtownTruck"}" <${process.env.SMTP_FROM_EMAIL}>`,
  to: user.email,
  subject: "BtownTruck Password Reset",
  text: `You requested a password reset for your BtownTruck account.

Use the following link to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this password reset, you can safely ignore this email.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>BtownTruck Password Reset</h2>

      <p>You requested a password reset for your BtownTruck account.</p>

      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>

      <p>This link will expire in <strong>1 hour</strong>.</p>

      <p>If you did not request this password reset, you can safely ignore this email.</p>
    </div>
  `,
});

console.log("Password reset email sent to:", user.email);

return res.status(200).json({
  success: true,
  email_delivery: true,
  expires_at: expiresAt.toISOString(),
});
  } catch (error) {
    console.error("Reset link generation error:", error);

    return res.status(500).json({
      error: "Could not generate reset link",
    });
  }
});

// Check a local password reset token
app.post("/api/auth/reset-link/check", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: "Reset token is required",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await pool.query(
      `
      SELECT scope, expires_at, used_at
      FROM "prj_-jPU4p7xAmeh".password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        valid: false,
        error: "Invalid reset link",
      });
    }

    const resetToken = result.rows[0];

    if (resetToken.used_at !== null) {
      return res.status(400).json({
        valid: false,
        error: "This reset link has already been used",
      });
    }

    if (new Date(resetToken.expires_at) <= new Date()) {
      return res.status(400).json({
        valid: false,
        error: "This reset link has expired",
      });
    }

    return res.status(200).json({
      valid: true,
      scope: resetToken.scope,
    });
  } catch (error) {
    console.error("Reset token check error:", error);

    return res.status(500).json({
      valid: false,
      error: "Could not validate reset link",
    });
  }
});

// Redeem a local password reset token
app.post("/api/auth/reset-link/redeem", async (req, res) => {
  try {
    const { token, password, confirm } = req.body;

    if (!token || !password || !confirm) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    if (password !== confirm) {
      return res.status(400).json({
        error: "Passwords do not match",
        field: "confirm",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const tokenResult = await client.query(
        `
        SELECT id, user_id, email, scope, expires_at, used_at
        FROM "prj_-jPU4p7xAmeh".password_reset_tokens
        WHERE token_hash = $1
        FOR UPDATE
        `,
        [tokenHash]
      );

      if (tokenResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Invalid reset link",
        });
      }

      const resetToken = tokenResult.rows[0];

      if (resetToken.used_at !== null) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This reset link has already been used",
        });
      }

      if (new Date(resetToken.expires_at) <= new Date()) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This reset link has expired",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await client.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".profiles
        SET password_hash = $1,
            password_updated_at = now()
        WHERE id = $2
        `,
        [passwordHash, resetToken.user_id]
      );

      await client.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".password_reset_tokens
        SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL
        `,
        [resetToken.user_id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        scope: resetToken.scope,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Password reset error:", error);

    return res.status(500).json({
      error: "Could not reset password",
    });
  }
});

// Request a local password reset link
app.post("/api/auth/reset-link/request", async (req, res) => {
  console.log("FORGOT PASSWORD REQUEST RECEIVED:", req.body.email);
  try {
    const { email, honeypot, scope } = req.body;

    // Silently accept honeypot submissions.
    if (honeypot) {
      return res.status(200).json({
        success: true,
        email_delivery: false,
      });
    }

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, email, role
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

    // Always return a neutral response if the account doesn't exist.
    if (userResult.rowCount === 0) {
      return res.status(200).json({
        success: true,
        email_delivery: false,
      });
    }

    const user = userResult.rows[0];

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const tokenScope =
      scope === "admin" && user.role === "admin"
        ? "admin"
        : "customer";

    // Invalidate previous unused reset links.
    await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".password_reset_tokens
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [user.id]
    );

    await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".password_reset_tokens
        (user_id, email, token_hash, scope, expires_at)
      VALUES
        ($1, $2, $3, $4, $5)
      `,
      [
        user.id,
        user.email,
        tokenHash,
        tokenScope,
        expiresAt,
      ]
    );

    const frontendOrigin =
      req.headers.origin ||
      "http://localhost:8081";

    const resetUrl =
      `${frontendOrigin}/reset-password?token=${rawToken}` +
      `${tokenScope === "admin" ? "&scope=admin" : ""}`;

try {
  await mailTransporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "BtownTruck"}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: user.email,
    subject: "Reset your BtownTruck password",
    text: `You requested a password reset for your BtownTruck account.

Use this link to reset your password:
${resetUrl}

This link expires in 1 hour.

If you did not request this password reset, you can safely ignore this email.`,
    html: `
      <p>You requested a password reset for your BtownTruck account.</p>

      <p>
        <a href="${resetUrl}">
          Reset your password
        </a>
      </p>

      <p>This link expires in 1 hour.</p>

      <p>If you did not request this password reset, you can safely ignore this email.</p>
    `,
  });

  console.log("Password reset email sent to:", user.email);

  return res.status(200).json({
    success: true,
    email_delivery: true,
    expires_at: expiresAt.toISOString(),
  });
} catch (emailError) {
  console.error("Password reset email failed:", emailError);

  return res.status(500).json({
    error: "Could not send password reset email",
  });
}
  } catch (error) {
    console.error("Password reset request error:", error);

    return res.status(500).json({
      error: "Could not process password reset request",
    });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    let session;
    try {
      session = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const { current_password, new_password, confirm } = req.body;

    if (!current_password || !new_password || !confirm) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    if (new_password !== confirm) {
      return res.status(400).json({
        error: "Passwords do not match",
        field: "confirm",
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, password_hash
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE id = $1
      LIMIT 1
      `,
      [session.user_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    const currentPasswordMatches = await bcrypt.compare(
      current_password,
      user.password_hash
    );

    if (!currentPasswordMatches) {
      return res.status(400).json({
        error: "Current password is incorrect",
        field: "current_password",
      });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".profiles
      SET password_hash = $1,
          password_updated_at = now()
      WHERE id = $2
      `,
      [passwordHash, session.user_id]
    );

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      error: "Could not change your password",
    });
  }
});

app.post("/api/public/submit-request", async (req, res) => {
  try {
    const {
      name,
      phone,
      truck_details,
      location,
      issue_description,
      urgency,
      honeypot,
    } = req.body;

    // Silently accept honeypot submissions to discourage bots
    if (honeypot) {
      return res.status(200).json({
        success: true,
      });
    }

    // Basic validation
    if (!name || !phone || !location || !issue_description) {
      return res.status(400).json({
        error: "Please complete all required fields.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".service_requests
        (
          name,
          phone,
          location,
          truck_details,
          issue_description,
          urgency,
          status
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, 'new')
      RETURNING id, created_at
      `,
      [
        name,
        phone,
        location,
        truck_details || null,
        issue_description,
        urgency || "normal",
      ]
    );

    return res.status(200).json({
      success: true,
      request_id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (error) {
    console.error("Submit service request error:", error);

    return res.status(500).json({
      error: "Could not submit your request",
    });
  }
});

app.post("/api/auth/admin-register", async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      confirm,
      honeypot,
    } = req.body;

    // Silently accept honeypot submissions
    if (honeypot) {
      return res.status(200).json({
        success: true,
        role: "pending_staff",
        approval_required: true,
      });
    }

    if (!full_name || !email || !password || !confirm) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    if (password !== confirm) {
      return res.status(400).json({
        error: "Passwords do not match",
        field: "confirm",
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        error: "A user with that email already exists",
        field: "email",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".profiles
        (
          id,
          email,
          full_name,
          role,
          is_active,
          password_hash
        )
      VALUES
        (
          gen_random_uuid(),
          $1,
          $2,
          'pending_staff',
          true,
          $3
        )
      RETURNING id, email, full_name, role, is_active
      `,
      [
        email.toLowerCase(),
        full_name,
        passwordHash,
      ]
    );

    const user = userResult.rows[0];

    return res.status(200).json({
      success: true,
      role: user.role,
      approval_required: true,
    });
  } catch (error) {
    console.error("Admin registration error:", error);

    return res.status(500).json({
      error: "Could not create that account. Please try again.",
    });
  }
});

app.get("/api/public/content", async (req, res) => {
  try {
    const [reviewsResult, notesResult, faqsResult] = await Promise.all([
      pool.query(`
        SELECT id, author, rating, text
        FROM "prj_-jPU4p7xAmeh".reviews
        WHERE is_published = true
        ORDER BY sort_order ASC
      `),

      pool.query(`
        SELECT id, title, category, read_minutes
        FROM "prj_-jPU4p7xAmeh".road_notes
        WHERE is_published = true
        ORDER BY sort_order ASC
      `),

      pool.query(`
        SELECT id, question, answer
        FROM "prj_-jPU4p7xAmeh".faqs
        WHERE is_published = true
        ORDER BY sort_order ASC
      `),
    ]);

    return res.status(200).json({
      reviews: reviewsResult.rows,
      notes: notesResult.rows,
      faqs: faqsResult.rows,
    });
  } catch (error) {
    console.error("Public content error:", error);

    return res.status(500).json({
      error: "Could not load public content",
    });
  }
});

app.get("/api/admin/audit-log", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        actor_id,
        actor_email,
        action,
        entity,
        entity_id,
        metadata,
        created_at
      FROM "prj_-jPU4p7xAmeh".audit_log
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Audit log error:", error);

    return res.status(500).json({
      error: "Could not load the audit log.",
    });
  }
});

app.patch("/api/admin/content/reviews/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [decoded.user_id]
    );

    const roles = actorRolesResult.rows.map((row) => row.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Review text is required" });
    }

    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".reviews
      SET text = $1
      WHERE id = $2
      RETURNING id, author, rating, text, is_published, sort_order
      `,
      [text.trim(), req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    return res.status(200).json({
      success: true,
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Update review error:", error);
    return res.status(500).json({
      error: "Could not update the review",
    });
  }
});


app.post("/api/admin/content/reviews", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [decoded.user_id]
    );

    const roles = actorRolesResult.rows.map((row) => row.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { author, rating, text, sort_order } = req.body;

    if (!author || !text) {
      return res.status(400).json({
        error: "Author and review text are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".reviews
        (author, rating, text, is_published, sort_order)
      VALUES
        ($1, $2, $3, false, $4)
      RETURNING id, author, rating, text, is_published, sort_order, created_at
      `,
      [
        author,
        rating || 5,
        text,
        sort_order || 1,
      ]
    );

    return res.status(201).json({
      success: true,
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Create review error:", error);
    return res.status(500).json({
      error: "Could not create the review",
    });
  }
});

// -------------------------------------------------------------
// Reviews - Admin: list all reviews
// -------------------------------------------------------------
app.get("/api/admin/content/reviews", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [decoded.user_id]
    );

    const roles = actorRolesResult.rows.map((row) => row.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        author,
        rating,
        text,
        is_published,
        sort_order
      FROM "prj_-jPU4p7xAmeh".reviews
      ORDER BY sort_order ASC
      `
    );

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Admin reviews load error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    return res.status(500).json({
      error: "Could not load reviews.",
    });
  }
});


// -------------------------------------------------------------
// Reviews - Admin: publish / unpublish
// -------------------------------------------------------------
app.patch("/api/admin/content/reviews/:id/publish", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [decoded.user_id]
    );

    const roles = actorRolesResult.rows.map((row) => row.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const { is_published } = req.body;

    if (typeof is_published !== "boolean") {
      return res.status(400).json({
        error: "is_published must be a boolean.",
      });
    }

    const reviewId = Number(req.params.id);

    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({
        error: "Invalid review ID.",
      });
    }

    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".reviews
      SET is_published = $1
      WHERE id = $2
      RETURNING
        id,
        author,
        rating,
        text,
        is_published,
        sort_order
      `,
      [is_published, reviewId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Review not found.",
      });
    }

    return res.status(200).json({
      success: true,
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Admin review publish error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    return res.status(500).json({
      error: "Could not update review publication status.",
    });
  }
});

// -------------------------------------------------------------
// Road Notes - Admin: list all road notes
// -------------------------------------------------------------
app.get("/api/admin/content/road-notes", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const actorRolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [decoded.user_id]
    );

    const roles = actorRolesResult.rows.map((row) => row.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        body,
        category,
        read_minutes,
        is_published,
        sort_order
      FROM "prj_-jPU4p7xAmeh".road_notes
      ORDER BY sort_order ASC
      `
    );

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Admin road notes load error:", error);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    return res.status(500).json({
      error: "Could not load road notes.",
    });
  }
});


// -------------------------------------------------------------
// Road Notes - Admin: publish / unpublish
// -------------------------------------------------------------
app.patch(
  "/api/admin/content/road-notes/:id/publish",
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const actorRolesResult = await pool.query(
        `
        SELECT role
        FROM "prj_-jPU4p7xAmeh".user_roles
        WHERE user_id = $1
        `,
        [decoded.user_id]
      );

      const roles = actorRolesResult.rows.map((row) => row.role);

      if (!roles.includes("admin")) {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const { is_published } = req.body;

      if (typeof is_published !== "boolean") {
        return res.status(400).json({
          error: "is_published must be a boolean.",
        });
      }

      const noteId = Number(req.params.id);

      if (!Number.isInteger(noteId)) {
        return res.status(400).json({
          error: "Invalid road note ID.",
        });
      }

      const result = await pool.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".road_notes
        SET
          is_published = $1,
          published_at = CASE
            WHEN $1 = true THEN NOW()
            ELSE NULL
          END
        WHERE id = $2
        RETURNING
          id,
          title,
          body,
          category,
          read_minutes,
          is_published,
          sort_order
        `,
        [is_published, noteId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Road note not found.",
        });
      }

      return res.status(200).json({
        success: true,
        row: result.rows[0],
      });
    } catch (error) {
      console.error("Admin road note publish error:", error);

      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          error: "Invalid or expired session.",
        });
      }

      return res.status(500).json({
        error: "Could not update road note publication status.",
      });
    }
  }
);


// -------------------------------------------------------------
// Road Notes - Admin: update
// -------------------------------------------------------------
app.patch(
  "/api/admin/content/road-notes/:id",
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const actorRolesResult = await pool.query(
        `
        SELECT role
        FROM "prj_-jPU4p7xAmeh".user_roles
        WHERE user_id = $1
        `,
        [decoded.user_id]
      );

      const roles = actorRolesResult.rows.map((row) => row.role);

      if (!roles.includes("admin")) {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const {
        title,
        category,
        read_minutes,
        body,
      } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({
          error: "Title is required.",
        });
      }

      if (typeof body !== "string") {
        return res.status(400).json({
          error: "Body is required.",
        });
      }

      const noteId = Number(req.params.id);

      if (!Number.isInteger(noteId)) {
        return res.status(400).json({
          error: "Invalid road note ID.",
        });
      }

      const result = await pool.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".road_notes
        SET
          title = $1,
          category = $2,
          read_minutes = $3,
          body = $4
        WHERE id = $5
        RETURNING
          id,
          title,
          body,
          category,
          read_minutes,
          is_published,
          sort_order
        `,
        [
          title.trim(),
          category ? category.trim() : null,
          read_minutes ?? null,
          body,
          noteId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Road note not found.",
        });
      }

      return res.status(200).json({
        success: true,
        row: result.rows[0],
      });
    } catch (error) {
      console.error("Admin road note update error:", error);

      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          error: "Invalid or expired session.",
        });
      }

      return res.status(500).json({
        error: "Could not update road note.",
      });
    }
  }
);


// -------------------------------------------------------------
// Road Notes - Admin: create
// -------------------------------------------------------------
app.post(
  "/api/admin/content/road-notes",
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const actorRolesResult = await pool.query(
        `
        SELECT role
        FROM "prj_-jPU4p7xAmeh".user_roles
        WHERE user_id = $1
        `,
        [decoded.user_id]
      );

      const roles = actorRolesResult.rows.map((row) => row.role);

      if (!roles.includes("admin")) {
        return res.status(403).json({
          error: "Admin access required",
        });
      }

      const {
        title,
        category,
        read_minutes,
        body,
        sort_order,
      } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({
          error: "Title is required.",
        });
      }

      if (typeof body !== "string") {
        return res.status(400).json({
          error: "Body is required.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "prj_-jPU4p7xAmeh".road_notes
        (
          title,
          category,
          read_minutes,
          body,
          is_published,
          sort_order
        )
        VALUES
        ($1, $2, $3, $4, false, $5)
        RETURNING
          id,
          title,
          body,
          category,
          read_minutes,
          is_published,
          sort_order
        `,
        [
          title.trim(),
          category ? category.trim() : null,
          read_minutes ?? null,
          body,
          sort_order ?? 1,
        ]
      );

      return res.status(201).json({
        success: true,
        row: result.rows[0],
      });
    } catch (error) {
      console.error("Admin road note create error:", error);

      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          error: "Invalid or expired session.",
        });
      }

      return res.status(500).json({
        error: "Could not create road note.",
      });
    }
  }
);

// ============================================================
// ADMIN CONTENT - FAQs
// ============================================================

app.get("/api/admin/content/faqs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (!roles.includes("admin") && !roles.includes("dispatcher") && !roles.includes("viewer")) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const result = await pool.query(`
      SELECT
        id,
        question,
        answer,
        sort_order,
        is_published
      FROM "prj_-jPU4p7xAmeh".faqs
      ORDER BY sort_order ASC
    `);

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Load FAQs error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not load FAQs.",
    });
  }
});


app.patch("/api/admin/content/faqs/:id/publish", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (
      !roles.includes("admin") &&
      !roles.includes("dispatcher") &&
      !roles.includes("viewer")
    ) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const { is_published } = req.body;

    if (typeof is_published !== "boolean") {
      return res.status(400).json({
        error: "is_published must be true or false.",
      });
    }

    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".faqs
      SET is_published = $1
      WHERE id = $2
      RETURNING id, question, answer, sort_order, is_published
      `,
      [is_published, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "FAQ not found.",
      });
    }

    return res.status(200).json({
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Publish FAQ error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not update FAQ publication status.",
    });
  }
});


app.patch("/api/admin/content/faqs/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (
      !roles.includes("admin") &&
      !roles.includes("dispatcher") &&
      !roles.includes("viewer")
    ) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        error: "Question and answer are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".faqs
      SET
        question = $1,
        answer = $2
      WHERE id = $3
      RETURNING id, question, answer, sort_order, is_published
      `,
      [question, answer, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "FAQ not found.",
      });
    }

    return res.status(200).json({
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Update FAQ error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not update FAQ.",
    });
  }
});


app.post("/api/admin/content/faqs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (
      !roles.includes("admin") &&
      !roles.includes("dispatcher") &&
      !roles.includes("viewer")
    ) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const { question, answer, sort_order } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        error: "Question and answer are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO "prj_-jPU4p7xAmeh".faqs
        (question, answer, sort_order, is_published)
      VALUES
        ($1, $2, $3, false)
      RETURNING id, question, answer, sort_order, is_published
      `,
      [
        question,
        answer,
        Number.isFinite(Number(sort_order))
          ? Number(sort_order)
          : 1,
      ]
    );

    return res.status(201).json({
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Create FAQ error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not create FAQ.",
    });
  }
});


app.patch("/api/admin/content/faqs/:id/reorder", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (
      !roles.includes("admin") &&
      !roles.includes("dispatcher") &&
      !roles.includes("viewer")
    ) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const { swap_id } = req.body;

    if (!swap_id) {
      return res.status(400).json({
        error: "swap_id is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const currentResult = await client.query(
        `
        SELECT id, sort_order
        FROM "prj_-jPU4p7xAmeh".faqs
        WHERE id = $1
        `,
        [req.params.id]
      );

      const swapResult = await client.query(
        `
        SELECT id, sort_order
        FROM "prj_-jPU4p7xAmeh".faqs
        WHERE id = $1
        `,
        [swap_id]
      );

      if (currentResult.rowCount === 0 || swapResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "FAQ not found.",
        });
      }

      const current = currentResult.rows[0];
      const swap = swapResult.rows[0];

      await client.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".faqs
        SET sort_order = $1
        WHERE id = $2
        `,
        [swap.sort_order, current.id]
      );

      await client.query(
        `
        UPDATE "prj_-jPU4p7xAmeh".faqs
        SET sort_order = $1
        WHERE id = $2
        `,
        [current.sort_order, swap.id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Reorder FAQ error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not reorder FAQs.",
    });
  }
});


app.delete("/api/admin/content/faqs/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((r) => r.role);

    if (!roles.includes("admin")) {
      return res.status(403).json({
        error: "Only administrators can delete FAQs.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM "prj_-jPU4p7xAmeh".faqs
      WHERE id = $1
      RETURNING id
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "FAQ not found.",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Delete FAQ error:", error);

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    return res.status(500).json({
      error: "Could not delete FAQ.",
    });
  }
});

// ============================================================
// ADMIN SERVICE REQUESTS
// ============================================================

app.get("/api/admin/requests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((row) => row.role);

    const allowedRoles = ["admin", "dispatcher", "viewer"];

    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        location,
        truck_details,
        issue_description,
        urgency,
        status,
        assigned_to,
        internal_notes,
        created_at,
        updated_at
      FROM "prj_-jPU4p7xAmeh".service_requests
      ORDER BY created_at DESC
      LIMIT 300
      `
    );

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Load requests error:", error);

    return res.status(500).json({
      error: "Could not load service requests.",
    });
  }
});


app.get("/api/admin/request-staff", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((row) => row.role);

    const allowedRoles = ["admin", "dispatcher", "viewer"];

    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        created_at
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE is_active = true
        AND role <> 'viewer'
      ORDER BY full_name NULLS LAST, email ASC
      `
    );

    return res.status(200).json({
      rows: result.rows,
    });
  } catch (error) {
    console.error("Load request staff error:", error);

    return res.status(500).json({
      error: "Could not load staff.",
    });
  }
});


app.patch("/api/admin/requests/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    const rolesResult = await pool.query(
      `
      SELECT role
      FROM "prj_-jPU4p7xAmeh".user_roles
      WHERE user_id = $1
      `,
      [payload.user_id]
    );

    const roles = rolesResult.rows.map((row) => row.role);

    const allowedRoles = ["admin", "dispatcher"];

    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({
        error: "Permission denied — your role cannot change requests.",
      });
    }

    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({
        error: "Invalid request ID.",
      });
    }

    const { status, assigned_to, internal_notes } = req.body;

    const updates = [];
    const values = [];
    let parameterIndex = 1;

    if (status !== undefined) {
      const allowedStatuses = [
        "new",
        "dispatched",
        "in_progress",
        "completed",
        "cancelled",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid status.",
        });
      }

      updates.push(`status = $${parameterIndex++}`);
      values.push(status);
    }

    if (assigned_to !== undefined) {
      if (assigned_to !== null && assigned_to !== "") {
        const assignedResult = await pool.query(
          `
          SELECT id
          FROM "prj_-jPU4p7xAmeh".profiles
          WHERE id = $1
            AND is_active = true
            AND role IN ('admin', 'dispatcher')
          LIMIT 1
          `,
          [assigned_to]
        );

        if (assignedResult.rowCount === 0) {
          return res.status(400).json({
            error: "Invalid staff assignment.",
          });
        }

        updates.push(`assigned_to = $${parameterIndex++}`);
        values.push(assigned_to);
      } else {
        updates.push(`assigned_to = NULL`);
      }
    }

    if (internal_notes !== undefined) {
      if (typeof internal_notes !== "string") {
        return res.status(400).json({
          error: "Internal notes must be text.",
        });
      }

      updates.push(`internal_notes = $${parameterIndex++}`);
      values.push(internal_notes.slice(0, 4000));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No changes supplied.",
      });
    }

    updates.push("updated_at = NOW()");

    values.push(requestId);

    const result = await pool.query(
      `
      UPDATE "prj_-jPU4p7xAmeh".service_requests
      SET ${updates.join(", ")}
      WHERE id = $${parameterIndex}
      RETURNING
        id,
        name,
        phone,
        email,
        location,
        truck_details,
        issue_description,
        urgency,
        status,
        assigned_to,
        internal_notes,
        created_at,
        updated_at
      `,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Service request not found.",
      });
    }

    return res.status(200).json({
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Update request error:", error);

    return res.status(500).json({
      error: "Could not save that change.",
    });
  }
});

const JWT_SECRET = process.env.JWT_SECRET;

const PORT = process.env.PORT || 3001;

// ============================================================
// ADMIN CONTENT - SITE CONTENT
// ============================================================

const requireStaffForSiteContent = async (req, res) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication required.",
    });
    return null;
  }

  const token = authHeader.slice(7);

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401).json({
      error: "Invalid or expired session.",
    });
    return null;
  }

  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active
      FROM "prj_-jPU4p7xAmeh".profiles
      WHERE id = $1
      LIMIT 1
    `,
    [decoded.user_id],
  );

  if (!result.rows.length) {
    res.status(403).json({
      error: "User profile not found.",
    });
    return null;
  }

  const user = result.rows[0];

  if (!user.is_active || !["admin", "dispatcher"].includes(user.role)) {
    res.status(403).json({
      error: "Permission denied — your role cannot change site content.",
    });
    return null;
  }

  return user;
};


// ------------------------------------------------------------
// Load all site content
// ------------------------------------------------------------

// ------------------------------------------------------------
// Public site content
// ------------------------------------------------------------

app.get("/api/content/site-content", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        key,
        value
      FROM "prj_-jPU4p7xAmeh".site_content
      ORDER BY sort_order ASC
    `);

    return res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Load public site content error:", error);

    return res.status(500).json({
      error: "Could not load site content.",
    });
  }
});

// ------------------------------------------------------------
// Public site content
// Read-only — used by the public landing page
// ------------------------------------------------------------

app.get("/api/content/site-content", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        key,
        value
      FROM "prj_-jPU4p7xAmeh".site_content
      ORDER BY sort_order ASC
    `);

    return res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Load public site content error:", error);

    return res.status(500).json({
      error: "Could not load site content.",
    });
  }
});
app.get("/api/admin/content/site-content", async (req, res) => {
  try {
    const user = await requireStaffForSiteContent(req, res);
    if (!user) return;

    const result = await pool.query(`
      SELECT
        key,
        type,
        value,
        label,
        section,
        sort_order
      FROM "prj_-jPU4p7xAmeh".site_content
      ORDER BY sort_order ASC
    `);

    return res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Load site content error:", error);

    return res.status(500).json({
      error: "Could not load the site content.",
    });
  }
});

// ------------------------------------------------------------
// Public site content
// ------------------------------------------------------------

app.get("/api/content/site-content", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        key,
        value
      FROM "prj_-jPU4p7xAmeh".site_content
      ORDER BY sort_order ASC
    `);

    return res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Load public site content error:", error);

    return res.status(500).json({
      error: "Could not load site content.",
    });
  }
});

// ------------------------------------------------------------
// Update text/content value
// ------------------------------------------------------------

app.patch("/api/admin/content/site-content/:key", async (req, res) => {
  try {
    const user = await requireStaffForSiteContent(req, res);
    if (!user) return;

    const key = req.params.key;
    const value = typeof req.body.value === "string"
      ? req.body.value.slice(0, 20000)
      : "";

    const result = await pool.query(
      `
        UPDATE "prj_-jPU4p7xAmeh".site_content
        SET
          value = $1,
          updated_at = NOW()
        WHERE key = $2
        RETURNING
          key,
          type,
          value,
          label,
          section,
          sort_order
      `,
      [value, key],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Site content item not found.",
      });
    }

    return res.json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update site content error:", error);

    return res.status(500).json({
      error: "Could not save that change.",
    });
  }
});


// ------------------------------------------------------------
// Upload site image
// ------------------------------------------------------------

app.post(
  "/api/admin/content/site-content/:key/image",
  uploadSiteMedia.single("file"),
  async (req, res) => {
    try {
      const user = await requireStaffForSiteContent(req, res);
      if (!user) return;

      if (!req.file) {
        return res.status(400).json({
          error: "No image was uploaded.",
        });
      }

      const key = req.params.key;

      const check = await pool.query(
        `
          SELECT key
          FROM "prj_-jPU4p7xAmeh".site_content
          WHERE key = $1
            AND type = 'image'
          LIMIT 1
        `,
        [key],
      );

      if (!check.rows.length) {
        return res.status(404).json({
          error: "Image content item not found.",
        });
      }

      const url = `/site-media/${req.file.filename}`;

      const result = await pool.query(
        `
          UPDATE "prj_-jPU4p7xAmeh".site_content
          SET
            value = $1,
            updated_at = NOW()
          WHERE key = $2
          RETURNING
            key,
            type,
            value,
            label,
            section,
            sort_order
        `,
        [url, key],
      );

      return res.json({
        data: result.rows[0],
        url,
      });
    } catch (error) {
      console.error("Upload site image error:", error);

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Could not upload the image.",
      });
    }
  },
);

// React SPA fallback
// Must come after all API routes.
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(DIST_DIR, "index.html"));
  }

  next();
});

pool.query(`
  SELECT
    current_database() AS database,
    current_user AS user,
    current_schema() AS schema,
    current_setting('search_path') AS search_path
`)
.then(result => {
  console.log("=== DATABASE CHECK ===");
  console.log(result.rows[0]);
})
.catch(error => {
  console.error("=== DATABASE CHECK ERROR ===", error.message);
});

pool.query(`
  SELECT pg_get_functiondef(
    '"prj_-jPU4p7xAmeh".log_audit(uuid, text, text, text, text, jsonb)'::regprocedure
  ) AS definition
`)
.then(result => {
  console.log("=== LOG_AUDIT DEFINITION ===");
  console.log(result.rows[0]?.definition);
})
.catch(error => {
  console.error("=== FUNCTION CHECK ERROR ===", error.message);
});
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

