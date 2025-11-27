const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const exec = require('./src/utils/exec');

const app = express();
const PORT = process.env.PORT || 15777;

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  const data = {
    api: 'health',
    query: req.query || {},
    body: req.body || {},
  };

  exec(data).then(({ body }) => {
    res.json(body);
  }).catch((error) => {
    res.status(500).json({ 
      success: false,
      code: 500, 
      msg: '调用错误',
      error: error.message 
    });
  });
});

// 代理请求
app.get('/api/proxy/*', async (req, res) => {
  try {
    const url = req.query.url || '';
    const decodedUrl = decodeURIComponent(url);
    
    console.log('🔗 代理请求:', decodedUrl);
    
    // 验证URL安全性
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, error: '无效的URL格式' });
    }
    
    // 设置代理请求的headers
    const proxyHeaders = {
      'User-Agent': req.get('User-Agent') || 'Mozilla/5.0',
      'Cookie': req.get('Cookie') || '',
      'Referer': req.get('Referer') || '',
    };
    
    // 执行代理请求
    const response = await fetch(decodedUrl, {
      headers: proxyHeaders,
      credentials: 'include'
    });
    
    // 复制响应头
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        // 跳过Set-Cookie头，因为CORS策略
        return;
      }
      responseHeaders[key] = value;
    });
    
    // 设置CORS头
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': response.headers.get('content-type') || 'text/html; charset=utf-8',
      ...responseHeaders
    });
    
    // 返回内容
    const html = await response.text();
    res.send(html);
    console.log('✅ 代理成功:', decodedUrl);
    
  } catch (error) {
    console.error('❌ 代理失败:', error);
    res.status(500).json({
      success: false,
      error: `代理失败: ${error.message}`,
      url: decodedUrl
    });
  }
});

// 文件列表接口 - 适配 backend 架构
app.get('/api/list', (req, res) => {
  const data = {
    api: 'list',
    query: req.query || {},
    body: req.body || {},
  };

  exec(data).then(({ body }) => {
    res.json(body);
  }).catch((error) => {
    res.status(500).json({ 
      success: false,
      code: 500, 
      msg: '调用错误',
      error: error.message 
    });
  });
});

// 文件读取接口 - 适配 backend 架构
app.get('/api/file', (req, res) => {
  const data = {
    api: 'file',
    query: req.query || {},
    body: req.body || {},
  };

  exec(data).then(({ type, body }) => {
    if (type) {
      res.set("Content-Type", type);
      res.set("Content-Length", body.size);
      res.set("Content-Disposition", `attachment; filename="${body.filename}"`);
      res.body = body.stream;
      body.stream.pipe(res);
    } else {
      res.json(body);
    }
  }).catch((error) => {
    res.status(500).json({ 
      success: false,
      code: 500, 
      msg: '调用错误',
      error: error.message 
    });
  });
});

// 图片读取接口 - 适配 backend 架构
app.get('/api/image', (req, res) => {
  const data = {
    api: 'image',
    query: req.query || {},
    body: req.body || {},
  };

  exec(data).then(({ type, body }) => {
    if (type) {
      res.set("Content-Type", type);
      res.set("Content-Length", body.size);
      res.set("Content-Disposition", `attachment; filename="${body.filename}"`);
      res.body = body.stream;
      body.stream.pipe(res);
    } else {
      res.json(body);
    }
  }).catch((error) => {
    res.status(500).json({ 
      success: false,
      code: 500, 
      msg: '调用错误',
      error: error.message 
    });
  });
});

