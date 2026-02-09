# Database Query Optimization Guide

## Overview

This guide explains how to use the query optimization utilities to improve database performance.

## Using Query Optimization

### Basic Usage - Lean Queries

For read-only operations, use `lean()` to return plain JavaScript objects instead of Mongoose documents (30-50% faster):

```javascript
const { optimizeQuery } = require('./src/utils/queryOptimization');

// Before (slow)
const users = await User.find({ isActive: true });

// After (fast)
const users = await User.find({ isActive: true }).lean();

// Or using helper
let query = User.find({ isActive: true });
query = optimizeQuery(query, { lean: true });
const users = await query;
```

### Pagination

Use the pagination helpers for efficient data loading:

```javascript
const { getPaginatedResults } = require('./src/utils/queryOptimization');

// Get paginated products
const result = await getPaginatedResults(
  Product,
  { category: 'electronics' },
  {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    order: 'desc',
    select: 'name price category', // Only return these fields
    lean: true,
  }
);

// Result structure:
// {
//   data: [...],
//   pagination: {
//     page: 1,
//     limit: 20,
//     total: 150,
//     totalPages: 8,
//     hasNextPage: true,
//     hasPrevPage: false
//   }
// }
```

### Field Selection

Reduce data transfer by selecting only needed fields:

```javascript
const { applyFieldSelection } = require('./src/utils/queryOptimization');

// Only get name and email
let query = User.find({ role: 'customer' });
query = applyFieldSelection(query, 'name email');
const users = await query;

// Or as array
query = applyFieldSelection(query, ['name', 'email', 'createdAt']);
```

## Creating Database Indexes

Indexes dramatically improve query performance. Run the index creation script:

```bash
node src/utils/createIndexes.js
```

This will create recommended indexes for:
- User model (email, username, role)
- Product model (slug, category, price, text search)
- Order model (userId, status, orderNumber)

## Performance Tips

### 1. Always Use Lean for Read Operations

```javascript
// ❌ Don't
const products = await Product.find();

// ✅ Do
const products = await Product.find().lean();
```

### 2. Select Only Needed Fields

```javascript
// ❌ Don't (fetches all fields)
const users = await User.find().select('-password');

// ✅ Do (only fetch what you need)
const users = await User.find().select('name email role').lean();
```

### 3. Use Indexes for Frequent Queries

```javascript
// If you frequently query by email
// Add index in schema:
userSchema.index({ email: 1 }, { unique: true });

// Or for compound queries
orderSchema.index({ userId: 1, status: 1 });
```

### 4. Limit Results

```javascript
// ❌ Don't (loads all records)
const products = await Product.find();

// ✅ Do (limit results)
const products = await Product.find().limit(100).lean();
```

### 5. Use Aggregation for Complex Queries

```javascript
// For complex analytics, use aggregation
const stats = await Order.aggregate([
  { $match: { status: 'completed' } },
  { $group: { _id: '$userId', total: { $sum: '$amount' } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
]);
```

## Example: Optimized Controller

```javascript
const { getPaginatedResults } = require('../utils/queryOptimization');
const { sendPaginated } = require('../utils/responseHelper');

exports.getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    // Get paginated results
    const result = await getPaginatedResults(Product, filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: 'createdAt',
      order: 'desc',
      select: 'name price category image slug',
      lean: true,
    });

    sendPaginated(res, {
      data: result.data,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      message: 'Products retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};
```

## Measuring Performance

Add logging to measure query performance:

```javascript
const start = Date.now();
const users = await User.find().lean();
const duration = Date.now() - start;
LoggerService.info(`Query took ${duration}ms`);
```

## Common Pitfalls

### 1. Not Using Lean for Read Operations
- **Impact**: 30-50% slower, higher memory usage
- **Fix**: Add `.lean()` to all read queries

### 2. Missing Indexes
- **Impact**: Full collection scans, very slow queries
- **Fix**: Run `node src/utils/createIndexes.js`

### 3. Over-fetching Data
- **Impact**: Increased network transfer, slower responses
- **Fix**: Use field selection (`.select()`)

### 4. No Pagination
- **Impact**: Loading thousands of records, memory issues
- **Fix**: Use `getPaginatedResults()`

## Monitoring

Check MongoDB slow query log to identify problematic queries:

```javascript
// In your model, add query logging
userSchema.post('find', function(docs) {
  if (this._executionTime > 100) { // Log if > 100ms
    LoggerService.warn('Slow query detected:', {
      model: 'User',
      filter: this.getFilter(),
      time: this._executionTime
    });
  }
});
```
