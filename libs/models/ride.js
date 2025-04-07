// libs/models/ride.js
const { db } = require('./index');

const Ride = {
  async findById(id) {
    return db('rides').where({ id }).first();
  },
  
  async findByRider(riderId) {
    return db('rides')
      .where({ rider_id: riderId })
      .orderBy('created_at', 'desc');
  },
  
  async findByDriver(driverId) {
    return db('rides')
      .where({ driver_id: driverId })
      .orderBy('created_at', 'desc');
  },
  
  async create(ride) {
    return db('rides').insert(ride).returning('*');
  },
  
  async update(id, ride) {
    return db('rides').where({ id }).update(ride).returning('*');
  },
  
  async findActive(userId, userType) {
    const query = db('rides')
      .whereNotIn('status', ['completed', 'cancelled']);
      
    if (userType === 'rider') {
      query.where({ rider_id: userId });
    } else if (userType === 'driver') {
      query.where({ driver_id: userId });
    }
    
    return query.first();
  },
  
  async findAvailableRides(longitude, latitude, radius = 5) {
    // This assumes PostgreSQL with PostGIS extension
    return db.raw(`
      SELECT * FROM rides 
      WHERE status = 'requested' 
      AND ST_DWithin(
        pickup_location::geography, 
        ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 
        ? * 1000
      )
      ORDER BY 
        ST_Distance(
          pickup_location::geography, 
          ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
        )
    `, [longitude, latitude, radius, longitude, latitude]);
  }
};

module.exports = Ride;