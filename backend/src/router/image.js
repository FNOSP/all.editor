const fs = require('fs');
const path = require('path');

const getType = require('../utils/type');

module.exports = async function image({ query }) {
  const { path: filePath } = query;

  if (!filePath) {
    return { code: 400, msg: "缺少文件路径参数", data: query };
  }

  try {
    const cleanPath = filePath.replace(/\.\./g, '');
    const fullPath = '/' + cleanPath;

    if (!fs.existsSync(fullPath)) {
      return { code: 404, msg: "文件不存在", data: query };
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return { code: 400, msg: "路径不是文件", data: query };
    }

    const testFd = fs.openSync(fullPath, "r");
    fs.closeSync(testFd);

    return {
      code: 200,
      msg: "操作成功",
      data: {
        size: stat.size,
        filename: fullPath.split("/").pop(),
        stream: fs.createReadStream(fullPath),
      }
    };
  } catch (error) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      return { code: 403, msg: "权限不足，无法读取文件", data: query };
    }

    if (error.code === "ENOENT") {
      return { code: 404, msg: "文件不存在", data: query };
    }

    if (error.code === "EISDIR") {
      return { code: 400, msg: "路径是目录而不是文件", data: query };
    }

    return { code: 500, msg: `读取文件失败: ${error.message}`, data: query };
  }
};