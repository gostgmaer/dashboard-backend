const Component = require('../models/components');
const { standardResponse,errorResponse } = require('../utils/apiUtils');

class ComponentController {
  static async createComponent(req, res) {
    try {
      const component = await Component.createComponent(req.body);
      return standardResponse(res, true, component, 'Component created successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getComponents(req, res) {
    try {
      const components = await Component.getComponents(req.query);
      return standardResponse(res, true, components, 'Components retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getComponentById(req, res) {
    try {
      const component = await Component.getComponentById(req.params.id);
      if (!component)
        return errorResponse(res, 'Component not found', 404, null);
      return standardResponse(res, true, component, 'Component retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async updateComponent(req, res) {
    try {
      const component = await Component.updateComponent(req.params.id, req.body);
      if (!component)
        return errorResponse(res, 'Component not found', 404, null);
      return standardResponse(res, true, component, 'Component updated successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async deleteComponent(req, res) {
    try {
      const result = await Component.deleteComponent(req.params.id);
      if (!result)
        return errorResponse(res, 'Component not found', 404, null);
      return standardResponse(res, true, {}, 'Component deleted successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getComponentsByType(req, res) {
    try {
      const components = await Component.getComponentsByType(req.params.type);
      return standardResponse(res, true, components, 'Components retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getRecentlyAdded(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const components = await Component.getRecentlyAdded(days);
      return standardResponse(res, true, components, 'Recently added components retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async brandStats(req, res) {
    try {
      const stats = await Component.brandStats();
      return standardResponse(res, true, stats, 'Brand statistics retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getTopPriced(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const components = await Component.getTopPriced(limit);
      return standardResponse(res, true, components, 'Top priced components retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }

  static async getLowestPriced(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const components = await Component.getLowestPriced(limit);
      return standardResponse(res, true, components, 'Lowest priced components retrieved successfully');
    } catch (err) {
      return errorResponse(res, err.message, 500, err);
    }
  }
   static async bulkDelete(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
      }
      const result = await Component.deleteMany({ _id: { $in: ids } });
      return res.json({ success: true, message: `${result.deletedCount} components deleted` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async bulkUpdate(req, res) {
    try {
      const { updates } = req.body;
      // updates should be array of { id, data }
      if (!Array.isArray(updates)) {
        return res.status(400).json({ success: false, message: 'updates must be an array' });
      }
      const promises = updates.map(u => Component.findByIdAndUpdate(u.id, u.data, { new: true }));
      const updated = await Promise.all(promises);
      return res.json({ success: true, message: 'Bulk update successful', data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  static async bulkImport(req, res) {
    try {
      if (!Array.isArray(req.body.components)) {
        return res.status(400).json({ success: false, message: 'components must be an array' });
      }
      const created = await Component.insertMany(req.body.components, { ordered: false });
      return res.json({ success: true, message: 'Bulk import successful', data: created });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = ComponentController;
