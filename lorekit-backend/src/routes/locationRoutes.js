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

module.exports = router;