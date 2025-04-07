// libs/models/payment.js
const { db } = require('./index');

const Payment = {
  async findById(id) {
    return db('payments').where({ id }).first();
  },
  
  async findByRide(rideId) {
    return db('payments').where({ ride_id: rideId }).first();
  },
  
  async findByUser(userId) {
    return db('payments')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  },
  
  async create(payment) {
    return db('payments').insert(payment).returning('*');
  },
  
  async update(id, payment) {
    return db('payments').where({ id }).update(payment).returning('*');
  },
  
  async getDriverEarnings(driverId, period) {
    let startDate;
    const now = new Date();
    
    // Calculate period start date
    switch (period) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }
    
    // Join with rides to get driver_id
    return db('payments')
      .join('rides', 'payments.ride_id', 'rides.id')
      .where('rides.driver_id', driverId)
      .where('payments.status', 'completed')
      .where('payments.created_at', '>=', startDate)
      .sum('driver_payout as total_earnings')
      .count('* as total_rides')
      .first();
  }
};

module.exports = Payment;