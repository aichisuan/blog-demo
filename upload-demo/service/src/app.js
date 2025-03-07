const Koa = require('koa');
const Router = require('koa-router');
const { koaBody } = require('koa-body');
const uploadRoutes = require('./routes/upload');
const path = require('path');
const static = require('koa-static');

const cors = require('koa2-cors');


const app = new Koa();
// static
app.use(static(path.join(__dirname, '../public')));
// cors
app.use(cors());
// 路由
const router = new Router();

// 中间件
app.use(
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: path.join(__dirname, './uploads'), // 上传目录
      keepExtensions: true, // 保持文件扩展名
    },
  })
);

app.use(uploadRoutes.routes());
app.use(uploadRoutes.allowedMethods());

const PORT = 3006;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
