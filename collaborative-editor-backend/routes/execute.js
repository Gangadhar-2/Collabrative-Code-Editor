const express = require('express');
const router = express.Router();
const axios = require('axios');
const CodeExecution = require('../models/codeExecution');
const Message = require('../models/Message');

const LANGUAGE_CONFIGS = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' }, 
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' },
  c: { language: 'c', version: '10.2.0' }
};

router.post('/', async (req, res) => {
  try {
    const { code, language = 'javascript', stdin = '', roomId } = req.body;
    const userId = req.user._id;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const langConfig = LANGUAGE_CONFIGS[language.toLowerCase()];
    if (!langConfig) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`
      });
    }

    console.log(`Executing ${language} code for user ${req.user.username}`);

    const execution = new CodeExecution({
      user: userId,
      room: roomId || 'default',
      language: language.toLowerCase(),
      code: code.trim(),
      stdin,
      status: 'processing'
    });

    await execution.save();

    try {
      const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
        language: langConfig.language,
        version: langConfig.version,
        files: [{
          name: getFileName(language),
          content: code.trim()
        }],
        stdin: stdin || '',
        compile_timeout: 10000,
        run_timeout: 5000
      });

      const result = response.data;
      const stdout = result.run?.stdout || '';
      const stderr = result.run?.stderr || '';
      const exitCode = result.run?.code || 0;

      await execution.updateStatus('completed', {
        stdout,
        stderr,
        exitCode,
        executionTime: Date.now() - execution.createdAt.getTime()
      });

      if (roomId) {
        const outputMessage = new Message({
          room: `room-${roomId}`,
          channel: 'output',
          sender: userId,
          content: stdout || stderr || 'No output',
          type: 'code_execution',
          codeExecution: execution._id,
          senderUsername: req.user.username,
          senderAvatar: req.user.profilePicture
        });

        await outputMessage.save();
        console.log(`✅ Execution output saved to output channel for room ${roomId}`);
      }

      const io = req.app.get('io');
      if (io && roomId) {
        io.to(`room-${roomId}`).emit('code-executed', {
          executionId: execution._id,
          userId,
          username: req.user.username,
          language: langConfig.language,
          output: stdout || stderr,
          error: stderr || null,
          exitCode,
          channel: 'output',
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: {
          executionId: execution._id,
          language: langConfig.language,
          output: stdout || 'No output',
          error: stderr || null,
          exitCode,
          success: exitCode === 0 && !stderr
        }
      });

    } catch (executionError) {
      console.error('Piston API error:', executionError.message);
      
      await execution.updateStatus('failed', {
        stderr: executionError.message
      });

      res.status(500).json({
        success: false,
        message: 'Code execution failed',
        error: executionError.response?.data?.message || executionError.message
      });
    }
  } catch (error) {
    console.error('Execute route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during code execution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

function getFileName(language) {
  const fileNames = {
    javascript: 'main.js',
    typescript: 'main.ts',
    python: 'main.py',
    java: 'Main.java',
    cpp: 'main.cpp',
    c: 'main.c'
  };
  return fileNames[language.toLowerCase()] || 'main.txt';
}

router.get('/languages', async (req, res) => {
  try {
    const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => ({
      id: key,
      name: config.language,
      version: config.version,
      displayName: key.charAt(0).toUpperCase() + key.slice(1)
    }));

    res.json({
      success: true,
      data: { languages }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching languages'
    });
  }
});

module.exports = router;