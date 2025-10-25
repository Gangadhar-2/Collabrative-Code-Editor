const axios = require('axios');

const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';
const EXECUTION_TIMEOUT = 10000;

const LANGUAGE_CONFIG = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'cpp', version: '10.2.0' },
  c: { language: 'c', version: '10.2.0' }
};

async function getSupportedLanguages() {
  try {
    const response = await axios.get(`${PISTON_API_URL}/runtimes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching supported languages:', error.message);
    throw new Error('Failed to fetch supported languages');
  }
}

async function executeCode(language, code, stdin = '', args = []) {
  try {
    const langConfig = LANGUAGE_CONFIG[language.toLowerCase()];
    
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    const payload = {
      language: langConfig.language,
      version: langConfig.version,
      files: [
        {
          name: getDefaultFileName(language),
          content: code
        }
      ],
      stdin,
      args,
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: 536870912, 
      run_memory_limit: 536870912     
    };
    
    console.log(`Executing ${language} code using Piston API...`);
    
    const response = await axios.post(
      `${PISTON_API_URL}/execute`,
      payload,
      { 
        timeout: EXECUTION_TIMEOUT,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    return processResults(response.data);
    
  } catch (error) {
    console.error('Code execution error:', error.message);
    
    if (error.response) {
      return {
        success: false,
        error: error.response.data.message || 'Execution failed',
        status: error.response.status
      };
    } else if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Execution timed out',
        status: 408
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error during execution',
      status: 500
    };
  }
}

function processResults(data) {
  const result = {
    success: true,
    language: data.language,
    version: data.version,
    run: data.run || {},
    compile: data.compile || {}
  };
  
  if (data.compile && data.compile.stderr) {
    result.success = false;
    result.error = data.compile.stderr;
    result.output = data.compile.stderr;
  } else if (data.run) {
    result.output = data.run.stdout || '';
    
    if (data.run.stderr) {
      result.error = data.run.stderr;
      if (result.output) {
        result.output += `\n${data.run.stderr}`;
      } else {
        result.output = data.run.stderr;
      }
    }
    
    if (data.run.code !== 0) {
      result.success = false;
    }
    
    result.exitCode = data.run.code;
  }
  
  return result;
}

function getDefaultFileName(language) {
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

module.exports = {
  executeCode,
  getSupportedLanguages,
  LANGUAGE_CONFIG
};