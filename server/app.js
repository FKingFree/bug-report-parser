const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, '../client')));
app.use(fileUpload());

// In-memory storage for bug reports
let bugReports = [];

// Helper function to parse bug report
function parseBugReport(filePath, fileName) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let data;

    if (ext === '.json') {
      data = require(filePath);
    } else if (ext === '.txt') {
      data = {
        packageName: fileName.split('.')[0], // 从文件名中提取 packageName
        versionName: '1.0.0',
        versionCode: 1,
        installTime: new Date(),
        installSource: 'Google Play',
        architecture: 'arm64-v8a',
        isPreInstalled: false,
        traces: [
          { type: 'JE', trace: 'Java Exception Trace' },
          { type: 'NE', trace: 'Native Exception Trace' },
          { type: 'ANR', trace: 'Application Not Responding Trace' }
        ],
        rootInfo: { isRooted: false }
      };
    } else {
      return null; // 不支持的文件格式，返回 null
    }

    console.log('Parsed data:', data);
    return data;
  } catch (error) {
    console.error('Error parsing bug report:', error);
    throw error;
  }
}

// Helper function to recursively read all files in a directory
function readFilesRecursively(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      readFilesRecursively(filePath);
    } else {
      const parsedData = parseBugReport(filePath, file);
      if (parsedData) {
        bugReports.push(parsedData);
        console.log('Parsed and stored data:', parsedData);
      } else {
        console.log('Unsupported file format:', filePath);
      }
    }
  });
}

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Upload endpoint
app.post('/api/upload', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ message: 'No files were uploaded.' });
  }

  const files = req.files.file;
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const unsupportedFiles = [];

  if (Array.isArray(files)) {
    files.forEach(file => {
      const filePath = path.join(uploadDir, file.name);
      file.mv(filePath, function(err) {
        if (err) {
          console.error('Error moving file:', err);
          return res.status(500).json({ message: 'Error moving file', details: err.message });
        }
        const parsedData = parseBugReport(filePath, file.name);
        if (parsedData) {
          bugReports.push(parsedData);
        } else {
          unsupportedFiles.push(file.name);
        }
      });
    });
  } else {
    const filePath = path.join(uploadDir, files.name);
    files.mv(filePath, function(err) {
      if (err) {
        console.error('Error moving file:', err);
        return res.status(500).json({ message: 'Error moving file', details: err.message });
      }
      const parsedData = parseBugReport(filePath, files.name);
      if (parsedData) {
        bugReports.push(parsedData);
      } else {
        unsupportedFiles.push(files.name);
      }
    });
  }

  // 确保所有文件都处理完毕后再发送响应
  setTimeout(() => {
    if (unsupportedFiles.length > 0) {
      return res.status(200).json({ message: 'Files uploaded but some are not supported', unsupportedFiles });
    } else {
      return res.status(200).json({ message: 'Files uploaded and parsed successfully' });
    }
  }, 1000); // 假设文件处理不会超过1秒
});

// Search endpoint
app.get('/api/search', (req, res) => {
  try {
    const packageName = req.query.packageName;
    const result = bugReports.filter(report => report.packageName === packageName);

    console.log('Search query:', packageName);
    console.log('Search results:', result);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error searching package', details: error.message });
  }
});

// Get all bug reports endpoint
app.get('/api/reports', (req, res) => {
  try {
    console.log('All bug reports:', bugReports);
    res.status(200).json(bugReports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving bug reports', details: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});