// 兼容原有 Express 风格的路由 (保持向后兼容)
app.get('/api/list/*', (req, res) => {
  try {
    const requestedPath = req.params[0] || '';
    const cleanPath = requestedPath.replace(/\.\./g, '');
    
    console.log('🔍 读取目录完整路径:', cleanPath);
    console.log('🔍 Express参数:', req.params);
    console.log('🔍 URL路径:', req.path);
    console.log('🔍 原始请求参数:', req.params[0]);
    
    // 定义根目录路径 - 可以根据实际需要修改
    const rootDir = '/'; // Linux系统的根目录
    
    let targetPath;
    if (cleanPath === '') {
      // 根路径，返回vol1和vol2目录
      res.json({
        success: true,
        path: '/',
        files: [
          {
            name: 'vol1',
            type: 'folder',
            path: '/vol1',
            size: null,
            modified: new Date()
          },
          {
            name: 'vol2', 
            type: 'folder',
            path: '/vol2',
            size: null,
            modified: new Date()
          }
        ]
      });
      return;
    }
    
    // 构建完整路径
    targetPath = path.join(rootDir, cleanPath);
    
    console.log('📁 完整路径:', targetPath);
    
    // 检查路径是否存在
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({
        success: false,
        error: '目录不存在',
        path: cleanPath
      });
    }
    
    // 检查是否为目录
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '不是目录',
        path: cleanPath
      });
    }
    
    // 读取目录内容
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    const files = items.map(item => {
      const itemPath = path.join(targetPath, item.name);
      const itemStats = fs.statSync(itemPath);
      
      return {
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        path: '/' + path.join(cleanPath, item.name).replace(/\\/g, '/'),
        size: item.isDirectory() ? null : itemStats.size,
        modified: itemStats.mtime,
        uid: itemStats.uid,
        gid: itemStats.gid
      };
    });
    
    // 按文件夹在前，文件在后排序
    files.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log('✅ 读取成功:', files.length, '个项目');
    
    res.json({
      success: true,
      path: '/' + cleanPath,
      files: files
    });
    
  } catch (error) {
    console.error('❌ 读取目录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

app.get('/api/file/*', (req, res) => {
  try {
    const filePath = req.params[0]; // 获取通配符匹配的路径
    const cleanPath = filePath.replace(/\.\./g, '');
    
    console.log('📄 读取文件:', cleanPath);
    
    const fullPath = path.join('/', cleanPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在',
        path: cleanPath
      });
    }
    
    // 检查是否为文件
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({
        success: false,
        error: '不是文件',
        path: cleanPath
      });
    }
    
    // 读取文件内容
    const content = fs.readFileSync(fullPath, 'utf8');
    
    res.json({
      success: true,
      path: cleanPath,
      content: content,
      size: stats.size,
      modified: stats.mtime
    });
    
  } catch (error) {
    console.error('❌ 读取文件失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

app.get('/api/image/*', (req, res) => {
  try {
    const filePath = req.params[0]; // 获取通配符匹配的路径
    const cleanPath = filePath.replace(/\.\./g, '');
    
    console.log('🖼️ 读取图片:', cleanPath);
    
    const fullPath = path.join('/', cleanPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('图片不存在');
    }
    
    // 检查是否为文件
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.status(400).send('不是文件');
    }
    
    // 根据文件扩展名设置Content-Type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // 读取并返回图片文件
    const imageBuffer = fs.readFileSync(fullPath);
    res.send(imageBuffer);
    
    console.log('✅ 图片读取成功:', cleanPath);
    
  } catch (error) {
    console.error('❌ 读取图片失败:', error);
    res.status(500).send('服务器内部错误');
  }
});

// API路由重定向到前端
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Backend2 API Server',
    version: '2.0',
    endpoints: [
      '/health',
      '/api/list',
      '/api/file',
      '/api/image',
      '/api/proxy'
    ]
  });
});

// 获取本机IP地址
function getLocalIP() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`
🚀 文件管理器API服务已启动
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务地址: http://localhost:${PORT}
🌐 局域网地址: http://${localIP}:${PORT}
📂 API端点: http://localhost:${PORT}/api/list
📄 文件API: http://localhost:${PORT}/api/file
🔗 前端地址: http://localhost:${PORT}
✅ 健康检查: http://localhost:${PORT}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 服务已绑定到0.0.0.0，支持局域网访问
✅ 新架构：路由分离，代码结构更清晰
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('📤 收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📤 收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});