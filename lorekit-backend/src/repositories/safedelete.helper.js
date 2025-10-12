const prisma = require('../prismaClient');

async function safeDeleteEntity(entityTable, entityId, deleteRelatedItems = false) {
    await prisma.personalization.deleteMany({
        where: {
            entityTable: entityTable,
            entityId: entityId
        }
    });

    if (deleteRelatedItems) {
        await prisma.document.deleteMany({
            where: {
                entityTable: entityTable,
                entityId: entityId
            }
        });

        if(entityTable === 'world'){
            await prisma.location.deleteMany({
                where: { worldId: entityId }
            });
        }

    }
    else{
        await prisma.document.updateMany({
            where: {
                entityTable: entityTable,
                entityId: entityId
            },
            data:{
                entityId: null,
                entityTable: null
            }
        });

        if(entityTable === 'world'){
            await prisma.location.deleteMany({
                where: { worldId: entityId }
            });
        }

    }
}

module.exports = {
    safeDeleteEntity,
};