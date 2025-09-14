// @ts-nocheck
const {
  ReasonPhrases,
  StatusCodes,
} = require("http-status-codes");
const mongoose = require("mongoose");
const {
  FilterOptions,
} = require("../../utils/helper");

const Contact = require("../../models/contact");


const getData = async (req, res) => {
  try {

    // const { sort, page, limit, filter, select_keys } = req.query;
    const filterData = FilterOptions(req.query,Contact);
    let query = { ...filterData.query };
    // let projection = { projection: filterData.arrayOfValues };

    const objects = await Contact.find(query).sort(filterData.options.sort)
      .skip(filterData.options.skip)
      .limit(parseInt(filterData.options.limit)).exec()
    const totalCount = await Contact.countDocuments(query);

    res.status(StatusCodes.OK).json({
      result: objects,
      total_record: totalCount,
      message: `Loaded Successfully!`,
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
     
    });
  }
};

const getSingleRecord = async (req, res) => {
  try {
    
    const objectId = req.params.id;
    if (!objectId) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }

    const object = await Contact.findById(objectId);
    if (!object) {
      res.status(StatusCodes.NOT_FOUND).json({
        result: object,
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      res.status(StatusCodes.OK).json({
        result: object,
        message: `Loaded Successfully!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};
const create = async (req, res) => {
  try {
    await Contact.create(req.body);
    res.status(StatusCodes.CREATED).json({
      message: "Record Created Successfully!",
      status: ReasonPhrases.CREATED,
      statusCode: StatusCodes.CREATED
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const remove = async (req, res) => {
  try {
    // const { appId } = req.params;
    const objectId = req.params.id;

    if (!objectId) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
    const ID = new mongoose.Types.ObjectId(objectId);
    const object = await Contact.findOneAndUpdate(
      { _id: ID },
      { $set: { ...req.body, status: "INACTIVE" } },
      { returnOriginal: false }
    );
    if (object?.lastErrorObject?.n == 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      res.status(StatusCodes.OK).json({
        message: `deleted successful!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

const removeMany = async (req, res) => {
  try {
    // const { appId } = req.params;
    const objectId = req.params.id;

    if (!objectId) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
    const ID = new mongoose.Types.ObjectId(objectId);
    const object = await Contact.bulkWrite(
      { _id: ID },
      { $set: { ...req.body, status: "INACTIVE" } },
      { returnOriginal: false }
    );
    if (object?.lastErrorObject?.n == 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      res.status(StatusCodes.OK).json({
        message: `deleted successful!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

const update = async (req, res) => {
  try {
    const objectId = req.params.id;

    if (!objectId) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
    const ID = new mongoose.Types.ObjectId(objectId);
    const objectToUpdate = req.body;

    const result = await Contact.findOneAndUpdate(
      { _id: ID },
      { $set: objectToUpdate },
      { returnOriginal: false }
    );

    if (!result) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      res.status(StatusCodes.OK).json({
    
        message: `Update successfully!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};



const delData = async (req, res) => {
  try {
    // const { appId } = req.params;
    const objectId = req.params.id;

    if (!objectId) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }
    // const ID = new mongoose.Types.ObjectId(objectId);
    const object = await Contact.findByIdAndDelete(objectId);
    if (object?.lastErrorObject?.n == 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      res.status(StatusCodes.OK).json({
        message: `remove and deleted successful!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

const delMany = async (req, res) => {
  try {
    // const { appId } = req.params;
    const ids = req.body.ids;

    if (!ids) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record id Provide`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
    const objectIds = ids.map(id => mongoose.Types.ObjectId(id));
    const result = await Contact.deleteMany({ _id: { $in: objectIds } });
    if (object?.lastErrorObject?.n == 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: `No record Found for Given id!`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      res.status(StatusCodes.OK).json({
        message: `${result.deletedCount} contact deleted successfully`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

module.exports = {
  create,
  getData,
  getSingleRecord,
  remove,
  removeMany,
  update,delData,delMany
};
