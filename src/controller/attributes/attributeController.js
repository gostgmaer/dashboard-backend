const Attribute = require('../../models/Attribute');
const Product = require('../../models/products');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

/**
 * Handle product attribute updates/cleanup when attribute or child attribute values change or are deleted.
 */
async function handleProductAttribute(attributeId, childIds, mode = 'single') {
  try {
    if (!attributeId) throw new Error('Attribute ID is required');

    const ids = Array.isArray(childIds) ? childIds : [childIds];

    const products = await Product.find({
      'attributes.attributeId': attributeId,
      'attributes.variantId': { $in: ids },
    });

    for (const product of products) {
      product.attributes = product.attributes.filter(
        (attr) => !(attr.attributeId.toString() === attributeId.toString() && ids.includes(attr.variantId.toString()))
      );
      await product.save();
    }
  } catch (error) {
    console.error('Error in handleProductAttribute:', error.message);
  }
}

const addAttribute = catchAsync(async (req, res) => {
  const newAttribute = new Attribute(req.body);
  await newAttribute.save();
  return sendCreated(res, { message: 'Attribute added successfully' });
});

const addChildAttributes = catchAsync(async (req, res) => {
  const { id } = req.params;
  const attribute = await Attribute.findById(id);
  if (!attribute) {
    throw AppError.notFound('Attribute not found');
  }
  await Attribute.updateOne({ _id: attribute._id }, { $push: { variants: req.body } });
  return sendSuccess(res, { message: 'Attribute value added successfully' });
});

const addAllAttributes = catchAsync(async (req, res) => {
  await Attribute.deleteMany();
  await Attribute.insertMany(req.body);
  return sendSuccess(res, { message: 'Added all attributes successfully' });
});

const getAllAttributes = catchAsync(async (req, res) => {
  const { type, option, option1 } = req.query;
  const attributes = await Attribute.find({
    $or: [{ type: type }, { $or: [{ option: option }, { option: option1 }] }],
  });
  return sendSuccess(res, { data: attributes, message: 'Attributes retrieved' });
});

const getShowingAttributes = catchAsync(async (req, res) => {
  const attributes = await Attribute.aggregate([
    { $match: { status: 'show', 'variants.status': 'show' } },
    {
      $project: {
        _id: 1,
        status: 1,
        title: 1,
        name: 1,
        option: 1,
        createdAt: 1,
        updateAt: 1,
        variants: {
          $filter: {
            input: '$variants',
            cond: { $eq: ['$$this.status', 'show'] },
          },
        },
      },
    },
  ]);
  return sendSuccess(res, { data: attributes, message: 'Showing attributes retrieved' });
});

const getShowingAttributesTest = catchAsync(async (req, res) => {
  const attributes = await Attribute.find({ status: 'show' });
  return sendSuccess(res, { data: attributes, message: 'Showing attributes retrieved' });
});

const updateManyAttribute = catchAsync(async (req, res) => {
  await Attribute.updateMany({ _id: { $in: req.body.ids } }, { $set: { option: req.body.option, status: req.body.status } }, { multi: true });
  return sendSuccess(res, { message: 'Attributes update successfully' });
});

const getAttributeById = catchAsync(async (req, res) => {
  const attribute = await Attribute.findById(req.params.id);
  if (!attribute) {
    throw AppError.notFound('Attribute not found');
  }
  return sendSuccess(res, { data: attribute, message: 'Attribute retrieved' });
});

const getChildAttributeById = catchAsync(async (req, res) => {
  const { id, ids } = req.params;
  const attribute = await Attribute.findOne({ _id: id });
  if (!attribute) {
    throw AppError.notFound('Attribute not found');
  }

  const childAttribute = attribute.variants.find((attr) => attr._id == ids);
  if (!childAttribute) {
    throw AppError.notFound('Child attribute not found');
  }
  return sendSuccess(res, { data: childAttribute, message: 'Child attribute retrieved' });
});

const updateAttributes = catchAsync(async (req, res) => {
  const attribute = await Attribute.findById(req.params.id);
  if (!attribute) {
    throw AppError.notFound('Attribute not found');
  }

  attribute.title = { ...attribute.title, ...req.body.title };
  attribute.name = { ...attribute.name, ...req.body.name };
  attribute._id = req.params.id;
  attribute.option = req.body.option;
  attribute.type = req.body.type;
  await attribute.save();
  return sendSuccess(res, { message: 'Attribute updated successfully' });
});

