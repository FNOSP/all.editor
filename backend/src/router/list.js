const fs = require('fs');
const path = require('path');

module.exports = async function list({ query }) {
  try {
    const requestedPath = query.path || '';
    const cleanPath = requestedPath.replace(/\.\./g, '');
    
    const rootDir = '/';
    
    if (cleanPath === '') {
      return {
        code: 200,
        msg: "操作成功",
        data: {
          path: '/',
          files: [
            { name: 'vol1', type: 'folder', path: '/vol1', size: null, modified: new Date() },
            { name: 'vol2', type: 'folder', path: '/vol2', size: null, modified: new Date() }
          ]
        }
      };
    }
    
    const targetPath = path.join(rootDir, cleanPath);
    
    if (!fs.existsSync(targetPath)) {
      return { code: 404, msg: "目录不存在", data: { path: cleanPath } };
    }
    
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return { code: 400, msg: "不是目录", data: { path: cleanPath } };
    }
    
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
    
    files.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return {
      code: 200,
      msg: "操作成功",
      data: {
        path: '/' + cleanPath,
        files: files
      }
    };
  } catch (error) {
    return {
      code: 500,
      msg: "服务器内部错误",
      data: { message: error.message }
    };
  }
};