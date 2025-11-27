const querystring = require("querystring");

const exec = require("./src/utils/exec");

// 获取 env、query、body
async function getData() {
  const env = process.env;

  // 支持从命令行参数或环境变量获取路径
  let pathInfo = env.PATH_INFO || "";
  
  // 如果没有 PATH_INFO，尝试从命令行参数获取
  if (!pathInfo && process.argv.length > 2) {
    pathInfo = process.argv[2];
  }
  
  // 如果还是没有，尝试从 REQUEST_URI 获取
  if (!pathInfo && env.REQUEST_URI) {
    pathInfo = env.REQUEST_URI.split('?')[0];
  }

  const result = {
    api: env.HTTP_API_PATH || "",
    path: pathInfo,
    query: querystring.parse(env.QUERY_STRING || ""),
    body: {},
    headers: {
      'user-agent': env.HTTP_USER_AGENT || '',
      'cookie': env.HTTP_COOKIE || '',
      'referer': env.HTTP_REFERER || ''
    }
  };
  
  // 调试信息（写入stderr，不影响CGI输出）
  if (env.DEBUG === '1') {
    console.error('=== CGI Debug Info ===');
    console.error('PATH_INFO:', env.PATH_INFO);
    console.error('REQUEST_URI:', env.REQUEST_URI);
    console.error('QUERY_STRING:', env.QUERY_STRING);
    console.error('REQUEST_METHOD:', env.REQUEST_METHOD);
    console.error('Resolved path:', pathInfo);
    console.error('======================');
  }

  if (env.REQUEST_METHOD === "POST") {
    const contentLength = parseInt(env.CONTENT_LENGTH || "0");

    if (contentLength > 0) {
      const str = await new Promise((r) => {
        let str = "";

        process.stdin.on("data", (chunk) => {
          str += chunk.toString();
        });

        process.stdin.on("end", () => {
          r(str);
        });
      });

      try {
        if (str.trim()) {
          const type = env.CONTENT_TYPE || "";

          if (type.includes("application/x-www-form-urlencoded")) {
            result.body = querystring.parse(str);
          } else if (type.includes("application/json")) {
            result.body = JSON.parse(str);
          } else {
            result.body = { raw: str };
          }
        }
      } catch (error) {
        result.body = {};
      }
    }
  }

  return result;
}

// 路由映射 - 根据路径确定 API
function mapPathToApi(pathInfo) {
  if (pathInfo === '/health') {
    return 'health';
  }
  
  // 解析路径参数
  const parts = pathInfo.split('/').filter(p => p);
  
  if (parts[0] === 'api') {
    if (parts[1] === 'list') {
      return 'list';
    } else if (parts[1] === 'file') {
      return 'file';
    } else if (parts[1] === 'image') {
      return 'image';
    }
  }
  
  return null;
}

async function main() {
  try {
    const data = await getData();
    
    // 根据路径映射到 API
    const apiName = mapPathToApi(data.path);
    if (apiName) {
      data.api = apiName;
    }
    
    const { type, body } = await exec(data);
    
    if (type) {
      console.log(`Content-Type: ${type}`);
      console.log(`Content-Length: ${body.size}`);
      console.log(`Content-Disposition: attachment; filename="${body.filename}"`);
      console.log("");
      body.stream.pipe(process.stdout);
    } else {
      console.log("Content-Type: application/json; charset=utf-8\n");
      console.log(JSON.stringify(body));
    }
  } catch (error) {
    console.log("Content-Type: application/json; charset=utf-8\n");
    console.log(JSON.stringify({ 
      success: false,
      code: 500, 
      msg: '调用错误',
      error: error.message 
    }));
  }
}

main();