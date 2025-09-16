const express = require('express');
const router = express.Router();
const personalizationRepository = require('../repositories/personalization.repository');

router.get('/entity/:entityTable/:entityId', async (req, res) => {
    const { entityTable, entityId } = req.params;

    try {
        const personalization = await personalizationRepository.getEntityPersonalization(entityId, entityTable);
        if (!personalization) {
            return res.status(404).json({ error: 'Personalização não encontrada' });
        }
        res.json(personalization);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar personalização: ' + error.message });
    }
});

router.post('/', async (req, res) => {
    const personalizationData = req.body;
    try {
        const createdPersonalization = await personalizationRepository.createPersonalization(personalizationData);
        res.status(201).json(createdPersonalization);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar personalização: ' + error.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const personalizationData = req.body;

    try {
        const updatedPersonalization = await personalizationRepository.updatePersonalization(id, personalizationData);
        if (!updatedPersonalization) {
            return res.status(404).json({ error: 'Personalização não encontrada' });
        }
        res.json(updatedPersonalization);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar personalização: ' + error.message });
    }
});

module.exports = router;