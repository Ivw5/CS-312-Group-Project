
import express from "express";
import bcrypt from "bcryptjs";

export const authRouter = express.Router();

// Temporary users. Replace with PostgreSQL later.
const users = [];
let nextUserId = 1;

export function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function page(title, content) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)} | Stir Social</title>
    <link rel="stylesheet" href="/index.css">
  </head>
  <body>
    <main style="max-width:500px;margin:50px auto;padding:20px">
      <h1>${escapeHtml(title)}</h1>
      ${content}
      <p><a href="/">Back to Home</a></p>
    </main>
  </body>
  </html>`;
}

// Signup page
authRouter.get("/signup", (req, res) => {
  res.send(page("Create Account", `
    <form method="POST" action="/signup">
      <p><label>Username<br>
        <input name="username" required maxlength="60">
      </label></p>

      <p><label>Email<br>
        <input type="email" name="email" required>
      </label></p>

      <p><label>Password<br>
        <input type="password" name="password"
          minlength="8" required>
      </label></p>

      <button type="submit">Sign Up</button>
    </form>
    <p><a href="/login">Already have an account? Log in</a></p>
  `));
});

// Create a user
authRouter.post("/signup", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const cleanUsername =
      typeof username === "string" ? username.trim() : "";

    const cleanEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (
      !cleanUsername ||
      cleanUsername.length > 60 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254 ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).send(
        "Invalid signup information."
      );
    }

    if (users.some(user => user.email === cleanEmail)) {
      return res.status(409).send(
        "That email is already registered."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    users.push({
      id: nextUserId++,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash
    });

    res.redirect("/login");
  } catch (error) {
    next(error);
  }
});

// Login page
authRouter.get("/login", (req, res) => {
  res.send(page("Log In", `
    <form method="POST" action="/login">
      <p><label>Email<br>
        <input type="email" name="email" required>
      </label></p>

      <p><label>Password<br>
        <input type="password" name="password" required>
      </label></p>

      <button type="submit">Log In</button>
    </form>
    <p><a href="/signup">Create an account</a></p>
  `));
});

// Log in an existing user
authRouter.post("/login", async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body.password;

    const user = users.find(u => u.email === email);

    if (
      !user ||
      typeof password !== "string" ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).send(
        "Invalid email or password."
      );
    }

    req.session.regenerate(error => {
      if (error) return next(error);

      req.session.userId = user.id;
      req.session.username = user.username;

      req.session.save(error => {
        if (error) return next(error);
        res.redirect("/account");
      });
    });
  } catch (error) {
    next(error);
  }
});

// Log out
authRouter.post("/logout", (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);

    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});
