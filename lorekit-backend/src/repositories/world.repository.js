const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

async function getWorlds() {

    const worlds = await prisma.world.findMany({
        include: {
            users: true
        },
        where: {
            users: {
                some: {
                    userId: getUserId()
                }
            }
        }
    });

    return worlds;
}

async function getWorldById(id) {
    const world = await prisma.world.findUnique({
        include: {
            users: true
        },
        where: {
            id: {
                equals: id,
            },
            users: {
                some: {
                    userId: getUserId()
                }
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

    const userWorld = await prisma.userWorld.create({
        data: {
            userId: getUserId(),
            worldId: world.id,
            accessLevel: 0
        },
    });


    return world;
}

async function updateWorld(world) {

    const existingWorld = await getWorldById(world.id);

    if (!existingWorld) return res.status(404).json({ error: 'Mundo não encontrado' });

    const updatedWorld = await prisma.world.update({
        where: { id: world.id },
        data: { name: world.name, description: world.description },
    });

    return updatedWorld;
}

async function deleteWorld(id) {
    const existingWorld = await getWorldById(world.id);

    if (!existingWorld) return res.status(404).json({ error: 'Mundo não encontrado' });

    const worldUser = existingWorld.users.filter(user => user.id === getUserId() && user.accessLevel === 0);

    if(worldUser == null || worldUser.length === 0) {
        return res.status(403).json({ error: 'Autorização insuficiente' });
    }

    return true;
}

module.exports = {
    getWorlds,
    getWorldById,
    createWorld,
    updateWorld,
    deleteWorld,
};