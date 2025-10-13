const express = require('express');
const router = express.Router();
const imageRepository = require('../repositories/image.repository');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityTable = req.body.entityTable?.toLowerCase() || 'uploads';
    cb(null, `./storage/images/${entityTable}`);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({ storage });

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { entityTable, entityId, usageKey } = req.body;
    const filePath = req.file.path.replace(/\\/g, '/');

    const image = await imageRepository.createImage({
      entityTable,
      entityId,
      usageKey,
      filePath,
    });

    res.json(image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
});

router.get('/:entityTable/:entityId/:usageKey', async (req, res) => {
  try {
    const { entityTable, entityId, usageKey } = req.params;
    const images = await imageRepository.getImagesByEntity(entityTable, entityId, usageKey);
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar imagens' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = await imageRepository.getImageById(id);

    if (!image) return res.status(404).json({ error: 'Imagem não encontrada' });

    fs.unlinkSync(image.filePath);
    await imageRepository.deleteImage(id);

    res.json({ message: 'Imagem removida com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover imagem' });
  }
});

module.exports = router;