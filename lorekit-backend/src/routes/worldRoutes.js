const express = require('express');
const router = express.Router();
const worldRepository = require('../repositories/world.repository');

router.get('/', async (req, res) => {
    try {
        const worlds = await worldRepository.getWorlds();
        res.json(worlds);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mundos.' + error.message });
    }
});


router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const world = await worldRepository.getWorldById(id);
        if (!world) return res.status(404).json({ error: 'Mundo não encontrado' });
        res.json(world);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mundo' });
    }
});


router.post('/', async (req, res) => {
    const { name, description } = req.body;
    try {
        const world = await worldRepository.createWorld({ name, description });
        res.status(201).json(world);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar mundo' + error.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        const updatedWorld = await worldRepository.updateWorld({ id, name, description });
        res.json(updatedWorld);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar mundo' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await worldRepository.deleteWorld(id);
        res.json({ message: 'Mundo deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar mundo' });
    }
});

module.exports = router;