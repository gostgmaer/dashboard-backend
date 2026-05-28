require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const slugify = require('slugify');

const connectDB = require('../src/config/dbConnact');
const seedSettings = require('../src/config/seedSettings');
const Permission = require('../src/models/permission');
const Role = require('../src/models/role');
const User = require('../src/models/user');
const Category = require('../src/models/categories');
const Brand = require('../src/models/brands');
const Product = require('../src/models/products');
const Attribute = require('../src/models/Attribute');
const PromoCode = require('../src/models/Coupon');
const DiscountRule = require('../src/models/DiscountRule');
const AppliedDiscount = require('../src/models/AppliedDiscount');
const Address = require('../src/models/address');
const Cart = require('../src/models/cart');
const Wishlist = require('../src/models/wishlist');
const Order = require('../src/models/orders');
const Review = require('../src/models/reviews');

const TenantModule = require('../src/models/tenant');
const Tenant = TenantModule.default || TenantModule;

const SEED_TAG = 'commerce-demo-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_MODE = process.argv.includes('--reset');
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD || 'Customer@12345';

const toSlug = (value) => slugify(value, { lower: true, strict: true, trim: true });
const roundMoney = (value) => Number(value.toFixed(2));
const daysAgo = (days, hour = 10) => {
  const now = new Date();
  now.setHours(hour, 0, 0, 0);
  return new Date(now.getTime() - (days * DAY_MS));
};
const daysFromNow = (days, hour = 10) => {
  const now = new Date();
  now.setHours(hour, 0, 0, 0);
  return new Date(now.getTime() + (days * DAY_MS));
};
const media = (url, name) => ({ url, name, type: 'image/jpeg', size: 0 });

const TENANT_DEF = {
  name: 'My Store Demo',
  slug: 'my-store-001',
  metadata: {
    seededBy: SEED_TAG,
    storefront: 'Greens Market',
    locale: 'en-US',
  },
};

const PERMISSION_DEFS = [
  {
    key: 'read:dashboard',
    name: 'Read Dashboard',
    description: 'View dashboard metrics and reports.',
    category: 'dashboard',
    action: 'read',
    resource: 'dashboard',
  },
  {
    key: 'manage:products',
    name: 'Manage Products',
    description: 'Create, update, and organize catalog products.',
    category: 'products',
    action: 'manage',
    resource: 'products',
  },
  {
    key: 'manage:orders',
    name: 'Manage Orders',
    description: 'Review and update order fulfillment status.',
    category: 'orders',
    action: 'manage',
    resource: 'orders',
  },
  {
    key: 'manage:users',
    name: 'Manage Users',
    description: 'Manage customer and staff accounts.',
    category: 'users',
    action: 'manage',
    resource: 'users',
  },
  {
    key: 'manage:settings',
    name: 'Manage Settings',
    description: 'Update storefront and platform settings.',
    category: 'settings',
    action: 'manage',
    resource: 'settings',
  },
  {
    key: 'manage:reviews',
    name: 'Manage Reviews',
    description: 'Moderate customer reviews and ratings.',
    category: 'review',
    action: 'manage',
    resource: 'reviews',
  },
  {
    key: 'read:catalog',
    name: 'Read Catalog',
    description: 'Browse categories, brands, products, and attributes.',
    category: 'products',
    action: 'read',
    resource: 'catalog',
  },
];

const ROLE_DEFS = [
  {
    name: 'admin',
    description: 'Operations admin with full catalog, order, and dashboard access.',
    permissionKeys: ['read:dashboard', 'manage:products', 'manage:orders', 'manage:users', 'manage:settings', 'manage:reviews', 'read:catalog'],
  },
  {
    name: 'support_agent',
    description: 'Customer support role focused on orders, users, and reviews.',
    permissionKeys: ['read:dashboard', 'manage:orders', 'manage:users', 'manage:reviews', 'read:catalog'],
  },
  {
    name: 'customer',
    description: 'Default storefront customer role.',
    permissionKeys: ['read:catalog'],
    isDefault: true,
  },
];

const USER_DEFS = [
  {
    key: 'admin',
    email: 'admin.demo@greensmarket.local',
    username: 'greensadmin',
    firstName: 'Avery',
    lastName: 'Coleman',
    role: 'admin',
    password: ADMIN_PASSWORD,
    phoneNumber: '4155550100',
    gender: 'prefer_not_to_say',
    createdAt: daysAgo(260, 9),
    lastLogin: daysAgo(1, 8),
    subscriptionStatus: 'active',
    subscriptionType: 'enterprise',
    interests: ['dashboard', 'inventory', 'operations'],
    paymentMethod: 'credit_card',
    deliveryMethod: 'standard',
  },
  {
    key: 'support',
    email: 'support.demo@greensmarket.local',
    username: 'greenssupport',
    firstName: 'Nina',
    lastName: 'Brooks',
    role: 'support_agent',
    password: ADMIN_PASSWORD,
    phoneNumber: '4155550101',
    gender: 'female',
    createdAt: daysAgo(220, 10),
    lastLogin: daysAgo(2, 9),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['customer-support', 'returns', 'reviews'],
    paymentMethod: 'paypal',
    deliveryMethod: 'standard',
  },
  {
    key: 'sophia',
    email: 'sophia.ramirez@greensmarket.local',
    username: 'sophiaramirez',
    firstName: 'Sophia',
    lastName: 'Ramirez',
    role: 'customer',
    password: CUSTOMER_PASSWORD,
    phoneNumber: '4155550102',
    gender: 'female',
    createdAt: daysAgo(210, 11),
    lastLogin: daysAgo(3, 7),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['organic', 'bakery', 'coffee'],
    paymentMethod: 'credit_card',
    deliveryMethod: 'express',
    favoriteProductKeys: ['spinach', 'sourdough', 'coffee'],
  },
  {
    key: 'ethan',
    email: 'ethan.walker@greensmarket.local',
    username: 'ethanwalker',
    firstName: 'Ethan',
    lastName: 'Walker',
    role: 'customer',
    password: CUSTOMER_PASSWORD,
    phoneNumber: '4155550103',
    gender: 'male',
    createdAt: daysAgo(185, 12),
    lastLogin: daysAgo(5, 8),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['seafood', 'pantry', 'meal-prep'],
    paymentMethod: 'paypal',
    deliveryMethod: 'standard',
    favoriteProductKeys: ['salmon', 'olive-oil'],
  },
  {
    key: 'priya',
    email: 'priya.shah@greensmarket.local',
    username: 'priyashah',
    firstName: 'Priya',
    lastName: 'Shah',
    role: 'customer',
    password: CUSTOMER_PASSWORD,
    phoneNumber: '4155550104',
    gender: 'female',
    createdAt: daysAgo(150, 11),
    lastLogin: daysAgo(4, 10),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['breakfast', 'tea', 'fresh-fruit'],
    paymentMethod: 'credit_card',
    deliveryMethod: 'express',
    favoriteProductKeys: ['croissant', 'juice'],
  },
  {
    key: 'marcus',
    email: 'marcus.johnson@greensmarket.local',
    username: 'marcusjohnson',
    firstName: 'Marcus',
    lastName: 'Johnson',
    role: 'customer',
    password: CUSTOMER_PASSWORD,
    phoneNumber: '4155550105',
    gender: 'male',
    createdAt: daysAgo(105, 10),
    lastLogin: daysAgo(2, 11),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['coffee', 'cookies', 'weekly-restock'],
    paymentMethod: 'credit_card',
    deliveryMethod: 'standard',
    favoriteProductKeys: ['coffee', 'tea', 'cookies'],
  },
  {
    key: 'aisha',
    email: 'aisha.khan@greensmarket.local',
    username: 'aishakhan',
    firstName: 'Aisha',
    lastName: 'Khan',
    role: 'customer',
    password: CUSTOMER_PASSWORD,
    phoneNumber: '4155550106',
    gender: 'female',
    createdAt: daysAgo(55, 9),
    lastLogin: daysAgo(1, 12),
    subscriptionStatus: 'active',
    subscriptionType: 'premium',
    interests: ['juice', 'healthy-snacks', 'organic'],
    paymentMethod: 'paypal',
    deliveryMethod: 'express',
    favoriteProductKeys: ['juice', 'peanut-butter', 'spinach'],
  },
];

