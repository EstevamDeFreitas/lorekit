const prisma = require('../prismaClient');

async function getEntityPersonalization(entityId, entityTable){
    return await prisma.personalization.findFirst({
        where: {
            entityId: entityId,
            entityTable: entityTable
        }
    });
}

async function createPersonalization(personalization) {
    return await prisma.personalization.create({
        data: {entityId: personalization.entityId, entityTable: personalization.entityTable, contentJson: personalization.contentJson}
    });
}

async function updatePersonalization(id, personalization) {

    const existingPersonalization = await prisma.personalization.findUnique({
        where: { id: id },
    });
    
    if (!existingPersonalization) return { error: 'Personalização não encontrada' };
    

    return await prisma.personalization.update({
        where: { id: id },
        data: { contentJson: personalization.contentJson }
    });
}

module.exports = {
    getEntityPersonalization,
    createPersonalization,
    updatePersonalization
};