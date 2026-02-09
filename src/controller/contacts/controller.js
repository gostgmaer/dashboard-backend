// @ts-nocheck
const mongoose = require('mongoose');
const { FilterOptions } = require('../../utils/helper');
const Contact = require('../../models/contact');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

const getData = catchAsync(async (req, res) => {
  const filterData = FilterOptions(req.query, Contact);
  let query = { ...filterData.query };

  const objects = await Contact.find(query).sort(filterData.options.sort).skip(filterData.options.skip).limit(parseInt(filterData.options.limit)).exec();
  const totalCount = await Contact.countDocuments(query);

  return sendSuccess(res, {
    data: { result: objects, total_record: totalCount },
    message: 'Loaded successfully',
  });
});

const getSingleRecord = catchAsync(async (req, res) => {
  const objectId = req.params.id;
  if (!objectId) {
    throw AppError.badRequest('No record id provided');
  }

  const object = await Contact.findById(objectId);
  if (!object) {
    throw AppError.notFound('No record found for given id');
  }

  return sendSuccess(res, { data: object, message: 'Loaded successfully' });
});

const create = catchAsync(async (req, res) => {
  const { firstName, lastName, email, phone, company, subject, message, isAgreed, category, priority } = req.body;

  if (!firstName || !lastName || !email || !subject || !message) {
    throw AppError.badRequest('First name, last name, email, subject, and message are required');
  }

  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  await Contact.create({
    firstName,
    lastName,
    email,
    phone,
    company,
    subject,
    message,
    isAgreed,
    category,
    priority,
    ipAddress,
    userAgent,
  });

  return sendCreated(res, { message: 'Record created successfully' });
});

const remove = catchAsync(async (req, res) => {
  const objectId = req.params.id;
  if (!objectId) {
    throw AppError.badRequest('No record id provided');
  }

  const ID = new mongoose.Types.ObjectId(objectId);
  const object = await Contact.findOneAndUpdate({ _id: ID }, { $set: { ...req.body, status: 'INACTIVE' } }, { returnOriginal: false });

  if (!object) {
    throw AppError.notFound('No record found for given id');
  }

  return sendSuccess(res, { message: 'Deleted successfully' });
});

const removeMany = catchAsync(async (req, res) => {
  const objectId = req.params.id;
  if (!objectId) {
    throw AppError.badRequest('No record id provided');
  }

  const ID = new mongoose.Types.ObjectId(objectId);
  await Contact.bulkWrite([{ updateOne: { filter: { _id: ID }, update: { $set: { ...req.body, status: 'INACTIVE' } } } }]);

  return sendSuccess(res, { message: 'Deleted successfully' });
});

const update = catchAsync(async (req, res) => {
  const objectId = req.params.id;
  if (!objectId) {
    throw AppError.badRequest('No record id provided');
  }

  const ID = new mongoose.Types.ObjectId(objectId);
  const result = await Contact.findOneAndUpdate({ _id: ID }, { $set: req.body }, { returnOriginal: false });

  if (!result) {
    throw AppError.notFound('No record found for given id');
  }

  return sendSuccess(res, { message: 'Updated successfully' });
});

const delData = catchAsync(async (req, res) => {
  const objectId = req.params.id;
  if (!objectId) {
    throw AppError.badRequest('No record id provided');
  }

  const object = await Contact.findByIdAndDelete(objectId);
  if (!object) {
    throw AppError.notFound('No record found for given id');
  }

  return sendSuccess(res, { message: 'Removed and deleted successfully' });
});

const delMany = catchAsync(async (req, res) => {
  const ids = req.body.ids;
  if (!ids || !ids.length) {
    throw AppError.badRequest('No record ids provided');
  }

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const result = await Contact.deleteMany({ _id: { $in: objectIds } });

  return sendSuccess(res, { data: { deletedCount: result.deletedCount }, message: `${result.deletedCount} contacts deleted successfully` });
});

module.exports = {
  create,
  getData,
  getSingleRecord,
  remove,
  removeMany,
  update,
  delData,
  delMany,
};
