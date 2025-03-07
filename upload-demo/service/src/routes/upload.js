const Router = require('koa-router');
const fs = require('fs');
const path = require('path');

const router = new Router();

const mergeFiles = async (filePath, dirPath, hash, fileName) => {
  try {
    const uploadedFiles = fs.readdirSync(dirPath);
    const writeStream = fs.createWriteStream(filePath);
    const files = uploadedFiles.sort((a, b) => {
      const aIndex = parseInt(a.split('-').pop(), 10);
      const bIndex = parseInt(b.split('-').pop(), 10);
      return aIndex - bIndex;
    });
    // 按顺序合并
    for (let i = 0; i < files.length; i++) {
      const readStream = fs.createReadStream(`${dirPath}/${files[i]}`);
      const isLast = i === files.length - 1;

      // 确保合并完成
      await new Promise((reslove, reject) => {
        readStream.pipe(writeStream, { end: isLast });
        readStream.on('end', () => {
          // 删除切片
          fs.unlinkSync(`${dirPath}/${files[i]}`);
          reslove();
        });
        readStream.on('error', (err) => {
          reject(err);
        });
      });
    }
    writeStream.on('close', () => {
      fs.rmSync(dirPath, { recursive: true, force: true });
    });
    return {
      code: 0,
      message: '合并成功',
      data: {
        uploadSuccessUrl: `http://localhost:3006/${hash}.${fileName.split('.').pop()}`,
      },
    };
  } catch (error) {
    return {
      code: 1,
      message: '文件合并失败',
      error,
    };
  }
};

// 上传接口
router.post('/upload', async (ctx) => {
  try {
    const { hash, index } = ctx.request.body;
    const file = ctx.request.files.file;
    const dirPath = path.resolve(__dirname, `../saveSliceDir/${hash}`);
    const filePath = path.resolve(dirPath, index);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      ctx.body = {
        code: 0,
        message: '文件已存在',
      };
      return;
    }
    const reader = fs.createReadStream(file.filepath);
    const writer = fs.createWriteStream(filePath);
    await reader.pipe(writer);
    reader.on('end', () => {
      fs.unlinkSync(file.filepath);
    });
    ctx.body = {
      code: 0,
      message: '上传成功',
    };
  } catch (error) {
    ctx.body = {
      code: 1,
      message: '上传失败',
      error,
    };
  }
});

// 验证接口
router.post('/verify', async (ctx) => {
  const { hash, fileName, totalSlice } = ctx.request.body;
  const filePath = path.resolve(__dirname, `../../public/${hash}.${fileName.split('.').pop()}`);
  const dirPath = path.resolve(__dirname, `../saveSliceDir/${hash}`);
  let uploadedFiles = [];

  const needIndexList = Array.from({ length: totalSlice }, (v, i) => i);
  // 文件存在 直接返回文件链接
  if (fs.existsSync(filePath)) {
    ctx.body = {
      code: 0,
      message: '上传成功',
      data: {
        needFileIndexList: [],
        uploadSuccessUrl: `http://localhost:3006/${hash}.${fileName.split('.').pop()}`,
      },
    };
    return;
  }
  if (fs.existsSync(dirPath)) {
    uploadedFiles = fs.readdirSync(dirPath);
    // 文件存在，但是不完整 计算已上传的文件
    if (uploadedFiles.length >= totalSlice) {
      // 已经上传，没有合并文件
      ctx.body = await mergeFiles(filePath, dirPath, hash, fileName);
      return;
    }

    ctx.body = {
      code: 0,
      data: {
        needFileIndexList: needIndexList.filter((i) => !uploadedFiles.includes(i.toString())),
      },
    };
  } else {
    ctx.body = {
      code: 0,
      data: {
        needFileIndexList: needIndexList,
      },
    };
  }
});

// 合并接口
router.post('/merge', async (ctx) => {
  const { hash, fileName } = ctx.request.body;
  const filePath = path.resolve(__dirname, `../../public/${hash}.${fileName.split('.').pop()}`);
  const dirPath = path.resolve(__dirname, `../saveSliceDir/${hash}`);
  ctx.body = await mergeFiles(filePath, dirPath, hash, fileName);
});

module.exports = router;