const CATEGORY_DEFS = [
  {
    key: 'fresh-produce',
    title: 'Fresh Produce',
    descriptions: 'Seasonal produce, picked daily and stocked for quick-turn delivery.',
    isFeatured: true,
    displayOrder: 1,
    createdAt: daysAgo(240),
    image: media('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80', 'fresh-produce.jpg'),
  },
  {
    key: 'leafy-greens',
    title: 'Leafy Greens',
    parentKey: 'fresh-produce',
    descriptions: 'Crisp salad greens and cooking greens from regional farms.',
    isFeatured: true,
    displayOrder: 2,
    createdAt: daysAgo(235),
    image: media('https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80', 'leafy-greens.jpg'),
  },
  {
    key: 'seasonal-fruit',
    title: 'Seasonal Fruit',
    parentKey: 'fresh-produce',
    descriptions: 'Rotating fruit selection for juicing, snacking, and dessert prep.',
    isFeatured: true,
    displayOrder: 3,
    createdAt: daysAgo(232),
    image: media('https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=900&q=80', 'seasonal-fruit.jpg'),
  },
  {
    key: 'protein-seafood',
    title: 'Protein & Seafood',
    descriptions: 'Fresh seafood and responsibly sourced proteins for weeknight meals.',
    isFeatured: true,
    displayOrder: 4,
    createdAt: daysAgo(220),
    image: media('https://images.unsplash.com/photo-1604908176997-431e9f2d769c?auto=format&fit=crop&w=900&q=80', 'protein-seafood.jpg'),
  },
  {
    key: 'artisan-bakery',
    title: 'Artisan Bakery',
    descriptions: 'Small-batch breads and pastries baked every morning.',
    isFeatured: true,
    displayOrder: 5,
    createdAt: daysAgo(215),
    image: media('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', 'artisan-bakery.jpg'),
  },
  {
    key: 'beverages',
    title: 'Beverages',
    descriptions: 'Coffee, tea, and fresh drinks for the morning rush and afternoon reset.',
    isFeatured: true,
    displayOrder: 6,
    createdAt: daysAgo(205),
    image: media('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'beverages.jpg'),
  },
  {
    key: 'coffee-tea',
    title: 'Coffee & Tea',
    parentKey: 'beverages',
    descriptions: 'Roasted coffee and loose-leaf tea with strong repeat purchase demand.',
    isFeatured: true,
    displayOrder: 7,
    createdAt: daysAgo(200),
    image: media('https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80', 'coffee-tea.jpg'),
  },
  {
    key: 'pantry-staples',
    title: 'Pantry Staples',
    descriptions: 'Longer-shelf-life items customers reorder every week.',
    isFeatured: true,
    displayOrder: 8,
    createdAt: daysAgo(195),
    image: media('https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=900&q=80', 'pantry-staples.jpg'),
  },
];

const BRAND_DEFS = [
  {
    key: 'green-basket',
    name: 'Green Basket Organics',
    tagline: 'Regional produce delivered same day.',
    descriptions: 'A regional produce label focused on clean, quick-turn leafy greens and fruit.',
    country: 'United States',
    establishedYear: 2016,
    displayOrder: 1,
    rating: 4.8,
    isFeatured: true,
    createdAt: daysAgo(230),
    image: media('https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?auto=format&fit=crop&w=900&q=80', 'green-basket.jpg'),
  },
  {
    key: 'tide-table',
    name: 'Tide & Table Seafoods',
    tagline: 'Cold-chain seafood packed for weekday delivery.',
    descriptions: 'Known for premium salmon portions and reliable cold-chain packing.',
    country: 'United States',
    establishedYear: 2014,
    displayOrder: 2,
    rating: 4.7,
    isFeatured: true,
    createdAt: daysAgo(225),
    image: media('https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80', 'tide-table.jpg'),
  },
  {
    key: 'prairie-field',
    name: 'Prairie Field Farms',
    tagline: 'Pasture-raised proteins with predictable supply.',
    descriptions: 'A Midwest poultry supplier built for premium, repeat-ready staples.',
    country: 'United States',
    establishedYear: 2012,
    displayOrder: 3,
    rating: 4.6,
    isFeatured: false,
    createdAt: daysAgo(222),
    image: media('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80', 'prairie-field.jpg'),
  },
  {
    key: 'hearthstone',
    name: 'Hearthstone Bakehouse',
    tagline: 'Morning bakes with strong basket-building power.',
    descriptions: 'A bakery partner with dependable breakfast bread, pastry, and cookie velocity.',
    country: 'United States',
    establishedYear: 2011,
    displayOrder: 4,
    rating: 4.9,
    isFeatured: true,
    createdAt: daysAgo(218),
    image: media('https://images.unsplash.com/photo-1512058564366-c9e2e0466f2d?auto=format&fit=crop&w=900&q=80', 'hearthstone.jpg'),
  },
  {
    key: 'morning-peak',
    name: 'Morning Peak Roasters',
    tagline: 'Coffee and tea built for repeat subscriptions.',
    descriptions: 'Single-origin coffee and tea blends positioned as high-repeat pantry favorites.',
    country: 'United States',
    establishedYear: 2018,
    displayOrder: 5,
    rating: 4.8,
    isFeatured: true,
    createdAt: daysAgo(214),
    image: media('https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80', 'morning-peak.jpg'),
  },
  {
    key: 'orchard-vale',
    name: 'Orchard Vale Juicery',
    tagline: 'Cold-pressed fruit drinks with clean labels.',
    descriptions: 'A juice label used to round out breakfast, lunchbox, and wellness baskets.',
    country: 'United States',
    establishedYear: 2019,
    displayOrder: 6,
    rating: 4.5,
    isFeatured: false,
    createdAt: daysAgo(208),
    image: media('https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=900&q=80', 'orchard-vale.jpg'),
  },
  {
    key: 'sunvale',
    name: 'Sunvale Pantry Co.',
    tagline: 'Reliable pantry goods for every refill cycle.',
    descriptions: 'Shelf-stable pantry products with strong reorder behavior and dependable margin.',
    country: 'United States',
    establishedYear: 2015,
    displayOrder: 7,
    rating: 4.6,
    isFeatured: false,
    createdAt: daysAgo(206),
    image: media('https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=900&q=80', 'sunvale.jpg'),
  },
];

const PRODUCT_DEFS = [
  {
    key: 'spinach',
    sku: 'GM-SPIN-250',
    title: 'Farm Fresh Spinach 250g',
    brandKey: 'green-basket',
    categoryKey: 'leafy-greens',
    categoryKeys: ['fresh-produce', 'leafy-greens'],
    basePrice: 4.99,
    discountPercent: 10,
    inventory: 18,
    lowStockThreshold: 8,
    viewBias: 130,
    tags: ['spinach', 'greens', 'organic', 'salad'],
    features: ['Washed and ready to cook', 'Harvested within 24 hours', 'Packed in breathable pouch'],
    overview: 'Tender spinach leaves for salads, smoothies, and quick sautes.',
    shortDescription: 'Crisp organic spinach packed for same-day delivery.',
    productOrigin: 'California, USA',
    weight: 0.25,
    shippingWeight: 0.3,
    stockLocation: 'Produce Cooler A1',
    ingredients: 'Organic spinach leaves.',
    certifications: ['USDA Organic'],
    createdAt: daysAgo(32),
    image: media('https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=900&q=80', 'spinach.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=900&q=80', 'spinach.jpg'),
      media('https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80', 'spinach-bowl.jpg'),
    ],
    relatedKeys: ['romaine', 'juice'],
  },
  {
    key: 'romaine',
    sku: 'GM-ROMA-003',
    title: 'Hydroponic Romaine Hearts',
    brandKey: 'green-basket',
    categoryKey: 'leafy-greens',
    categoryKeys: ['fresh-produce', 'leafy-greens'],
    basePrice: 5.49,
    discountPercent: 0,
    inventory: 24,
    lowStockThreshold: 8,
    viewBias: 110,
    tags: ['romaine', 'greens', 'salad'],
    features: ['Three trimmed romaine hearts', 'Crunchy texture', 'Great for chopped salads'],
    overview: 'Romaine hearts with a clean crunch and longer shelf-life.',
    shortDescription: 'Hydroponic romaine with strong crunch and freshness.',
    productOrigin: 'Arizona, USA',
    weight: 0.38,
    shippingWeight: 0.43,
    stockLocation: 'Produce Cooler A1',
    ingredients: 'Romaine lettuce.',
    certifications: ['Hydroponic'],
    createdAt: daysAgo(48),
    image: media('https://images.unsplash.com/photo-1622205313162-be1d5712a43c?auto=format&fit=crop&w=900&q=80', 'romaine.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1622205313162-be1d5712a43c?auto=format&fit=crop&w=900&q=80', 'romaine.jpg'),
      media('https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80', 'romaine-salad.jpg'),
    ],
    relatedKeys: ['spinach', 'juice'],
  },
  {
    key: 'salmon',
    sku: 'GM-SALM-180',
    title: 'Atlantic Salmon Portions 2 Pack',
    brandKey: 'tide-table',
    categoryKey: 'protein-seafood',
    categoryKeys: ['protein-seafood'],
    basePrice: 18.99,
    discountPercent: 12,
    inventory: 14,
    lowStockThreshold: 6,
    viewBias: 180,
    tags: ['salmon', 'seafood', 'protein'],
    features: ['Two center-cut fillets', 'Skin-on for better sear', 'Vacuum sealed for freshness'],
    overview: 'Premium salmon portions for sheet-pan dinners and quick weeknight meals.',
    shortDescription: 'Center-cut salmon with reliable cold-chain delivery.',
    productOrigin: 'Atlantic Ocean',
    weight: 0.45,
    shippingWeight: 0.55,
    stockLocation: 'Seafood Cooler B2',
    ingredients: 'Atlantic salmon.',
    certifications: ['Responsibly Sourced'],
    createdAt: daysAgo(62),
    image: media('https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=900&q=80', 'salmon.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=900&q=80', 'salmon.jpg'),
      media('https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80', 'salmon-plated.jpg'),
    ],
    relatedKeys: ['olive-oil', 'spinach'],
  },
  {
    key: 'chicken',
    sku: 'GM-CHKN-1LB',
    title: 'Free Range Chicken Breast 1 lb',
    brandKey: 'prairie-field',
    categoryKey: 'protein-seafood',
    categoryKeys: ['protein-seafood'],
    basePrice: 12.49,
    discountPercent: 0,
    inventory: 20,
    lowStockThreshold: 6,
    viewBias: 150,
    tags: ['chicken', 'protein', 'weeknight'],
    features: ['Boneless skinless portions', 'Air chilled', 'Family-pack ready'],
    overview: 'Lean chicken breast sized for meal prep, grilling, and fast saute work.',
    shortDescription: 'Pasture-raised chicken breast with dependable quality.',
    productOrigin: 'Iowa, USA',
    weight: 0.5,
    shippingWeight: 0.62,
    stockLocation: 'Protein Cooler B1',
    ingredients: 'Chicken breast.',
    certifications: ['No Antibiotics Ever'],
    createdAt: daysAgo(73),
    image: media('https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=900&q=80', 'chicken.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=900&q=80', 'chicken.jpg'),
      media('https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80', 'chicken-cooked.jpg'),
    ],
    relatedKeys: ['olive-oil', 'spinach'],
  },
  {
    key: 'sourdough',
    sku: 'GM-BR-SOUR',
    title: 'Country Sourdough Loaf',
    brandKey: 'hearthstone',
    categoryKey: 'artisan-bakery',
    categoryKeys: ['artisan-bakery'],
    basePrice: 6.99,
    discountPercent: 8,
    inventory: 26,
    lowStockThreshold: 10,
    viewBias: 160,
    tags: ['bread', 'sourdough', 'breakfast'],
    features: ['Naturally leavened', 'Open crumb structure', 'Baked each morning'],
    overview: 'A crusty sourdough loaf that anchors breakfast, sandwiches, and grazing boards.',
    shortDescription: 'Morning-baked sourdough with deep flavor and strong repeat appeal.',
    productOrigin: 'San Francisco, USA',
    weight: 0.68,
    shippingWeight: 0.78,
    stockLocation: 'Bakery Rack C1',
    ingredients: 'Flour, water, salt, starter.',
    createdAt: daysAgo(24),
    image: media('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', 'sourdough.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', 'sourdough.jpg'),
      media('https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=900&q=80', 'sourdough-sliced.jpg'),
    ],
    relatedKeys: ['croissant', 'peanut-butter'],
  },
  {
    key: 'croissant',
    sku: 'GM-CRSN-4PK',
    title: 'Butter Croissant 4 Pack',
    brandKey: 'hearthstone',
    categoryKey: 'artisan-bakery',
    categoryKeys: ['artisan-bakery'],
    basePrice: 8.49,
    discountPercent: 0,
    inventory: 22,
    lowStockThreshold: 8,
    viewBias: 145,
    tags: ['croissant', 'pastry', 'breakfast'],
    features: ['All-butter lamination', 'Four croissants per pack', 'Reheats in 4 minutes'],
    overview: 'A bakery staple for breakfast baskets and quick office pickups.',
    shortDescription: 'Flaky all-butter croissants packed in a convenient four-count.',
    productOrigin: 'San Francisco, USA',
    weight: 0.42,
    shippingWeight: 0.5,
    stockLocation: 'Bakery Rack C1',
    ingredients: 'Flour, butter, milk, sugar, yeast, salt.',
    allergens: ['Wheat', 'Milk'],
    createdAt: daysAgo(17),
    image: media('https://images.unsplash.com/photo-1555507036-ab794f4ade0a?auto=format&fit=crop&w=900&q=80', 'croissant.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1555507036-ab794f4ade0a?auto=format&fit=crop&w=900&q=80', 'croissant.jpg'),
      media('https://images.unsplash.com/photo-1515443961218-a51367888e4b?auto=format&fit=crop&w=900&q=80', 'croissant-plate.jpg'),
    ],
    relatedKeys: ['coffee', 'sourdough'],
  },
  {
    key: 'coffee',
    sku: 'GM-COFF-12OZ',
    title: 'Single Origin Breakfast Blend 12 oz',
    brandKey: 'morning-peak',
    categoryKey: 'coffee-tea',
    categoryKeys: ['beverages', 'coffee-tea'],
    basePrice: 14.99,
    discountPercent: 15,
    inventory: 30,
    lowStockThreshold: 12,
    viewBias: 220,
    tags: ['coffee', 'beans', 'breakfast'],
    features: ['Whole bean roast', 'Chocolate and citrus profile', 'Best for drip and pour-over'],
    overview: 'A high-repeat breakfast blend positioned for subscriptions and pantry refill orders.',
    shortDescription: 'Whole bean breakfast roast with broad appeal and strong repeat demand.',
    productOrigin: 'Colombia',
    weight: 0.34,
    shippingWeight: 0.4,
    stockLocation: 'Beverage Shelf D2',
    ingredients: 'Roasted coffee beans.',
    createdAt: daysAgo(14),
    image: media('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'coffee.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'coffee.jpg'),
      media('https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80', 'coffee-cup.jpg'),
    ],
    relatedKeys: ['croissant', 'cookies', 'tea'],
  },
  {
    key: 'tea',
    sku: 'GM-TEA-SEN',
    title: 'Sencha Green Tea Sachets 20 Count',
    brandKey: 'morning-peak',
    categoryKey: 'coffee-tea',
    categoryKeys: ['beverages', 'coffee-tea'],
    basePrice: 9.99,
    discountPercent: 0,
    inventory: 28,
    lowStockThreshold: 10,
    viewBias: 135,
    tags: ['tea', 'green-tea', 'wellness'],
    features: ['20 pyramid sachets', 'Light vegetal profile', 'Steeps in under 3 minutes'],
    overview: 'A clean, easy-drinking green tea suited to wellness and afternoon baskets.',
    shortDescription: 'Light sencha sachets with strong repeat purchase behavior.',
    productOrigin: 'Japan',
    weight: 0.12,
    shippingWeight: 0.18,
    stockLocation: 'Beverage Shelf D2',
    ingredients: 'Green tea leaves.',
    createdAt: daysAgo(41),
    image: media('https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80', 'tea.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80', 'tea.jpg'),
      media('https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80', 'tea-cup.jpg'),
    ],
    relatedKeys: ['coffee', 'cookies'],
  },
  {
    key: 'juice',
    sku: 'GM-JUICE-OJ',
    title: 'Cold Pressed Orange Juice 1 L',
    brandKey: 'orchard-vale',
    categoryKey: 'beverages',
    categoryKeys: ['beverages', 'seasonal-fruit'],
    basePrice: 7.99,
    discountPercent: 5,
    inventory: 19,
    lowStockThreshold: 7,
    viewBias: 150,
    tags: ['juice', 'orange', 'breakfast'],
    features: ['100% juice', 'No added sugar', 'Pressed and bottled locally'],
    overview: 'A breakfast basket anchor with strong attach rate to bakery and greens.',
    shortDescription: 'Fresh cold-pressed orange juice bottled in one-liter format.',
    productOrigin: 'Florida, USA',
    weight: 1,
    shippingWeight: 1.12,
    stockLocation: 'Cold Beverage D1',
    ingredients: 'Orange juice.',
    createdAt: daysAgo(12),
    image: media('https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=900&q=80', 'orange-juice.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=900&q=80', 'orange-juice.jpg'),
      media('https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=900&q=80', 'orange-juice-glass.jpg'),
    ],
    relatedKeys: ['spinach', 'croissant'],
  },
  {
    key: 'cookies',
    sku: 'GM-COOK-OAT',
    title: 'Oatmeal Raisin Cookie Box',
    brandKey: 'hearthstone',
    categoryKey: 'pantry-staples',
    categoryKeys: ['pantry-staples'],
    basePrice: 5.99,
    discountPercent: 10,
    inventory: 33,
    lowStockThreshold: 12,
    viewBias: 120,
    tags: ['cookies', 'oatmeal', 'snack'],
    features: ['Six bakery-style cookies', 'Soft center', 'Portable snack format'],
    overview: 'A high-attach snack item that performs well with coffee, tea, and lunchbox orders.',
    shortDescription: 'Six-count oatmeal raisin cookie box with bakery texture.',
    productOrigin: 'California, USA',
    weight: 0.3,
    shippingWeight: 0.36,
    stockLocation: 'Pantry Shelf E1',
    ingredients: 'Flour, oats, butter, raisins, brown sugar, cinnamon.',
    allergens: ['Wheat', 'Milk'],
    createdAt: daysAgo(27),
    image: media('https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=80', 'cookies.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=80', 'cookies.jpg'),
      media('https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=80', 'cookies-stack.jpg'),
    ],
    relatedKeys: ['coffee', 'tea'],
  },
  {
    key: 'peanut-butter',
    sku: 'GM-PB-16OZ',
    title: 'Stone Ground Peanut Butter 16 oz',
    brandKey: 'sunvale',
    categoryKey: 'pantry-staples',
    categoryKeys: ['pantry-staples'],
    basePrice: 7.49,
    discountPercent: 0,
    inventory: 27,
    lowStockThreshold: 9,
    viewBias: 128,
    tags: ['peanut-butter', 'pantry', 'protein'],
    features: ['Two ingredient formula', 'No palm oil', 'Stone-ground texture'],
    overview: 'A pantry refill item with high reorder potential and broad family appeal.',
    shortDescription: 'Creamy stone-ground peanut butter with no added oils.',
    productOrigin: 'Georgia, USA',
    weight: 0.45,
    shippingWeight: 0.52,
    stockLocation: 'Pantry Shelf E2',
    ingredients: 'Dry roasted peanuts, sea salt.',
    allergens: ['Peanuts'],
    createdAt: daysAgo(39),
    image: media('https://images.unsplash.com/photo-1625944524160-2d4407e4b4ea?auto=format&fit=crop&w=900&q=80', 'peanut-butter.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1625944524160-2d4407e4b4ea?auto=format&fit=crop&w=900&q=80', 'peanut-butter.jpg'),
      media('https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80', 'pb-toast.jpg'),
    ],
    relatedKeys: ['sourdough', 'juice'],
  },
  {
    key: 'olive-oil',
    sku: 'GM-OIL-EVOO',
    title: 'Extra Virgin Olive Oil 750 ml',
    brandKey: 'sunvale',
    categoryKey: 'pantry-staples',
    categoryKeys: ['pantry-staples'],
    basePrice: 16.49,
    discountPercent: 7,
    inventory: 16,
    lowStockThreshold: 6,
    viewBias: 140,
    tags: ['olive-oil', 'pantry', 'cooking'],
    features: ['Cold extracted', 'Peppery finish', 'Kitchen staple'],
    overview: 'A premium pantry item that lifts average order value and pairs well with proteins.',
    shortDescription: 'Cold-extracted extra virgin olive oil in a 750 ml bottle.',
    productOrigin: 'Spain',
    weight: 0.75,
    shippingWeight: 0.92,
    stockLocation: 'Pantry Shelf E3',
    ingredients: 'Extra virgin olive oil.',
    createdAt: daysAgo(21),
    image: media('https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80', 'olive-oil.jpg'),
    gallery: [
      media('https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80', 'olive-oil.jpg'),
      media('https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=900&q=80', 'olive-oil-bottle.jpg'),
    ],
    relatedKeys: ['salmon', 'chicken'],
  },
];

