const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const worldRoutes = require('./src/routes/worldRoutes');

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use('/worlds', worldRoutes);

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

