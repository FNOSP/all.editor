module.exports = async function health({ query }) {
  return {
    code: 200,
    msg: "操作成功",
    data: {
      status: 'OK',
      timestamp: new Date().toISOString()
    }
  };
};