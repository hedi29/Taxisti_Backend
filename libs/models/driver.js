// libs/models/driver.js
const { db } = require('./index');

const Driver = {
  async findById(driverId) {
    return db('driver_profiles').where({ driver_id: driverId }).first();
  },
  
  async create(driver) {
    return db('driver_profiles').insert(driver).returning('*');
  },
  
  async update(driverId, driver) {
    return db('driver_profiles').where({ driver_id: driverId }).update(driver).returning('*');
  },
  
  async updateLocation(driverId, locationData) {
    return db('driver_profiles')
      .where({ driver_id: driverId })
      .update(locationData);
  },
  
  async updateStatus(driverId, isOnline) {
    return db('driver_profiles')
      .where({ driver_id: driverId })
      .update({ is_online: isOnline, last_location_update: new Date() });
  },
  
  async findNearby(longitude, latitude, radius = 5) {
    // This assumes PostgreSQL with PostGIS extension
    return db.raw(`
      SELECT d.driver_id, p.first_name, p.last_name, d.vehicle_type, 
        d.vehicle_color, d.license_plate, d.average_rating 
      FROM driver_profiles d 
      JOIN profiles p ON d.driver_id = p.id
      WHERE d.is_online = true 
      AND ST_DWithin(
        d.current_location::geography, 
        ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 
        ? * 1000
      )
      ORDER BY 
        ST_Distance(
          d.current_location::geography, 
          ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
        )
    `, [longitude, latitude, radius, longitude, latitude]);
  }
};

module.exports = Driver;