const prisma = require('../prismaClient');

async function createImage({ entityTable, entityId, usageKey, filePath }) {
  return prisma.imagem.create({
    data: { entityTable, entityId, usageKey, filePath },
  });
}

async function getImagesByEntity(entityTable, entityId, usageKey) {
  return prisma.imagem.findMany({
    where: { entityTable, entityId, usageKey },
  });
}

async function deleteImage(id) {
  return prisma.imagem.delete({
    where: { id },
  });
}

async function getImageById(id) {
  return prisma.imagem.findUnique({
    where: { id },
  });
}

module.exports = {
  createImage,
  getImagesByEntity,
  deleteImage,
  getImageById,
};