const ATTRIBUTE_DEFS = [
  {
    title: 'Pack Size',
    name: 'pack_size',
    option: 'Dropdown',
    sortOrder: 1,
    categoryKeys: ['leafy-greens', 'artisan-bakery', 'pantry-staples', 'coffee-tea', 'beverages'],
    productKeys: ['spinach', 'romaine', 'sourdough', 'croissant', 'coffee', 'tea', 'juice', 'cookies', 'peanut-butter', 'olive-oil'],
    variants: [
      { name: '250g', status: 'show', isDefault: true },
      { name: '500g', status: 'show' },
      { name: '1 L', status: 'show' },
      { name: '750 ml', status: 'show' },
      { name: '12 oz', status: 'show' },
    ],
  },
  {
    title: 'Dietary Focus',
    name: 'dietary_focus',
    option: 'Checkbox',
    sortOrder: 2,
    categoryKeys: ['leafy-greens', 'seasonal-fruit', 'coffee-tea', 'pantry-staples'],
    productKeys: ['spinach', 'romaine', 'tea', 'juice', 'peanut-butter', 'cookies'],
    variants: [
      { name: 'Organic', status: 'show', isDefault: true },
      { name: 'Gluten Free', status: 'show' },
      { name: 'Vegan Friendly', status: 'show' },
      { name: 'High Protein', status: 'show' },
    ],
  },
  {
    title: 'Roast Level',
    name: 'roast_level',
    option: 'Radio',
    sortOrder: 3,
    categoryKeys: ['coffee-tea'],
    productKeys: ['coffee', 'tea'],
    variants: [
      { name: 'Light', status: 'show' },
      { name: 'Medium', status: 'show', isDefault: true },
      { name: 'Dark', status: 'show' },
    ],
  },
];

