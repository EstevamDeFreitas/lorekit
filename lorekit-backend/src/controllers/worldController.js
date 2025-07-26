const prisma = require('../prismaClient');

async function getWorlds(req, res) {
  try {
    const worlds = await prisma.world.findMany();
    res.json(worlds);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mundos.' });
  }
}

async function getWorldById(req, res) {
  const { id } = req.params;
  try {
    const world = await prisma.world.findUnique({
      where: { id },
    });
    if (!world) return res.status(404).json({ error: 'Mundo não encontrado' });
    res.json(world);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mundo' });
  }
}

async function createWorld(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const world = await prisma.world.create({
      data: { name, description },
    });
    res.status(201).json(world);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar mundo' });
  }
}

async function updateWorld(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const updatedWorld = await prisma.world.update({
      where: { id },
      data: { name, description },
    });
    res.json(updatedWorld);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar mundo' });
  }
}

async function deleteWorld(req, res) {
  const { id } = req.params;

  try {
    await prisma.world.delete({ where: { id } });
    res.json({ message: 'Mundo deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar mundo' });
  }
}

module.exports = {
  getWorlds,
  getWorldById,
  createWorld,
  updateWorld,
  deleteWorld,
};