// seed.js — Database seeding script.
//
// Generates realistic fake data for development and demo purposes.
// Run with: npm run seed
//
// This file lives in scripts/ so it's clearly separate from production code.
// It directly imports models because it's a one-off script, not a service.

const path = require('path');
const dotenv = require('dotenv');
// __dirname = d:\xeno-ai-crm\crm-backend\scripts
// We go one level up to reach crm-backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Customer = require('../src/models/Customer');
const Order = require('../src/models/Order');

// ─── Configuration ────────────────────────────────────────────────────────────
const CUSTOMER_COUNT = 1000;
const ORDER_COUNT = 5000;

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
const CATEGORIES = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Beauty', 'Sports', 'Toys', 'Grocery', 'Footwear', 'Jewellery'];
const CHANNELS = ['email', 'whatsapp', 'sms'];
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

// ─── Generate a single fake customer ──────────────────────────────────────────
const generateCustomer = () => ({
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  phone: `+91${faker.string.numeric(10)}`,
  attributes: {
    age: faker.number.int({ min: 18, max: 65 }),
    gender: faker.helpers.arrayElement(GENDERS),
    city: faker.helpers.arrayElement(CITIES),
  },
  purchaseSummary: {
    totalSpend: 0,          // Will be updated as orders are seeded
    totalOrders: 0,
    lastPurchaseDate: null,
  },
  engagement: {
    preferredChannel: faker.helpers.arrayElement(CHANNELS),
    emailOpenRate: parseFloat(faker.number.float({ min: 0, max: 1, fractionDigits: 2 })),
    whatsappOpenRate: parseFloat(faker.number.float({ min: 0, max: 1, fractionDigits: 2 })),
  },
});

// ─── Generate a single fake order for a given customerId ─────────────────────
const generateOrder = (customerId) => {
  // Each order has 1 to 4 items
  const itemCount = faker.number.int({ min: 1, max: 4 });
  const items = Array.from({ length: itemCount }, () => {
    const quantity = faker.number.int({ min: 1, max: 3 });
    const price = parseFloat(faker.commerce.price({ min: 100, max: 5000, dec: 0 }));
    return {
      productName: faker.commerce.productName(),
      category: faker.helpers.arrayElement(CATEGORIES),
      price,
      quantity,
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    customerId,
    items,
    totalAmount,
    // Random date within the past 2 years
    orderDate: faker.date.past({ years: 2 }),
  };
};

// ─── Main seed function ────────────────────────────────────────────────────────
const seed = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected');

    // Wipe existing data for a clean seed
    console.log('🗑️  Clearing existing data...');
    await Promise.all([Customer.deleteMany({}), Order.deleteMany({})]);

    // ── Seed Customers ──────────────────────────────────────────────────────
    console.log(`👥 Seeding ${CUSTOMER_COUNT} customers...`);
    const customerDocs = Array.from({ length: CUSTOMER_COUNT }, generateCustomer);

    // insertMany is much faster than calling .create() in a loop
    // ordered: false allows bulk insert to continue even if one document fails (e.g. duplicate email)
    const insertedCustomers = await Customer.insertMany(customerDocs, { ordered: false });
    console.log(`✅ ${insertedCustomers.length} customers seeded`);

    // Extract IDs for assigning to orders
    const customerIds = insertedCustomers.map((c) => c._id);

    // ── Seed Orders ──────────────────────────────────────────────────────────
    console.log(`📦 Seeding ${ORDER_COUNT} orders...`);
    const orderDocs = Array.from({ length: ORDER_COUNT }, () => {
      // Randomly assign each order to an existing customer
      const randomCustomerId = faker.helpers.arrayElement(customerIds);
      return generateOrder(randomCustomerId);
    });

    const insertedOrders = await Order.insertMany(orderDocs, { ordered: false });
    console.log(`✅ ${insertedOrders.length} orders seeded`);

    // ── Update Customer Purchase Summaries ───────────────────────────────────
    // After bulk inserting orders, we need to update each customer's purchaseSummary.
    // We run one aggregation to compute the summary per customer, then bulk update.
    console.log('🔄 Updating customer purchase summaries...');

    const summaries = await Order.aggregate([
      {
        // Group orders by customerId and compute aggregates
        $group: {
          _id: '$customerId',
          totalSpend: { $sum: '$totalAmount' },
          totalOrders: { $count: {} },
          lastPurchaseDate: { $max: '$orderDate' },
        },
      },
    ]);

    // Build a batch of updateOne operations for bulkWrite
    const bulkOps = summaries.map((summary) => ({
      updateOne: {
        filter: { _id: summary._id },
        update: {
          $set: {
            'purchaseSummary.totalSpend': Math.round(summary.totalSpend),
            'purchaseSummary.totalOrders': summary.totalOrders,
            'purchaseSummary.lastPurchaseDate': summary.lastPurchaseDate,
          },
        },
      },
    }));

    // bulkWrite executes all updates in a single round-trip to MongoDB
    await Customer.bulkWrite(bulkOps);
    console.log(`✅ Purchase summaries updated for ${bulkOps.length} customers`);

    console.log('\n🌱 Seed complete!');
    console.log(`   Customers: ${insertedCustomers.length}`);
    console.log(`   Orders:    ${insertedOrders.length}`);

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
    process.exit(0);
  }
};

seed();
