const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

async function getAllLocations() {
    var locations = await prisma.location.findMany();

    locations = await Promise.all(locations.map(async (location) => {
        const personalization = await prisma.personalization.findFirst({
            where: { 
                entityTable: 'location',
                entityId: location.id
            },
        });
        return { ...location, personalization };
    }));

    return locations;
}

async function getLocationsByWorldId(worldId) {
    var locations = await prisma.location.findMany({
        where: { worldId },
    });

    locations = await Promise.all(locations.map(async (location) => {
        const personalization = await prisma.personalization.findFirst({
            where: {
                entityTable: 'location',
                entityId: location.id
            },
        });
        return { ...location, personalization };
    }));

    return locations;
}

async function getLocationById(id) {
    return await prisma.location.findUnique({
        where: { id },
    });
}

async function createLocation(data) {
    return await prisma.location.create({
        data: {name: data.name, description: data.description, worldId: data.worldId, categoryId: data.categoryId},
    });
}

async function updateLocation(id, data) {
    return await prisma.location.update({
        where: { id },
        data,
    });
}

async function deleteLocation(id) {
    return await prisma.location.delete({
        where: { id },
    });
}

//Location Categories
async function getAllLocationCategories() {
    return await prisma.locationCategory.findMany();
}

async function getLocationCategoryById(id) {
    return await prisma.locationCategory.findUnique({
        where: { id },
    });
}

async function createLocationCategory(data) {
    return await prisma.locationCategory.create({
        data: {name: data.name},
    });
}

async function updateLocationCategory(id, data) {
    return await prisma.locationCategory.update({
        where: { id },
        data,
    });
}

async function deleteLocationCategory(id) {
    return await prisma.locationCategory.delete({
        where: { id },
    });
}

module.exports = {
    getAllLocations,
    getLocationById,
    createLocation,
    updateLocation,
    deleteLocation,
    getLocationsByWorldId,

    getAllLocationCategories,
    getLocationCategoryById,
    createLocationCategory,
    updateLocationCategory,
    deleteLocationCategory
};
