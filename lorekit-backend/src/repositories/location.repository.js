const prisma = require('../prismaClient');
const { getUserId } = require('../requestContext');

async function getAllLocations() {
    return await prisma.location.findMany();
}

async function getLocationsByWorldId(worldId) {
    return await prisma.location.findMany({
        where: { worldId },
    });
}

async function getLocationById(id) {
    return await prisma.location.findUnique({
        where: { id },
    });
}

async function createLocation(data) {
    return await prisma.location.create({
        data,
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
        data,
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
