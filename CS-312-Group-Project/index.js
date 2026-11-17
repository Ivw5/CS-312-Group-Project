
import express from "express";
import session from "express-session";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { authRouter, requireLogin } from "./auth.js";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const port = 3001;

// Basic application setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public"), {
  index: false
}));

// Sessions for local development
app.use(session({
  secret: process.env.SESSION_SECRET ||
    randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  }
}));

app.use(authRouter);

// Temporary recipe storage.
// Later, replace this with PostgreSQL.
const recipes = [];
let nextRecipeId = 1;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function layout(title, content) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)} | Stir Social</title>
    <link rel="stylesheet" href="/index.css">
  </head>
  <body>
    <main style="max-width:700px;margin:50px auto;padding:20px">
      <h1>${escapeHtml(title)}</h1>
      ${content}
      <p><a href="/">Home</a> |
      <a href="/recipes">Recipes</a> |
      <a href="/account">Account</a></p>
    </main>
  </body>
  </html>`;
}

// Existing homepage from your teammates
app.get("/", (req, res) => {
  res.render("index");
});

// Existing recipe design preview
app.get("/addrecipe", (req, res) => {
  res.render("addrecipe");
});

// Account information
app.get("/account", requireLogin, (req, res) => {
  res.send(layout("My Account", `
    <p>Logged in as:
      <strong>${escapeHtml(req.session.username)}</strong>
    </p>
    <p>Your user ID: ${req.session.userId}</p>
    <form action="/logout" method="POST">
      <button type="submit">Log Out</button>
    </form>
  `));
});

// Display recipes
app.get("/recipes", (req, res) => {
  const cards = recipes.map(recipe => `
    <article style="border:1px solid #ccc;padding:16px;margin:16px 0">
      <h2>${escapeHtml(recipe.title)}</h2>
      <p><strong>Ingredients:</strong>
        ${escapeHtml(recipe.ingredients)}</p>
      <p><strong>Instructions:</strong>
        ${escapeHtml(recipe.instructions)}</p>
      <p>Created by: ${escapeHtml(recipe.author)}</p>
      <a href="/recipes/${recipe.id}/edit">Edit</a>
      <form method="POST"
        action="/recipes/${recipe.id}/delete">
        <button type="submit">Delete</button>
      </form>
    </article>
  `).join("");

  res.send(layout("Recipes", `
    <p><a href="/recipes/new">Create a Recipe</a></p>
    ${cards || "<p>No recipes have been submitted yet.</p>"}
  `));
});

// Temporary working recipe form for testing.
// The teammate's /addrecipe design remains unchanged.
app.get("/recipes/new", requireLogin, (req, res) => {
  res.send(layout("Create Recipe", `
    <form method="POST" action="/recipes">
      <p><label>Recipe Title<br>
        <input name="title" required maxlength="150">
      </label></p>

      <p><label>Ingredients<br>
        <textarea name="ingredients" required></textarea>
      </label></p>

      <p><label>Instructions<br>
        <textarea name="instructions" required></textarea>
      </label></p>

      <button type="submit">Save Recipe</button>
    </form>
  `));
});

// Create recipe
app.post("/recipes", requireLogin, (req, res) => {
  const { title, ingredients, instructions } = req.body;

  if (
    typeof title !== "string" ||
    typeof ingredients !== "string" ||
    typeof instructions !== "string" ||
    !title.trim() ||
    !ingredients.trim() ||
    !instructions.trim() ||
    title.length > 150
  ) {
    return res.status(400).send("Invalid recipe information.");
  }

  recipes.push({
    id: nextRecipeId++,
    title: title.trim(),
    ingredients: ingredients.trim(),
    instructions: instructions.trim(),
    ownerId: req.session.userId,
    author: req.session.username
  });

  res.redirect("/recipes");
});

// Check recipe ownership
function requireRecipeOwner(req, res, next) {
  const id = Number(req.params.id);

  const recipe = recipes.find(r => r.id === id);

  if (!recipe) {
    return res.status(404).send("Recipe not found.");
  }

  if (recipe.ownerId !== req.session.userId) {
    return res.status(403).send(
      "Access denied. You do not own this recipe."
    );
  }

  req.recipe = recipe;
  next();
}

// Edit recipe page
app.get(
  "/recipes/:id/edit",
  requireLogin,
  requireRecipeOwner,
  (req, res) => {
    const recipe = req.recipe;

    res.send(layout("Edit Recipe", `
      <form method="POST"
        action="/recipes/${recipe.id}/edit">
        <p><label>Title<br>
          <input name="title"
            value="${escapeHtml(recipe.title)}"
            maxlength="150" required>
        </label></p>

        <p><label>Ingredients<br>
          <textarea name="ingredients"
            required>${escapeHtml(recipe.ingredients)}</textarea>
        </label></p>

        <p><label>Instructions<br>
          <textarea name="instructions"
            required>${escapeHtml(recipe.instructions)}</textarea>
        </label></p>

        <button type="submit">Save Changes</button>
      </form>
    `));
  }
);

// Save edits
app.post(
  "/recipes/:id/edit",
  requireLogin,
  requireRecipeOwner,
  (req, res) => {
    const { title, ingredients, instructions } = req.body;

    if (
      typeof title !== "string" ||
      typeof ingredients !== "string" ||
      typeof instructions !== "string" ||
      !title.trim() ||
      !ingredients.trim() ||
      !instructions.trim() ||
      title.length > 150
    ) {
      return res.status(400).send("Invalid recipe information.");
    }

    req.recipe.title = title.trim();
    req.recipe.ingredients = ingredients.trim();
    req.recipe.instructions = instructions.trim();

    res.redirect("/recipes");
  }
);

// Delete recipe
app.post(
  "/recipes/:id/delete",
  requireLogin,
  requireRecipeOwner,
  (req, res) => {
    const index = recipes.findIndex(
      r => r.id === req.recipe.id
    );

    recipes.splice(index, 1);
    res.redirect("/recipes");
  }
);

// Start the server
app.listen(port, () => {
  console.log(
    `Stir Social running at http://localhost:${port}`
  );
});
