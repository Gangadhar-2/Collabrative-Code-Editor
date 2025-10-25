const express = require('express');
const router = express.Router();
const CodeExecution = require('../models/codeExecution');
const { verifyToken } = require('../auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1, language, room, project } = req.query;
    const userId = req.user._id;

    const query = { user: userId };
    if (language) query.language = language;
    if (room) query.room = room;
    if (project) query.project = project;

    const executions = await CodeExecution.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-code -pistonRequestData -pistonResponseData')
      .lean();

    const total = await CodeExecution.countDocuments(query);

    console.log(`Fetched ${executions.length} executions for user ${req.user.username}`);

    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get execution history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching execution history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const execution = await CodeExecution.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: { execution }
    });
  } catch (error) {
    console.error('Get execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching execution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const execution = await CodeExecution.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    await execution.deleteOne();

    res.json({
      success: true,
      message: 'Execution deleted successfully'
    });
  } catch (error) {
    console.error('Delete execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting execution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await CodeExecution.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 },
          totalExecutionTime: { $sum: '$executionTime' },
          avgExecutionTime: { $avg: '$executionTime' },
          successCount: {
            $sum: { $cond: ['$success', 1, 0] }
          },
          errorCount: {
            $sum: { $cond: ['$success', 0, 1] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalExecutions = await CodeExecution.countDocuments({ user: userId });

    res.json({
      success: true,
      data: {
        stats,
        totalExecutions
      }
    });
  } catch (error) {
    console.error('Get execution stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching execution statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;