const updateChildAttributes = catchAsync(async (req, res) => {
  const { attributeId, childId } = req.params;

  let attribute = await Attribute.findOne({ _id: attributeId, 'variants._id': childId });

  if (attribute) {
    const att = attribute.variants.find((v) => v._id.toString() === childId);
    const name = { ...att.name, ...req.body.name };

    await Attribute.updateOne({ _id: attributeId, 'variants._id': childId }, { $set: { 'variants.$.name': name, 'variants.$.status': req.body.status } });
  }

  return sendSuccess(res, { message: 'Attribute value updated successfully' });
});

const updateManyChildAttribute = catchAsync(async (req, res) => {
  const childIdAttribute = await Attribute.findById(req.body.currentId);
  if (!childIdAttribute) {
    throw AppError.notFound('Attribute not found');
  }

  const final = childIdAttribute.variants.filter((value) => req.body.ids.find((value1) => value1 == value._id));

  const updateStatusAttribute = final.map((value) => {
    value.status = req.body.status;
    return value;
  });

  let totalVariants = [];
  if (req.body.changeId) {
    const groupIdAttribute = await Attribute.findById(req.body.changeId);
    totalVariants = [...groupIdAttribute.variants, ...updateStatusAttribute];
  }

  if (totalVariants.length === 0) {
    await Attribute.updateOne({ _id: req.body.currentId }, { $set: { variants: childIdAttribute.variants } }, { multi: true });
  } else {
    await Attribute.updateOne({ _id: req.body.changeId }, { $set: { variants: totalVariants } }, { multi: true });
    await Attribute.updateOne({ _id: req.body.currentId }, { $pull: { variants: { _id: req.body.ids } } }, { multi: true });
  }

  return sendSuccess(res, { message: 'Attribute values update successfully' });
});

const updateStatus = catchAsync(async (req, res) => {
  const newStatus = req.body.status;
  await Attribute.updateOne({ _id: req.params.id }, { $set: { status: newStatus } });
  return sendSuccess(res, { message: `Attribute ${newStatus === 'show' ? 'Published' : 'Un-Published'} Successfully` });
});

const updateChildStatus = catchAsync(async (req, res) => {
  const newStatus = req.body.status;
  await Attribute.updateOne({ 'variants._id': req.params.id }, { $set: { 'variants.$.status': newStatus } });
  return sendSuccess(res, { message: `Attribute Value ${newStatus === 'show' ? 'Published' : 'Un-Published'} Successfully` });
});

const deleteAttribute = catchAsync(async (req, res) => {
  await Attribute.deleteOne({ _id: req.params.id });
  return sendSuccess(res, { message: 'Attribute deleted successfully' });
});

const deleteChildAttribute = catchAsync(async (req, res) => {
  const { attributeId, childId } = req.params;
  await Attribute.updateOne({ _id: attributeId }, { $pull: { variants: { _id: childId } } });
  await handleProductAttribute(attributeId, childId);
  return sendSuccess(res, { message: 'Attribute value deleted successfully' });
});

const deleteManyAttribute = catchAsync(async (req, res) => {
  await Attribute.deleteMany({ _id: req.body.ids });
  return sendSuccess(res, { message: 'Attributes delete successfully' });
});

const deleteManyChildAttribute = catchAsync(async (req, res) => {
  await Attribute.updateOne({ _id: req.body.id }, { $pull: { variants: { _id: req.body.ids } } }, { multi: true });
  await handleProductAttribute(req.body.id, req.body.ids, 'multi');
  return sendSuccess(res, { message: 'Attribute values delete successfully' });
});

module.exports = {
  addAttribute,
  addAllAttributes,
  getAllAttributes,
  getShowingAttributes,
  getAttributeById,
  updateAttributes,
  updateStatus,
  updateChildStatus,
  deleteAttribute,
  getShowingAttributesTest,
  deleteChildAttribute,
  addChildAttributes,
  updateChildAttributes,
  getChildAttributeById,
  updateManyAttribute,
  deleteManyAttribute,
  updateManyChildAttribute,
  deleteManyChildAttribute,
};
