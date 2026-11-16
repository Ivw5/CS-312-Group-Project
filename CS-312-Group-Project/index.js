console.log("Starting RecipeSharing server...");

import express from 'express'
const app = express();

import path from 'path'

import pg from 'pg'

import session from 'express-session'

const RecipeSharing = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'RecipeSharing',
    password: 'IzzyNAU1',
    port: 5432
});

RecipeSharing.connect();

import bodyParser from 'body-parser'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

const port = 3001

app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

app.use(express.urlencoded({ extended: true }));


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    console.log('Rendering file:', path.join(__dirname, 'views', 'index.ejs'));
    res.render('index');
});

app.get('/addrecipe', (req, res) => {
    res.render('addrecipe');
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})