const COUPON_DEFS = [
  {
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 25,
    customerLimit: 2,
    globalUsageLimit: 500,
    startDate: daysAgo(180),
    endDate: daysFromNow(120),
  },
  {
    code: 'PANTRY15',
    discountType: 'fixed',
    discountValue: 15,
    minOrderValue: 45,
    customerLimit: 3,
    globalUsageLimit: 250,
    categoryKeys: ['pantry-staples'],
    startDate: daysAgo(120),
    endDate: daysFromNow(90),
  },
  {
    code: 'MORNING20',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 18,
    customerLimit: 2,
    globalUsageLimit: 200,
    productKeys: ['coffee', 'tea'],
    startDate: daysAgo(150),
    endDate: daysFromNow(90),
  },
];

const DISCOUNT_RULE_DEFS = [
  {
    name: 'Farmstand Feature',
    description: 'Keeps leafy greens and cold-pressed juice moving with a visible shelf discount.',
    discountType: 'percentage',
    discountValue: 10,
    categoryKeys: ['leafy-greens', 'seasonal-fruit'],
    productKeys: ['spinach', 'juice'],
    priority: 10,
    exclusive: false,
    startDate: daysAgo(45),
    endDate: daysFromNow(45),
  },
  {
    name: 'Breakfast Favorites',
    description: 'Bundles breakfast hero products to support stronger morning baskets.',
    discountType: 'percentage',
    discountValue: 12,
    brandKeys: ['hearthstone', 'morning-peak'],
    productKeys: ['sourdough', 'coffee', 'cookies'],
    priority: 20,
    exclusive: false,
    startDate: daysAgo(30),
    endDate: daysFromNow(60),
  },
  {
    name: 'Pantry Refill',
    description: 'Maintains value visibility on pantry staples that anchor higher basket totals.',
    discountType: 'percentage',
    discountValue: 8,
    categoryKeys: ['pantry-staples'],
    productKeys: ['olive-oil', 'cookies'],
    priority: 30,
    exclusive: false,
    startDate: daysAgo(25),
    endDate: daysFromNow(75),
  },
];

const ADDRESS_DEFS = [
  {
    key: 'sophia-home',
    userKey: 'sophia',
    label: 'home',
    fullName: 'Sophia Ramirez',
    phone: '4155550102',
    email: 'sophia.ramirez@greensmarket.local',
    addressLine1: '1458 Valencia Street',
    city: 'San Francisco',
    state: 'California',
    country: 'United States',
    postalCode: '94110',
    isDefault: true,
    createdAt: daysAgo(205),
  },
  {
    key: 'ethan-home',
    userKey: 'ethan',
    label: 'home',
    fullName: 'Ethan Walker',
    phone: '4155550103',
    email: 'ethan.walker@greensmarket.local',
    addressLine1: '312 South Lamar Blvd',
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    postalCode: '78704',
    isDefault: true,
    createdAt: daysAgo(180),
  },
  {
    key: 'priya-home',
    userKey: 'priya',
    label: 'home',
    fullName: 'Priya Shah',
    phone: '4155550104',
    email: 'priya.shah@greensmarket.local',
    addressLine1: '88 Morgan Street',
    city: 'Jersey City',
    state: 'New Jersey',
    country: 'United States',
    postalCode: '07302',
    isDefault: true,
    createdAt: daysAgo(145),
  },
  {
    key: 'marcus-home',
    userKey: 'marcus',
    label: 'home',
    fullName: 'Marcus Johnson',
    phone: '4155550105',
    email: 'marcus.johnson@greensmarket.local',
    addressLine1: '701 East Pike Street',
    city: 'Seattle',
    state: 'Washington',
    country: 'United States',
    postalCode: '98122',
    isDefault: true,
    createdAt: daysAgo(100),
  },
  {
    key: 'aisha-home',
    userKey: 'aisha',
    label: 'home',
    fullName: 'Aisha Khan',
    phone: '4155550106',
    email: 'aisha.khan@greensmarket.local',
    addressLine1: '2045 West Belmont Avenue',
    city: 'Chicago',
    state: 'Illinois',
    country: 'United States',
    postalCode: '60618',
    isDefault: true,
    createdAt: daysAgo(52),
  },
  {
    key: 'support-work',
    userKey: 'support',
    label: 'work',
    fullName: 'Nina Brooks',
    phone: '4155550101',
    email: 'support.demo@greensmarket.local',
    addressLine1: '890 Market Street',
    city: 'San Francisco',
    state: 'California',
    country: 'United States',
    postalCode: '94102',
    isDefault: true,
    createdAt: daysAgo(210),
  },
];

const CART_DEFS = [
  {
    userKey: 'sophia',
    items: [
      { productKey: 'coffee', quantity: 1 },
      { productKey: 'croissant', quantity: 2 },
    ],
    cartDiscount: 0,
    createdAt: daysAgo(2, 14),
  },
  {
    userKey: 'ethan',
    items: [
      { productKey: 'salmon', quantity: 1 },
      { productKey: 'olive-oil', quantity: 1 },
    ],
    cartDiscount: 5,
    createdAt: daysAgo(4, 16),
  },
  {
    userKey: 'aisha',
    items: [
      { productKey: 'juice', quantity: 2 },
      { productKey: 'cookies', quantity: 1 },
    ],
    cartDiscount: 0,
    createdAt: daysAgo(1, 15),
  },
];

const WISHLIST_DEFS = [
  { userKey: 'sophia', productKey: 'salmon', priority: 'HIGH', notes: 'For next dinner prep order.' },
  { userKey: 'sophia', productKey: 'olive-oil', priority: 'MEDIUM', notes: 'Wait for pantry promo.' },
  { userKey: 'ethan', productKey: 'sourdough', priority: 'MEDIUM', notes: 'Pair with next seafood order.' },
  { userKey: 'priya', productKey: 'coffee', priority: 'HIGH', notes: 'Try the breakfast bundle.' },
  { userKey: 'priya', productKey: 'peanut-butter', priority: 'LOW', notes: 'Family pantry refill.' },
  { userKey: 'marcus', productKey: 'juice', priority: 'MEDIUM', notes: 'Add to office breakfast run.' },
  { userKey: 'aisha', productKey: 'croissant', priority: 'HIGH', notes: 'Weekend brunch add-on.' },
  { userKey: 'aisha', productKey: 'spinach', priority: 'MEDIUM', notes: 'Smoothie prep staple.' },
];

