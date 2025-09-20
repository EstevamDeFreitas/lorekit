const express = require('express');
const router = express.Router();
const locationRepository = require('../repositories/location.repository');

router.get('/', async (req, res) => {
    try {
        const locations = await locationRepository.getAllLocations();
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/world/:worldId', async (req, res) => {
    const { worldId } = req.params;
    try {
        const locations = await locationRepository.getLocationsByWorldId(worldId);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations by world ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const location = await locationRepository.getLocationById(id);
        if (location) {
            res.json(location);
        } else {
            res.status(404).json({ error: 'Location not found' });
        }
    } catch (error) {
        console.error('Error fetching location by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    const locationData = req.body;
    try {
        const newLocation = await locationRepository.createLocation(locationData);
        res.status(201).json(newLocation);
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const locationData = req.body;
    try {
        const updatedLocation = await locationRepository.updateLocation(id, locationData);
        res.json(updatedLocation);
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await locationRepository.deleteLocation(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Location Categories Routes
router.get('/categories', async (req, res) => {
    try {
        const categories = await locationRepository.getAllLocationCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching location categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const category = await locationRepository.getLocationCategoryById(id);
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ error: 'Location category not found' });
        }
    } catch (error) {
        console.error('Error fetching location category by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }   
});

router.post('/categories', async (req, res) => {
    const categoryData = req.body;
    try {
        const newCategory = await locationRepository.createLocationCategory(categoryData);
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error creating location category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/categories/:id', async (req, res) => {
    const { id } = req.params;
    const categoryData = req.body;

    try {
        const updatedCategory = await locationRepository.updateLocationCategory(id, categoryData);
        res.json(updatedCategory);
    } catch (error) {
        console.error('Error updating location category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await locationRepository.deleteLocationCategory(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting location category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;