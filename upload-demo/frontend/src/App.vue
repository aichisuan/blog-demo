<script setup lang="ts">
import { ref } from 'vue';
import sliceUpload from './util/sliceUpload';
const progressVal = ref(0);
const isDisabled = ref(false);
const file = ref<null | File>(null);
const changeFile = (e: Event) => {
  file.value = (e.target as HTMLInputElement).files?.[0] || null;
};
const handleUpload = async () => {
  if (!file.value)  {
    alert('请选择文件');
    return;
  };
  isDisabled.value = true;
  const {code, data} = await sliceUpload({
    file: file.value,
    onProgress: (val) => {
      progressVal.value = val;
    },
    uploadUrl: 'http://localhost:3006/upload',
    verifyUrl: 'http://localhost:3006/verify',
    mergeUrl: 'http://localhost:3006/merge',
    chunkSizeMb: 30,
  });
  isDisabled.value = false;
  if (code === 0) {
    alert(`上传成功, 文件地址：${data}`);
  } else {
    alert('上传失败');
  }
};
</script>

<template>
  <header>
    <h3>分片上传demo</h3>
  </header>

  <main>
    <input type="file" @change="changeFile" :multiple="false" :disabled="isDisabled" />
    <br>
    <br>
    <button @click="handleUpload">上传</button>
    <br />
    <br>
    上传进度：{{ progressVal }}% <progress :value="progressVal"></progress>
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
  h3 {
    text-align: center;
  }
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