const ORDER_DEFS = [
  {
    key: 'seed-order-001',
    userKey: 'sophia',
    items: [
      { productKey: 'spinach', quantity: 2 },
      { productKey: 'sourdough', quantity: 1 },
      { productKey: 'juice', quantity: 1 },
    ],
    couponCode: 'WELCOME10',
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'website',
    priority: 'medium',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0001',
    amountPaidRatio: 1,
    createdAt: daysAgo(210, 9),
    additionalNotes: 'Leave with the concierge desk.',
  },
  {
    key: 'seed-order-002',
    userKey: 'ethan',
    items: [
      { productKey: 'salmon', quantity: 2 },
      { productKey: 'olive-oil', quantity: 1 },
    ],
    shippingMethod: 'express',
    shippingPrice: 7.99,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'app',
    priority: 'high',
    carrier: 'FedEx',
    trackingNumber: 'FDXSEED0002',
    amountPaidRatio: 1,
    createdAt: daysAgo(190, 11),
  },
  {
    key: 'seed-order-003',
    userKey: 'priya',
    items: [
      { productKey: 'chicken', quantity: 1 },
      { productKey: 'croissant', quantity: 2 },
      { productKey: 'spinach', quantity: 1 },
    ],
    shippingMethod: 'pickup',
    shippingPrice: 0,
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    status: 'completed',
    source: 'pos',
    priority: 'medium',
    amountPaidRatio: 1,
    createdAt: daysAgo(170, 13),
    additionalNotes: 'Prepared for in-store pickup after 5 PM.',
  },
  {
    key: 'seed-order-004',
    userKey: 'marcus',
    items: [
      { productKey: 'coffee', quantity: 2 },
      { productKey: 'cookies', quantity: 2 },
    ],
    couponCode: 'MORNING20',
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    status: 'completed',
    source: 'marketplace',
    priority: 'medium',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0004',
    amountPaidRatio: 1,
    createdAt: daysAgo(150, 10),
  },
  {
    key: 'seed-order-005',
    userKey: 'aisha',
    items: [
      { productKey: 'tea', quantity: 2 },
      { productKey: 'juice', quantity: 2 },
      { productKey: 'peanut-butter', quantity: 1 },
    ],
    shippingMethod: 'express',
    shippingPrice: 6.99,
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'app',
    priority: 'medium',
    carrier: 'DHL',
    trackingNumber: 'DHLSEED0005',
    amountPaidRatio: 1,
    createdAt: daysAgo(130, 12),
  },
  {
    key: 'seed-order-006',
    userKey: 'sophia',
    items: [
      { productKey: 'salmon', quantity: 1 },
      { productKey: 'spinach', quantity: 1 },
      { productKey: 'olive-oil', quantity: 1 },
    ],
    shippingMethod: 'express',
    shippingPrice: 7.49,
    paymentMethod: 'credit_card',
    paymentStatus: 'partial',
    status: 'processing',
    source: 'website',
    priority: 'high',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0006',
    amountPaidRatio: 0.5,
    createdAt: daysAgo(105, 9),
  },
  {
    key: 'seed-order-007',
    userKey: 'ethan',
    items: [
      { productKey: 'sourdough', quantity: 1 },
      { productKey: 'croissant', quantity: 1 },
      { productKey: 'coffee', quantity: 1 },
    ],
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'wallet',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'website',
    priority: 'low',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0007',
    amountPaidRatio: 1,
    createdAt: daysAgo(90, 8),
  },
  {
    key: 'seed-order-008',
    userKey: 'priya',
    items: [
      { productKey: 'chicken', quantity: 1 },
      { productKey: 'croissant', quantity: 1 },
    ],
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'failed',
    status: 'canceled',
    source: 'website',
    priority: 'medium',
    amountPaidRatio: 0,
    createdAt: daysAgo(75, 14),
    additionalNotes: 'Payment was not completed before cutoff.',
  },
  {
    key: 'seed-order-009',
    userKey: 'marcus',
    items: [
      { productKey: 'coffee', quantity: 2 },
      { productKey: 'tea', quantity: 1 },
      { productKey: 'cookies', quantity: 1 },
    ],
    couponCode: 'MORNING20',
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'app',
    priority: 'medium',
    carrier: 'FedEx',
    trackingNumber: 'FDXSEED0009',
    amountPaidRatio: 1,
    createdAt: daysAgo(60, 9),
  },
  {
    key: 'seed-order-010',
    userKey: 'aisha',
    items: [
      { productKey: 'juice', quantity: 3 },
      { productKey: 'spinach', quantity: 2 },
      { productKey: 'romaine', quantity: 1 },
    ],
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    status: 'shipped',
    source: 'app',
    priority: 'medium',
    carrier: 'DHL',
    trackingNumber: 'DHLSEED0010',
    amountPaidRatio: 1,
    createdAt: daysAgo(45, 11),
  },
  {
    key: 'seed-order-011',
    userKey: 'sophia',
    items: [
      { productKey: 'peanut-butter', quantity: 2 },
      { productKey: 'olive-oil', quantity: 1 },
      { productKey: 'sourdough', quantity: 1 },
    ],
    couponCode: 'PANTRY15',
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    status: 'delivered',
    source: 'website',
    priority: 'medium',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0011',
    amountPaidRatio: 1,
    createdAt: daysAgo(30, 10),
  },
  {
    key: 'seed-order-012',
    userKey: 'ethan',
    items: [
      { productKey: 'salmon', quantity: 1 },
      { productKey: 'coffee', quantity: 1 },
    ],
    shippingMethod: 'overnight',
    shippingPrice: 9.99,
    paymentMethod: 'credit_card',
    paymentStatus: 'unpaid',
    status: 'pending',
    source: 'website',
    priority: 'high',
    amountPaidRatio: 0,
    createdAt: daysAgo(18, 15),
  },
  {
    key: 'seed-order-013',
    userKey: 'priya',
    items: [
      { productKey: 'romaine', quantity: 1 },
      { productKey: 'juice', quantity: 1 },
      { productKey: 'cookies', quantity: 1 },
    ],
    couponCode: 'WELCOME10',
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    status: 'out-for-delivery',
    source: 'app',
    priority: 'medium',
    carrier: 'UPS',
    trackingNumber: '1ZSEED0013',
    amountPaidRatio: 1,
    createdAt: daysAgo(7, 9),
  },
  {
    key: 'seed-order-014',
    userKey: 'marcus',
    items: [
      { productKey: 'sourdough', quantity: 1 },
      { productKey: 'croissant', quantity: 2 },
      { productKey: 'peanut-butter', quantity: 1 },
    ],
    shippingMethod: 'standard',
    shippingPrice: 4.99,
    paymentMethod: 'wallet',
    paymentStatus: 'pending',
    status: 'awaiting-fulfillment',
    source: 'website',
    priority: 'medium',
    amountPaidRatio: 0,
    createdAt: daysAgo(2, 13),
  },
];

const REVIEW_DEFS = [
  {
    userKey: 'sophia',
    productKey: 'spinach',
    rating: 5,
    title: 'Perfect for weekday salads',
    review: 'The leaves arrived crisp and dry, which matters when the whole order is built around quick lunches.',
    helpfulVotes: 8,
    createdAt: daysAgo(165),
  },
  {
    userKey: 'sophia',
    productKey: 'sourdough',
    rating: 5,
    title: 'Bakery quality every time',
    review: 'Strong crust, soft center, and it still tastes fresh the next morning.',
    helpfulVotes: 6,
    createdAt: daysAgo(82),
  },
  {
    userKey: 'ethan',
    productKey: 'salmon',
    rating: 4,
    title: 'Reliable seafood for meal prep',
    review: 'The portions are consistent and the packaging holds temperature well during delivery.',
    helpfulVotes: 5,
    createdAt: daysAgo(140),
  },
  {
    userKey: 'priya',
    productKey: 'croissant',
    rating: 5,
    title: 'Weekend brunch staple',
    review: 'Flaky layers and just enough butter. Reheats nicely in the oven.',
    helpfulVotes: 4,
    createdAt: daysAgo(92),
  },
  {
    userKey: 'marcus',
    productKey: 'coffee',
    rating: 5,
    title: 'Easy repeat buy',
    review: 'This has become the default office coffee because it works for both drip and pour-over.',
    helpfulVotes: 7,
    createdAt: daysAgo(48),
  },
  {
    userKey: 'marcus',
    productKey: 'cookies',
    rating: 4,
    title: 'Good add-on with coffee orders',
    review: 'Soft texture and not overly sweet. Good basket builder item.',
    helpfulVotes: 3,
    createdAt: daysAgo(38),
  },
  {
    userKey: 'aisha',
    productKey: 'juice',
    rating: 4,
    title: 'Tastes freshly pressed',
    review: 'Balanced acidity and no syrupy finish. Works well in breakfast orders.',
    helpfulVotes: 4,
    createdAt: daysAgo(24),
  },
  {
    userKey: 'aisha',
    productKey: 'tea',
    rating: 5,
    title: 'Clean and easy daily tea',
    review: 'Light, smooth, and easy to keep in a regular reorder cycle.',
    helpfulVotes: 2,
    createdAt: daysAgo(20),
  },
];

