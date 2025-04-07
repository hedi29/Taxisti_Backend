// services/payment-service/index.js
const express = require('express');
const { logger, AppError } = require('@yourride/common');
const { Payment, PaymentMethod, User } = require('@yourride/models');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(express.json());

// API routes
const router = express.Router();

// Payment Methods
router.get('/payments/methods', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const paymentMethods = await PaymentMethod.findByUser(userId);
    
    res.status(200).json({
      status: 'success',
      results: paymentMethods.length,
      data: {
        payment_methods: paymentMethods
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/payments/methods', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { payment_type, token } = req.body;
    
    if (!payment_type || !token) {
      return next(new AppError(400, 'Payment type and token are required'));
    }
    
    // Create payment method in Stripe
    const stripePaymentMethod = await stripe.paymentMethods.attach(token, {
      customer: await getOrCreateStripeCustomer(userId)
    });
    
    // Create payment method in our database
    const paymentMethod = await PaymentMethod.create({
      user_id: userId,
      payment_type,
      stripe_payment_method_id: stripePaymentMethod.id,
      last_four_digits: stripePaymentMethod.card.last4,
      expiry_date: `${stripePaymentMethod.card.exp_month}/${stripePaymentMethod.card.exp_year}`,
      is_default: false
    });
    
    // If it's the user's first payment method, set it as default
    const existingMethods = await PaymentMethod.findByUser(userId);
    if (existingMethods.length === 1) {
      await PaymentMethod.setDefault(paymentMethod[0].id, userId);
      paymentMethod[0].is_default = true;
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        payment_method: paymentMethod[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/payments/methods/:id/default', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const paymentMethod = await PaymentMethod.findById(id);
    
    if (!paymentMethod) {
      return next(new AppError(404, 'Payment method not found'));
    }
    
    if (paymentMethod.user_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    await PaymentMethod.setDefault(id, userId);
    
    res.status(200).json({
      status: 'success',
      data: {
        message: 'Payment method set as default'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to get or create a Stripe customer
async function getOrCreateStripeCustomer(userId) {
  // Get user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  // Check if user already has a Stripe customer ID in our DB
  if (user.stripe_customer_id) {
    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(user.stripe_customer_id);
      return user.stripe_customer_id;
    } catch (err) {
      // Customer doesn't exist in Stripe, create a new one
    }
  }
  
  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    phone: user.phone
  });
  
  // Update user with Stripe customer ID
  await User.update(userId, { stripe_customer_id: customer.id });
  
  return customer.id;
}

// Additional payment endpoints...

// Mount API routes
app.use('/api', router);

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this service!`));
});

// Global error handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  logger.error({
    message: err.message,
    stack: err.stack,
    status: err.status,
    statusCode: err.statusCode,
    url: req.originalUrl
  });
  
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Payment Service listening on port ${PORT}`);
});