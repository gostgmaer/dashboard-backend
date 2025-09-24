const {
  ReasonPhrases,
  StatusCodes,

} = require("http-status-codes");
const { FilterOptions } = require("../../utils/helper");
const LogEntry = require("../../models/logEntry");
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
const getAllLogs = async (req, res) => {
  const { limit, page, filter, sort } = req.query;

  try {
    const filterquery = FilterOptions(req.query,LogEntry);
    const responseData = await LogEntry.find(
      filterquery.query,
      "-__v",
      filterquery.options
    );
    const length = await LogEntry.countDocuments(filterquery.query);

    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: "Carts retrieved successfully",
      results: responseData,
      total: length,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

const getSingleLogs = async (req, res) => {
  try {
    const singleData = await LogEntry.findById(req.params.id);
    if (!singleData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: "Logs not found",
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: singleData,
      message: "Log retrieved successfully",
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};
const updateLogs = async (req, res) => {
  try {
    const data = await LogEntry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!data) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: "Log not found",
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: data,
      message: "Log updated successfully",
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};
const deleteLogs = async (req, res) => {
  try {
    const currData = await LogEntry.findByIdAndDelete(req.params.id);
    if (!currData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: "log not found",
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: "deleted successfully",
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

module.exports = {
  getAllLogs,
  getSingleLogs,
  updateLogs,
  deleteLogs,
};