async function upsertDocument(Model, filter, payload, timestamps) {
  const doc = await Model.findOneAndUpdate(
    filter,
    { $set: payload },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  if (timestamps) {
    await Model.updateOne(
      { _id: doc._id },
      {
        $set: {
          createdAt: timestamps.createdAt,
          updatedAt: timestamps.updatedAt || timestamps.createdAt,
        },
      }
    );
  }

  return doc;
}

function buildLoginHistory(user) {
  return [
    {
      loginTime: user.lastLogin,
      ipAddress: '127.0.0.1',
      userAgent: 'Seeded Demo Session',
      successful: true,
      location: {
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      },
      browser: { name: 'Chrome', major: '136' },
      os: { name: 'Windows', version: '11' },
      device: { vendor: 'Seed', model: 'Local Demo', type: 'desktop' },
      security: { suspiciousScore: 0, riskLevel: 'low', flags: [] },
      loginMethod: 'password',
      otpUsed: 'none',
    },
  ];
}

function buildAddressSnapshot(address) {
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
}

function getFinalPrice(basePrice, discountPercent) {
  if (!discountPercent) return roundMoney(basePrice);
  return roundMoney(basePrice - ((basePrice * discountPercent) / 100));
}

function buildProductPayload(def, adminId, categories, brands) {
  const basePrice = roundMoney(def.basePrice);
  const finalPrice = getFinalPrice(basePrice, def.discountPercent || 0);
  const categoryIds = def.categoryKeys.map((key) => categories[key]._id);
  const primaryCategory = categories[def.categoryKey];
  const brand = brands[def.brandKey];

  return {
    title: def.title,
    sku: def.sku,
    slug: toSlug(def.title),
    productType: 'physical',
    category: primaryCategory._id,
    categories: categoryIds,
    brand: brand._id,
    descriptions: {
      summary: def.shortDescription,
      content: def.overview,
      sourcing: `Sourced from ${def.productOrigin}.`,
    },
    shortDescription: def.shortDescription,
    overview: def.overview,
    features: def.features,
    specifications: {
      origin: def.productOrigin,
      storage: def.categoryKey === 'protein-seafood' ? 'Keep refrigerated' : 'Store in a cool dry place',
      location: def.stockLocation,
    },
    customAttributes: {
      seededBy: SEED_TAG,
      replenishment: def.inventory <= def.lowStockThreshold ? 'urgent' : 'steady',
    },
    tags: [...def.tags, SEED_TAG],
    basePrice,
    finalPrice,
    comparePrice: basePrice,
    costPrice: roundMoney(basePrice * 0.62),
    salePrice: finalPrice,
    retailPrice: basePrice,
    taxClass: 'standard',
    taxRate: 6,
    discountType: def.discountPercent ? 'percentage' : 'none',
    discountValue: def.discountPercent || 0,
    discount: def.discountPercent || 0,
    inventory: def.inventory,
    lowStockThreshold: def.lowStockThreshold,
    trackInventory: true,
    allowBackorder: false,
    minOrderQuantity: 1,
    maxOrderQuantity: 8,
    stockLocation: def.stockLocation,
    supplier: brand.name,
    supplierSku: `${def.sku}-SUP`,
    weight: def.weight,
    shippingWeight: def.shippingWeight,
    shipping: {
      requiresShipping: true,
      shippingClass: def.categoryKey === 'protein-seafood' ? 'cold-chain' : 'standard',
      handlingTime: def.categoryKey === 'protein-seafood' ? 0 : 1,
      fragile: def.key === 'juice' || def.key === 'olive-oil',
    },
    ingredients: def.ingredients,
    allergens: def.allergens || [],
    certifications: def.certifications || [],
    seo_info: {
      title: def.title,
      description: def.shortDescription,
      keywords: def.tags.join(', '),
      slug: toSlug(def.title),
    },
    visibility: 'public',
    publishDate: def.createdAt,
    status: 'active',
    isFeatured: ['spinach', 'salmon', 'sourdough', 'coffee', 'juice'].includes(def.key),
    trending: ['salmon', 'coffee', 'juice'].includes(def.key),
    newArrival: ['spinach', 'sourdough', 'coffee', 'juice'].includes(def.key),
    bestseller: ['salmon', 'coffee', 'sourdough'].includes(def.key),
    onSale: Boolean(def.discountPercent),
    mainImage: def.image,
    images: def.gallery,
    socialMedia: {
      hashtags: def.tags,
    },
    isAvailable: true,
    metaTitle: def.title,
    metaDescription: def.shortDescription,
    created_by: adminId,
    updated_by: adminId,
    returnPolicy: 'Return unopened items within 7 days.',
    shippingDetails: def.categoryKey === 'protein-seafood' ? 'Ships in insulated packaging.' : 'Ships in same-day delivery totes.',
    availability: def.inventory > 0 ? 'In Stock' : 'Out of Stock',
    ecoFriendly: ['spinach', 'romaine', 'tea'].includes(def.key),
    discountStartDate: def.discountPercent ? daysAgo(20) : null,
    discountEndDate: def.discountPercent ? daysFromNow(35) : null,
    productOrigin: def.productOrigin,
    returnPeriod: 7,
    views: 0,
    total_view: 0,
    soldCount: 0,
    analytics: {
      views: 0,
      clicks: 0,
      conversions: 0,
    },
  };
}

function couponMatchesProduct(coupon, product) {
  const productId = String(product._id);
  const productIds = new Set((coupon.productIds || []).map((id) => String(id)));
  const categoryIds = new Set((coupon.categoryIds || []).map((id) => String(id)));
  const brandIds = new Set((coupon.brandIds || []).map((id) => String(id)));
  const tags = new Set(coupon.tags || []);

  const hasTargets = productIds.size || categoryIds.size || brandIds.size || tags.size;
  if (!hasTargets) {
    return true;
  }

  const productCategoryIds = [product.category, ...(product.categories || [])].filter(Boolean).map((id) => String(id));
  const productTags = new Set(product.tags || []);

  return productIds.has(productId)
    || productCategoryIds.some((categoryId) => categoryIds.has(categoryId))
    || (product.brand && brandIds.has(String(product.brand)))
    || [...productTags].some((tag) => tags.has(tag));
}

function computeCouponDiscount(coupon, items, productsByKey) {
  if (!coupon) {
    return 0;
  }

  const subtotal = items.reduce((sum, item) => {
    const product = productsByKey[item.productKey];
    return sum + ((product.finalPrice || product.basePrice) * item.quantity);
  }, 0);

  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return 0;
  }

  const eligibleSubtotal = items.reduce((sum, item) => {
    const product = productsByKey[item.productKey];
    if (!couponMatchesProduct(coupon, product)) {
      return sum;
    }
    return sum + ((product.finalPrice || product.basePrice) * item.quantity);
  }, 0);

  if (eligibleSubtotal <= 0) {
    return 0;
  }

  if (coupon.discountType === 'percentage') {
    return roundMoney((eligibleSubtotal * coupon.discountValue) / 100);
  }

  return roundMoney(Math.min(coupon.discountValue, eligibleSubtotal));
}

async function resetSeedData() {
  const userEmails = USER_DEFS.map((user) => user.email);
  const productSkus = PRODUCT_DEFS.map((product) => product.sku);
  const categorySlugs = CATEGORY_DEFS.map((category) => toSlug(category.title));
  const brandSlugs = BRAND_DEFS.map((brand) => toSlug(brand.name));
  const couponCodes = COUPON_DEFS.map((coupon) => coupon.code);
  const discountRuleNames = DISCOUNT_RULE_DEFS.map((rule) => rule.name);
  const attributeNames = ATTRIBUTE_DEFS.map((attribute) => attribute.name);
  const orderKeys = ORDER_DEFS.map((order) => order.key);

  const [productIds, userIds] = await Promise.all([
    Product.find({ sku: { $in: productSkus } }).distinct('_id'),
    User.find({ email: { $in: userEmails } }).distinct('_id'),
  ]);

  await Review.deleteMany({ $or: [{ user: { $in: userIds } }, { product: { $in: productIds } }] });
  await Wishlist.deleteMany({ user: { $in: userIds } });
  await Cart.deleteMany({ user: { $in: userIds } });
  await Address.deleteMany({ user: { $in: userIds } });
  await Order.deleteMany({ idempotencyKey: { $in: orderKeys } });
  await AppliedDiscount.deleteMany({ productId: { $in: productIds } });
  await DiscountRule.deleteMany({ name: { $in: discountRuleNames } });
  await PromoCode.deleteMany({ code: { $in: couponCodes } });
  await Attribute.deleteMany({ name: { $in: attributeNames } });
  await Product.deleteMany({ sku: { $in: productSkus } });
  await Brand.deleteMany({ slug: { $in: brandSlugs } });
  await Category.deleteMany({ slug: { $in: categorySlugs } });
  await User.deleteMany({ email: { $in: userEmails } });
}

async function seedPermissions() {
  const permissions = {};

  for (const def of PERMISSION_DEFS) {
    permissions[def.key] = await upsertDocument(
      Permission,
      { key: def.key },
      {
        ...def,
        isActive: true,
        isDefault: def.key === 'read:catalog',
      },
      { createdAt: daysAgo(260), updatedAt: daysAgo(5) }
    );
  }

  return permissions;
}

async function seedRoles(permissions) {
  const roles = {};

  for (const def of ROLE_DEFS) {
    roles[def.name] = await upsertDocument(
      Role,
      { name: def.name },
      {
        name: def.name,
        description: def.description,
        permissions: def.permissionKeys.map((key) => permissions[key]._id),
        isDefault: Boolean(def.isDefault),
        isActive: true,
        isDeleted: false,
      },
      { createdAt: daysAgo(260), updatedAt: daysAgo(5) }
    );
  }

  return roles;
}

