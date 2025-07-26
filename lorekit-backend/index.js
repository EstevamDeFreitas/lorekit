const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/world', async (req, res) => {
    const mundos = await prisma.mundo.findMany();
    res.json(mundos);
});

app.post('/world', async (req, res) => {
    console.log('Requisição POST recebida:', req);

    const { nome } = req.body;
    const novoMundo = await prisma.world.create({
        data: { nome }
    });
    res.status(201).json(novoMundo);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

