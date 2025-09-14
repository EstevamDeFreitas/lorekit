const express = require('express');
const router = express.Router();
const documentRepository = require('../repositories/document.repository');

router.get('/:id', async (req, res) => {
    try {
        const document = await documentRepository.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Documento não encontrado' });
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar documento: ' + error.message });
    }
});

router.get('/entity/:entityTable/:entityId', async (req, res) => {
    const { entityTable, entityId } = req.params;
    try {
        const documents = await documentRepository.getEntityDocuments(entityId, entityTable);
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar documentos: ' + error.message });
    }
});

router.post('/', async (req, res) => {
    const documentData = req.body;
    try {
        const createdDocument = await documentRepository.createDocument(documentData);
        res.status(201).json(createdDocument);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar documento: ' + error.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const documentData = req.body;
    try {
        const updatedDocument = await documentRepository.updateDocument(id, documentData);
        if (!updatedDocument) {
            return res.status(404).json({ error: 'Documento não encontrado' });
        }
        res.json(updatedDocument);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar documento: ' + error.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await documentRepository.deleteDocument(id);
        if (result.error) {
            return res.status(404).json({ error: result.error });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir documento: ' + error.message });
    }
});