async function seedUsers(tenant, roles) {
  const users = {};

  for (const def of USER_DEFS) {
    const hashPassword = await bcrypt.hash(def.password, 10);
    users[def.key] = await upsertDocument(
      User,
      { email: def.email },
      {
        username: def.username,
        email: def.email,
        hash_password: hashPassword,
        role: roles[def.role]._id,
        firstName: def.firstName,
        lastName: def.lastName,
        isActive: true,
        tenantId: tenant._id,
        gender: def.gender,
        phoneNumber: def.phoneNumber,
        isVerified: true,
        emailVerified: true,
        phoneVerified: true,
        lastLogin: def.lastLogin,
        loginHistory: buildLoginHistory(def),
        socialMedia: {},
        preferences: {
          newsletter: true,
          notifications: true,
          language: 'en',
          currency: 'USD',
          theme: 'light',
        },
        interests: def.interests,
        loyaltyPoints: 0,
        referralCode: `${def.firstName.slice(0, 3).toUpperCase()}-${def.lastName.slice(0, 3).toUpperCase()}-${def.phoneNumber.slice(-3)}`,
        paymentMethods: [
          {
            method: def.paymentMethod,
            details: {
              holderName: `${def.firstName} ${def.lastName}`,
              cardNumber: def.paymentMethod === 'credit_card' ? '**** **** **** 4242' : null,
            },
            isDefault: true,
          },
        ],
        shippingPreferences: {
          deliveryMethod: def.deliveryMethod,
          deliveryInstructions: def.role === 'customer' ? 'Ring doorbell and leave with insulated tote.' : null,
          preferredTime: def.role === 'customer' ? '10:00-14:00' : null,
        },
        subscriptionStatus: def.subscriptionStatus,
        subscriptionType: def.subscriptionType,
        status: 'active',
      },
      { createdAt: def.createdAt, updatedAt: def.lastLogin }
    );
  }

  await User.updateOne({ _id: users.admin._id }, { $set: { created_by: users.admin._id, updated_by: users.admin._id } });
  await User.updateOne({ _id: users.support._id }, { $set: { created_by: users.admin._id, updated_by: users.admin._id } });

  for (const def of USER_DEFS.filter((user) => user.role === 'customer')) {
    await User.updateOne(
      { _id: users[def.key]._id },
      { $set: { created_by: users.admin._id, updated_by: users.admin._id } }
    );
  }

  return users;
}

async function seedCategories(adminUser) {
  const categories = {};

  for (const def of CATEGORY_DEFS) {
    const parent = def.parentKey ? categories[def.parentKey] : null;
    categories[def.key] = await upsertDocument(
      Category,
      { slug: toSlug(def.title) },
      {
        title: def.title,
        slug: toSlug(def.title),
        parent: parent ? parent._id : null,
        children: [],
        status: 'active',
        images: [def.image],
        descriptions: def.descriptions,
        created_by: adminUser._id,
        updated_by: adminUser._id,
        metaTitle: def.title,
        metaDescription: def.descriptions,
        metaKeywords: [def.title.toLowerCase(), 'grocery', 'catalog'],
        isFeatured: def.isFeatured,
        displayOrder: def.displayOrder,
        visibility: true,
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );
  }

  for (const def of CATEGORY_DEFS) {
    if (!def.parentKey) continue;

    const parent = categories[def.parentKey];
    const child = categories[def.key];
    await Category.updateOne(
      { _id: parent._id },
      { $addToSet: { children: child._id } }
    );
  }

  return categories;
}

async function seedBrands(adminUser) {
  const brands = {};

  for (const def of BRAND_DEFS) {
    brands[def.key] = await upsertDocument(
      Brand,
      { slug: toSlug(def.name) },
      {
        name: def.name,
        slug: toSlug(def.name),
        status: 'active',
        images: [def.image],
        contact: {
          email: `hello@${toSlug(def.name)}.local`,
          phone: '4155550199',
          website: `https://demo.${toSlug(def.name)}.local`,
        },
        tagline: def.tagline,
        descriptions: def.descriptions,
        seo: {
          metaTitle: def.name,
          metaDescription: def.descriptions,
          keywords: [def.key, 'demo', 'seeded'],
        },
        establishedYear: def.establishedYear,
        parentCompany: def.name,
        country: def.country,
        created_by: adminUser._id,
        updated_by: adminUser._id,
        socialMedia: {
          instagram: `https://instagram.com/${def.key}`,
        },
        isActive: true,
        rating: def.rating,
        isFeatured: def.isFeatured,
        displayOrder: def.displayOrder,
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );
  }

  return brands;
}

async function seedProducts(adminUser, categories, brands) {
  const products = {};

  for (const def of PRODUCT_DEFS) {
    const payload = buildProductPayload(def, adminUser._id, categories, brands);
    products[def.key] = await upsertDocument(
      Product,
      { sku: def.sku },
      payload,
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );
  }

  for (const def of PRODUCT_DEFS) {
    const relatedProducts = (def.relatedKeys || []).map((key) => products[key]._id);
    await Product.updateOne(
      { _id: products[def.key]._id },
      {
        $set: {
          relatedProducts,
          crossSells: (def.relatedKeys || []).map((key) => products[key].title),
          upSells: (def.relatedKeys || []).map((key) => products[key].title),
        },
      }
    );
  }

  return products;
}

async function seedAttributes(adminUser, categories, products) {
  const attributes = {};

  for (const def of ATTRIBUTE_DEFS) {
    attributes[def.name] = await upsertDocument(
      Attribute,
      { name: def.name },
      {
        title: def.title,
        name: def.name,
        option: def.option,
        type: 'attribute',
        status: 'show',
        sortOrder: def.sortOrder,
        isGlobal: true,
        created_by: adminUser._id,
        updated_by: adminUser._id,
        meta: {
          tags: [SEED_TAG, 'storefront'],
          notes: 'Seeded demo attribute for storefront filters.',
        },
        isActive: true,
        associatedCategories: def.categoryKeys.map((key) => categories[key]._id),
        applicableProducts: def.productKeys.map((key) => products[key]._id),
        variants: def.variants.map((variant, index) => ({
          name: variant.name,
          status: variant.status,
          additionalInfo: 'Seeded demo variant',
          priceAdjustment: 0,
          sku: `${def.name.toUpperCase()}-${index + 1}`,
          stockQuantity: 100,
          isDefault: Boolean(variant.isDefault),
        })),
      },
      { createdAt: daysAgo(40), updatedAt: daysAgo(5) }
    );
  }

  return attributes;
}

async function seedCoupons(categories, brands, products) {
  const coupons = {};

  for (const def of COUPON_DEFS) {
    coupons[def.code] = await upsertDocument(
      PromoCode,
      { code: def.code },
      {
        code: def.code,
        discountType: def.discountType,
        discountValue: def.discountValue,
        productIds: (def.productKeys || []).map((key) => products[key]._id),
        categoryIds: (def.categoryKeys || []).map((key) => categories[key]._id),
        brandIds: (def.brandKeys || []).map((key) => brands[key]._id),
        tags: [SEED_TAG],
        minOrderValue: def.minOrderValue,
        customerLimit: def.customerLimit,
        globalUsageLimit: def.globalUsageLimit,
        usedCount: 0,
        startDate: def.startDate,
        endDate: def.endDate,
        isActive: true,
        exclusive: false,
      },
      { createdAt: def.startDate, updatedAt: def.startDate }
    );
  }

  return coupons;
}

async function seedDiscountRules(adminUser, categories, brands, products) {
  const discountRules = {};

  for (const def of DISCOUNT_RULE_DEFS) {
    discountRules[def.name] = await upsertDocument(
      DiscountRule,
      { name: def.name },
      {
        name: def.name,
        description: def.description,
        in_use: true,
        discountType: def.discountType,
        discountValue: def.discountValue,
        productIds: (def.productKeys || []).map((key) => products[key]._id),
        categoryIds: (def.categoryKeys || []).map((key) => categories[key]._id),
        brandIds: (def.brandKeys || []).map((key) => brands[key]._id),
        tags: [SEED_TAG],
        startDate: def.startDate,
        endDate: def.endDate,
        created_by: adminUser._id,
        updated_by: adminUser._id,
        priority: def.priority,
        exclusive: def.exclusive,
        isActive: true,
      },
      { createdAt: def.startDate, updatedAt: def.startDate }
    );
  }

  return discountRules;
}

async function seedAppliedDiscounts(discountRules, products) {
  for (const def of DISCOUNT_RULE_DEFS) {
    const rule = discountRules[def.name];

    for (const productKey of def.productKeys || []) {
      await upsertDocument(
        AppliedDiscount,
        { ruleId: rule._id, productId: products[productKey]._id },
        {
          ruleId: rule._id,
          productId: products[productKey]._id,
          appliedAt: daysAgo(10),
          isActive: true,
        },
        { createdAt: daysAgo(10), updatedAt: daysAgo(10) }
      );
    }
  }
}

async function seedAddresses(users) {
  const addressesByKey = {};
  const addressesByUser = {};

  for (const def of ADDRESS_DEFS) {
    const user = users[def.userKey];
    const address = await upsertDocument(
      Address,
      { user: user._id, label: def.label, addressLine1: def.addressLine1 },
      {
        user: user._id,
        label: def.label,
        fullName: def.fullName,
        phone: def.phone,
        email: def.email,
        status: 'active',
        addressLine1: def.addressLine1,
        city: def.city,
        state: def.state,
        country: def.country,
        postalCode: def.postalCode,
        isDefault: def.isDefault,
        isVerified: true,
        coordinates: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        created_by: user._id,
        updated_by: user._id,
        tags: [SEED_TAG, def.label],
        history: [
          {
            action: 'created',
            user: user._id,
            timestamp: def.createdAt,
            changes: [],
          },
        ],
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );

    addressesByKey[def.key] = address;
    addressesByUser[def.userKey] = addressesByUser[def.userKey] || [];
    addressesByUser[def.userKey].push(address);
  }

  return { addressesByKey, addressesByUser };
}

async function seedCarts(users, products) {
  const cartsByUser = {};

  for (const def of CART_DEFS) {
    const user = users[def.userKey];
    const items = def.items.map((item) => ({
      product: products[item.productKey]._id,
      quantity: item.quantity,
      itemDiscount: 0,
      addedAt: def.createdAt,
    }));

    cartsByUser[def.userKey] = await upsertDocument(
      Cart,
      { user: user._id, status: 'active' },
      {
        user: user._id,
        items,
        status: 'active',
        cartDiscount: def.cartDiscount,
        metadata: {
          seededBy: SEED_TAG,
          lastIntent: 'wishlist-to-cart',
        },
        created_by: user._id,
        updated_by: user._id,
        version: 1,
        lastModified: def.createdAt,
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );
  }

  return cartsByUser;
}

async function seedWishlists(users, products) {
  const wishlistsByUser = {};

  for (const def of WISHLIST_DEFS) {
    const user = users[def.userKey];
    const wishlistItem = await upsertDocument(
      Wishlist,
      { user: user._id, product: products[def.productKey]._id },
      {
        user: user._id,
        product: products[def.productKey]._id,
        created_by: user._id,
        updated_by: user._id,
        notes: def.notes,
        priority: def.priority,
        status: 'ACTIVE',
        tags: [SEED_TAG, 'demo'],
        auditTrail: [
          {
            action: 'CREATE',
            performedBy: user._id,
            timestamp: daysAgo(14),
            changes: {},
          },
        ],
      },
      { createdAt: daysAgo(14), updatedAt: daysAgo(14) }
    );

    wishlistsByUser[def.userKey] = wishlistsByUser[def.userKey] || [];
    wishlistsByUser[def.userKey].push(wishlistItem);
  }

  return wishlistsByUser;
}

async function seedOrders(users, addresses, products, coupons) {
  const ordersByUser = {};
  const ordersByKey = {};

  for (let index = 0; index < ORDER_DEFS.length; index += 1) {
    const def = ORDER_DEFS[index];
    const user = users[def.userKey];
    const primaryAddress = (addresses.addressesByUser[def.userKey] || [])[0];
    const orderItems = def.items.map((item) => {
      const product = products[item.productKey];
      return {
        product: product._id,
        quantity: item.quantity,
        price: product.finalPrice || product.basePrice,
        discount: 0,
        sku: product.sku,
      };
    });

    const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0));
    const coupon = def.couponCode ? coupons[def.couponCode] : null;
    const discountAmount = computeCouponDiscount(coupon, def.items, products);
    const taxAmount = roundMoney(subtotal * 0.06);
    const total = roundMoney(subtotal + taxAmount + def.shippingPrice - discountAmount);
    const amountPaid = roundMoney(total * def.amountPaidRatio);
    const paymentStatus = def.paymentStatus;

    const transactions = amountPaid > 0
      ? [
        {
          transactionId: `txn_${def.key}`,
          amount: amountPaid,
          status: paymentStatus === 'partial' ? 'completed' : (paymentStatus === 'paid' ? 'completed' : 'pending'),
          timestamp: def.createdAt,
        },
      ]
      : [];

    const order = await upsertDocument(
      Order,
      { idempotencyKey: def.key },
      {
        user: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber,
        shippingAddress: buildAddressSnapshot(primaryAddress),
        billingAddress: buildAddressSnapshot(primaryAddress),
        shippingMethod: def.shippingMethod,
        shippingPrice: def.shippingPrice,
        items: orderItems,
        additionalNotes: def.additionalNotes || '',
        notes: [`Seeded by ${SEED_TAG}`],
        couponCode: def.couponCode || '',
        idempotencyKey: def.key,
        discountAmount,
        payment_method: def.paymentMethod,
        transaction_id: transactions[0]?.transactionId || '',
        transactions,
        payment_status: paymentStatus,
        subtotal,
        taxAmount,
        total,
        amount_due: roundMoney(total - amountPaid),
        amount_paid: amountPaid,
        currency: 'USD',
        invoice: `INV-SEED-${String(index + 1).padStart(4, '0')}`,
        order_id: `ECO-SEED-${String(index + 1).padStart(4, '0')}`,
        status: def.status,
        orderSource: def.source,
        trackingNumber: def.trackingNumber || '',
        carrier: def.carrier || '',
        created_by: user._id,
        updated_by: user._id,
        fraudScore: def.status === 'canceled' ? 35 : 8,
        complianceStatus: def.status === 'canceled' ? 'flagged' : 'approved',
        priorityLevel: def.priority,
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );

    ordersByKey[def.key] = order;
    ordersByUser[def.userKey] = ordersByUser[def.userKey] || [];
    ordersByUser[def.userKey].push(order);
  }

  return { ordersByKey, ordersByUser };
}

async function seedReviews(users, products) {
  const reviewsByProduct = {};

  for (const def of REVIEW_DEFS) {
    const user = users[def.userKey];
    const product = products[def.productKey];
    const review = await upsertDocument(
      Review,
      { user: user._id, product: product._id },
      {
        user: user._id,
        product: product._id,
        rating: def.rating,
        title: def.title,
        review: def.review,
        images: [],
        helpfulVotes: def.helpfulVotes,
        reported: false,
        created_by: user._id,
        updated_by: user._id,
      },
      { createdAt: def.createdAt, updatedAt: def.createdAt }
    );

    reviewsByProduct[def.productKey] = reviewsByProduct[def.productKey] || [];
    reviewsByProduct[def.productKey].push(review);
  }

  return reviewsByProduct;
}

async function syncCouponUsage(coupons) {
  for (const [code, coupon] of Object.entries(coupons)) {
    const usedCount = await Order.countDocuments({
      couponCode: code,
      status: { $nin: ['canceled', 'failed'] },
    });

    await PromoCode.updateOne(
      { _id: coupon._id },
      { $set: { usedCount } }
    );
  }
}

async function syncBrandCounts(brands) {
  for (const brand of Object.values(brands)) {
    const totalProducts = await Product.countDocuments({ brand: brand._id, isDeleted: { $ne: true } });
    await Brand.updateOne({ _id: brand._id }, { $set: { totalProducts } });
  }
}

async function syncProductStats(products, orders, reviewsByProduct) {
  const soldCounts = {};

  for (const order of Object.values(orders.ordersByKey)) {
    if (['canceled', 'failed', 'refunded'].includes(order.status)) {
      continue;
    }

    for (const item of order.items || []) {
      const productId = String(item.product);
      soldCounts[productId] = (soldCounts[productId] || 0) + item.quantity;
    }
  }

  for (const [key, product] of Object.entries(products)) {
    const soldCount = soldCounts[String(product._id)] || 0;
    const productDef = PRODUCT_DEFS.find((def) => def.key === key);
    const views = soldCount > 0 ? (soldCount * 18) + productDef.viewBias : productDef.viewBias;
    const clicks = Math.round(views * 0.28);
    const reviews = reviewsByProduct[key] || [];
    const averageRating = reviews.length
      ? roundMoney(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length)
      : 0;

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          soldCount,
          views,
          total_view: views,
          analytics: {
            views,
            clicks,
            conversions: soldCount,
          },
          averageRating,
          totalReviews: reviews.length,
          reviews: reviews.map((review) => review._id),
        },
      }
    );
  }
}

