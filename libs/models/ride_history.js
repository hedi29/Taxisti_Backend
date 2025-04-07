// libs/models/ride_history.js
const { db } = require('./index');

const RideHistory = {
  async findByRideId(rideId) {
    return db('ride_history')
      .where({ ride_id: rideId })
      .orderBy('timestamp', 'asc');
  },
  
  async create(history) {
    return db('ride_history').insert(history).returning('*');
  }
};

module.exports = RideHistory;