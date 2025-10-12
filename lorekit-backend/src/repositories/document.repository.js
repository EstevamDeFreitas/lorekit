const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

const { safeDeleteEntity } = require('./safedelete.helper');

async function getEntityDocuments(entityId, entityTable) {

  var documents = await prisma.document.findMany({
    where: {
      entityId,
      entityTable
    }
  });

  const documentsWithPersonalization = await Promise.all(documents.map(async (doc) => {
        const personalization = await prisma.personalization.findFirst({
            where: {
                entityTable: 'document',
                entityId: doc.id
            }
        });
        return {
            ...doc,
            personalization: personalization
        };
    }));

  return documentsWithPersonalization;
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
    data: {
      title: document.title,
      content: document.content || '', 
      entityId: document.entityId,
      entityTable: document.entityTable,
      type: document.type,
    },
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
    data: {
      title: document.title,
      content: document.content || '', 
      entityId: document.entityId,
      entityTable: document.entityTable,
      type: document.type,
    },
  });
  return updatedDocument;
}

async function deleteDocument(id, deleteRelatedItems = false) {

  await safeDeleteEntity('document', id, deleteRelatedItems);

  await prisma.document.delete({
    where: { id: id },
  });

  
  return { message: 'Documento excluído com sucesso' };
}

module.exports = {
  getEntityDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument
};