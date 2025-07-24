const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// GET /mundos
app.get('/mundos', async (req, res) => {
    const mundos = await prisma.mundo.findMany();
    res.json(mundos);
});

// POST /mundos
app.post('/mundos', async (req, res) => {
    console.log('Requisição POST recebida:', req);

    const { nome } = req.body;
    const novoMundo = await prisma.mundo.create({
        data: { nome }
    });
    res.status(201).json(novoMundo);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

