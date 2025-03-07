import SparkMD5 from 'spark-md5';

interface SliceUploadOptions {
  file: File;
  uploadUrl: string;
  verifyUrl: string;
  mergeUrl: string;
  chunkSizeMb?: number; // mb
  onProgress?: (progress: number) => void;
}

type BrowerFile = File & {
  mozSlice?: (start: number, end: number) => Blob;
  webkitSlice?: (start: number, end: number) => Blob;
};

const sliceFile = (file: File, chunkSizeMb: number) => {
  return new Promise<{ allChunkList: Blob[]; hash: string }>((resolve, reject) => {
    // 兼容浏览器
    const blobSlice = File.prototype.slice || (File.prototype as BrowerFile).mozSlice || (File.prototype as BrowerFile).webkitSlice;
    const chunkSize = 1024 * 1024 * chunkSizeMb;
    const chunks = Math.ceil(file.size / chunkSize);
    const result: Blob[] = [];
    // 当前执行分片
    let currentChunk = 0;

    const spark = new SparkMD5.ArrayBuffer();
    // 文件读取对象
    const fileReader = new FileReader();

    fileReader.onload = function (e: ProgressEvent<FileReader>) {
      spark.append(e.target!.result as ArrayBuffer);
      result.push(new Blob([e.target!.result as ArrayBuffer], { type: file.type }));
      currentChunk++;
      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve({ allChunkList: result, hash: spark.end() });
      }
    };

    fileReader.onerror = function (e) {
      console.log('onerror', e);
      reject(e);
    };
    // 读取分片
    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize;
      const chunk = blobSlice.call(file, start, end);
      fileReader.readAsArrayBuffer(chunk);
    }
    loadNext();
  });
};

const uploadChunk = async (file: Blob, hash: string, index: number, uploadUrl: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', index.toString());
  formData.append('hash', hash);
  formData.append('index', index.toString());
  return fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
};

const sliceUpload = async ({ file, chunkSizeMb = 1, onProgress, verifyUrl, uploadUrl, mergeUrl }: SliceUploadOptions) => {
  const { allChunkList, hash } = await sliceFile(file, chunkSizeMb);
  if (allChunkList.length === 0) {
    return {
      code: 1,
      message: '文件为空',
    }
  }
  // 需要上传的分片的索引 从0 开始
  const needChunkList: number[] = [];

  // 上传进度
  let progress = 0;

  // 已经上传的数量
  let uploadedCount = 0;

  // 通过检验接口校验文件是否已上传，如果已上传则秒传，否则上传需要上传的分片
  if (verifyUrl) {
    // 校验文件是否已上传
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        hash,
        totalSlice: allChunkList.length,
        fileName: file.name,
      }),
    });
    const { data, code } = await res.json();
    if (code !== 0) return { code, message: '上传失败,验证接口有误' };
    const { needFileIndexList, message, uploadSuccessUrl } = data;
    // 校验如果有错误信息提示错误信息
    if (message) {
      console.log(message);
    }
    // 没有需要上传的分片，秒传 返回上传成功链接
    if (needFileIndexList.length === 0) {
      return {
        code: 0,
        data: uploadSuccessUrl,
        message: '上传成功',
      };
    }

    // 有需要上传的分片
    needChunkList.push(...needFileIndexList);
    uploadedCount = allChunkList.length - needFileIndexList.length;
  }else {
    needChunkList.push(...allChunkList.map((_, index) => index));
  }

  // 断点续传同步progress
  progress = Math.floor((needChunkList.length / allChunkList.length) * 100);
  onProgress && onProgress(progress);

  // 上传分片
  const uploadPromises = allChunkList.map(async (chunk, index) => {
    if (needChunkList.includes(index)) {
      const response = await uploadChunk(chunk, hash, index, uploadUrl);
      // 无序上传更新progress
      progress = Math.floor((++uploadedCount / allChunkList.length) * 100);
      onProgress && onProgress(progress);
      return response.json();
    }
  });

  return await Promise.all(uploadPromises).then(async (res) => {
    // 合并分片
    const mergeRes = await fetch(mergeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hash, fileName: file.name }),
    });
    const { data } = await mergeRes.json();
    const { message, uploadSuccessUrl } = data;
    if (message) {
      console.log(message);
    }
    return {
      code: 0,
      data: uploadSuccessUrl,
      message: '上传成功',
    };
  }).catch((e) => {
    return {
      code: 1,
      message: '上传失败, 请重试',
    }
  });
};

export default sliceUpload;
