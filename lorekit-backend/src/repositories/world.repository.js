const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

const { safeDeleteEntity } = require('./safedelete.helper');

async function getWorlds() {

    const worlds = await prisma.world.findMany();

    const worldsWithPersonalization = await Promise.all(worlds.map(async (world) => {
        const personalization = await prisma.personalization.findFirst({
            where: {
                entityTable: 'world',
                entityId: world.id
            }
        });
        return {
            ...world,
            personalization: personalization
        };
    }));

    return worldsWithPersonalization;
}

async function getWorldById(id) {
    const world = await prisma.world.findFirst({
        include: {
            users: true
        },
        where: {
            id: {
                equals: id,
            }
        },
    });
    return world;
}

async function createWorld(world) {

    if (!world.name) return res.status(400).json({ error: 'Nome é obrigatório' });

    world = await prisma.world.create({
        data: { name: world.name, description: world.description },
    });

    return world;
}

async function updateWorld(world) {

    const existingWorld = await getWorldById(world.id);

    if (!existingWorld) return res.status(404).json({ error: 'Mundo não encontrado' });

    const updatedWorld = await prisma.world.update({
        where: { id: world.id },
        data: { name: world.name, description: world.description, concept: world.concept },
    });

    return updatedWorld;
}

async function deleteWorld(id, deleteRelatedItems = false) {

    await safeDeleteEntity('world', id, deleteRelatedItems);

    await prisma.userWorld.deleteMany({
        where: { worldId: id }
    });

    return await prisma.world.delete({
        where: { id },
    });
}

module.exports = {
    getWorlds,
    getWorldById,
    createWorld,
    updateWorld,
    deleteWorld,
};