async function syncUserRelations(users, products, addresses, carts, wishlists, orders) {
  for (const def of USER_DEFS) {
    const user = users[def.key];
    const favoriteProducts = (def.favoriteProductKeys || []).map((key) => products[key]._id);
    const userOrders = (orders.ordersByUser[def.key] || []).map((order) => order._id);
    const userAddresses = (addresses.addressesByUser[def.key] || []).map((address) => address._id);
    const userWishlists = wishlists[def.key] || [];
    const cart = carts[def.key] || null;

    const completedOrders = (orders.ordersByUser[def.key] || []).filter((order) => ['completed', 'delivered', 'out-for-delivery', 'shipped', 'processing'].includes(order.status));
    const loyaltyPoints = completedOrders.reduce((sum, order) => sum + Math.round(order.total), 0);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          address: userAddresses,
          orders: userOrders,
          favoriteProducts,
          shoppingCart: cart ? cart._id : null,
          wishList: userWishlists[0]?._id || null,
          loyaltyPoints,
        },
      }
    );
  }
}

async function main() {
  await connectDB();
  await seedSettings();

  if (RESET_MODE) {
    await resetSeedData();
    console.log('Existing commerce demo seed data removed.');
  }

  const tenant = await upsertDocument(
    Tenant,
    { slug: TENANT_DEF.slug },
    {
      name: TENANT_DEF.name,
      slug: TENANT_DEF.slug,
      isActive: true,
      isDeleted: false,
      metadata: TENANT_DEF.metadata,
    },
    { createdAt: daysAgo(300), updatedAt: daysAgo(1) }
  );

  const permissions = await seedPermissions();
  const roles = await seedRoles(permissions);
  const users = await seedUsers(tenant, roles);
  const categories = await seedCategories(users.admin);
  const brands = await seedBrands(users.admin);
  const products = await seedProducts(users.admin, categories, brands);
  await seedAttributes(users.admin, categories, products);
  const coupons = await seedCoupons(categories, brands, products);
  const discountRules = await seedDiscountRules(users.admin, categories, brands, products);
  await seedAppliedDiscounts(discountRules, products);
  const addresses = await seedAddresses(users);
  const carts = await seedCarts(users, products);
  const wishlists = await seedWishlists(users, products);
  const orders = await seedOrders(users, addresses, products, coupons);
  const reviews = await seedReviews(users, products);

  await syncCouponUsage(coupons);
  await syncBrandCounts(brands);
  await syncProductStats(products, orders, reviews);
  await syncUserRelations(users, products, addresses, carts, wishlists, orders);

  console.log('Commerce demo data seeded successfully.');
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Admin login: ${USER_DEFS.find((user) => user.key === 'admin').email} / ${ADMIN_PASSWORD}`);
  console.log(`Customer login: ${USER_DEFS.find((user) => user.key === 'sophia').email} / ${CUSTOMER_PASSWORD}`);
  console.log(`Seeded ${CATEGORY_DEFS.length} categories, ${BRAND_DEFS.length} brands, ${PRODUCT_DEFS.length} products, ${ORDER_DEFS.length} orders, and ${REVIEW_DEFS.length} reviews.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed commerce demo data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });