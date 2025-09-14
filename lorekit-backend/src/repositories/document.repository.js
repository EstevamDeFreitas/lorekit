const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

async function getEntityDocuments(entityId, entityTable) {

  return await prisma.document.findMany({
    where: {
      entityId,
      entityTable
    }
  });
}

async function getDocumentById(id) {
  const document = await prisma.document.findFirst({
    where: {
      id: {
        equals: id,
      },
    },
  });
  return document;
}

async function createDocument(document) {

  if (!document.title) return { error: 'Titulo é obrigatório' };
  if (!document.entityId) return { error: 'ID da entidade é obrigatório' };
  if (!document.entityTable) return { error: 'Tabela da entidade é obrigatória' };

  const createdDocument = await prisma.document.create({
    data: document,
  });
  return createdDocument;
}

async function updateDocument(id, document) {

  const existingDocument = await prisma.document.findUnique({
    where: { id: id },
  });
  if (!existingDocument) return { error: 'Documento não encontrado' };

  const updatedDocument = await prisma.document.update({
    where: { id: id },
    data: document,
  });
  return updatedDocument;
}

async function deleteDocument(id) {

  const existingDocument = await prisma.document.findUnique({
    where: { id: id },
  });
  if (!existingDocument) return { error: 'Documento não encontrado' };

  await prisma.document.delete({
    where: { id: id },
  });
  return { message: 'Documento excluído com sucesso' };
}
