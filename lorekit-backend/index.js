const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const worldRoutes = require('./src/routes/worldRoutes');
const authRoutes = require('./src/routes/authRoutes');

require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.use('/worlds', worldRoutes);
app.use('/documents', require('./src/routes/documentRoutes'));
app.use('/personalizations', require('./src/routes/personalizationRoutes'));
app.use('/locations', require('./src/routes/locationRoutes'));
app.use('/location-categories', require('./src/routes/locationCategoryRoutes'));

app.use('/images', require('./src/routes/imageRoutes'));
app.use('/storage', express.static('./storage/'));

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

