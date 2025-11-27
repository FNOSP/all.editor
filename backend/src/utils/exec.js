const router = {
  health: { type: "json", run: require("../router/health") },
  list: { type: "json", run: require("../router/list") },
  file: { type: "file", run: require("../router/file") },
  image: { type: "file", run: require("../router/image") }
};

module.exports = async function exec(data) {
  const api = router[data.api || data.query._api];

  if (!api) {
    return { body: { code: 404, msg: "不存在的接口" } };
  }

  const result = await api.run(data);

  if (result.code === 200 && api.type === "file") {
    const getType = require("./type");
    return { type: getType(result.data.filename), body: result.data };
  } else {
    return { body: result };
  }
};