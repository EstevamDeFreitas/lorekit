const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const auth = require('./src/middleware/authMiddleware');

const worldRoutes = require('./src/routes/worldRoutes');
const authRoutes = require('./src/routes/authRoutes');

require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.use('/worlds', auth, worldRoutes);

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

